// ============================================================
// ===== LAVA Remote License Heartbeat Scheduler (PART 2B-2B) ====
// ============================================================
// Foundation بس - scheduler قابل للـstart/stop، **مش بيبدأ تلقائيًا خالص**
// (PART M: لا side effects أثناء import، ومفيش setInterval على مستوى
// module). لازم حد ينادي start() صراحة.
//
// PART E: الـscheduler ده **مش** بيعمل full database-wide scan للـ
// licenses كلها - ده هيحتاج architecture واضحة لمرحلة تانية. بدل كده،
// الـrunner بياخد `getActivations`/`sendHeartbeat` كـinjected functions
// (dependency injection كاملة) - المرحلة الجاية تقدر توصلهم بالـDB
// بطريقة واضحة من غير ما تعدل الملف ده.
//
// PART D/L: start/stop/isRunning + safe shutdown. PART J (concurrency)
// اتعمل في licenseRemoteHeartbeatService.js نفسها (in-flight lock لكل
// activation) - الـscheduler هنا مش محتاج يكرر القفل ده، بس بيتأكد إنه
// مبيبدأش tick جديد قبل ما اللي قبله يخلص (نفس فكرة marketingWorker.js
// الموجودة بالفعل - tickRunning flag).

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes - معقول لـheartbeat، مش aggressive

/**
 * @returns {boolean} من LICENSE_REMOTE_HEARTBEAT_ENABLED - افتراضي false
 *   دايمًا (PART: "لا تجعل heartbeat يعمل افتراضيًا في production").
 */
function isHeartbeatSchedulingEnabled() {
  return String(process.env.LICENSE_REMOTE_HEARTBEAT_ENABLED || 'false').trim().toLowerCase() === 'true';
}

/**
 * @returns {number} الـinterval بالميلي ثانية - default آمن لو القيمة مش
 *   موجودة/مش رقم صالح/<= 0.
 */
function getHeartbeatIntervalMs() {
  const raw = Number(process.env.LICENSE_REMOTE_HEARTBEAT_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HEARTBEAT_INTERVAL_MS;
}

/**
 * PART E: runner قابل للحقن بالكامل - مفيش أي DB access مباشر هنا.
 * `getActivations()` لازم ترجع array من `{licenseId, activationId}`
 * (sync أو async)، و`sendHeartbeat()` لازم تاخد نفس الشكل ده وترجع
 * promise (زي licenseRemoteHeartbeatService.sendHeartbeat() بالظبط أو
 * أي wrapper حواليها). فشل heartbeat واحد **ميوقفش** اللي بعده.
 * @param {{getActivations: Function, sendHeartbeat: Function, onError?: Function}} deps
 * @returns {Promise<{attempted: number, succeeded: number, failed: number}>}
 */
async function heartbeatRunner({ getActivations, sendHeartbeat, onError } = {}) {
  if (typeof getActivations !== 'function' || typeof sendHeartbeat !== 'function') {
    throw new Error('heartbeatRunner: getActivations and sendHeartbeat are required functions');
  }

  const activations = (await getActivations()) || [];
  let succeeded = 0;
  let failed = 0;

  for (const activation of activations) {
    try {
      await sendHeartbeat(activation);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      // PART F: فشل heartbeat واحد (remote unavailable/invalid/...) ميوقفش
      // معالجة باقي الـactivations، ومفيش throw هنا - بيتسجل بس عن طريق
      // onError لو الـcaller عايز يعمل logging/monitoring.
      if (typeof onError === 'function') {
        try { onError(err, activation); } catch { /* onError نفسها ميكسرش الـrunner */ }
      }
    }
  }

  return { attempted: activations.length, succeeded, failed };
}

/**
 * بيبني scheduler instance مستقل (مش singleton مفروض على مستوى module) -
 * كل instance عنده الـtimer/state بتاعه لوحده، عشان التستات تقدر تعمل
 * أكتر من واحد من غير ما يأثروا على بعض.
 * @param {{getActivations?: Function, sendHeartbeat?: Function, onError?: Function, onTick?: Function}} [deps]
 * @returns {{start: Function, stop: Function, isRunning: Function}}
 */
function createHeartbeatScheduler(deps = {}) {
  let timer = null;
  let tickRunning = false;
  let stopped = true;

  async function tick() {
    // PART J (scheduler-level): مفيش tick تاني يبدأ قبل ما اللي قبله يخلص
    // (نفس فكرة marketingWorker.js الموجودة) - الحماية لكل-activation
    // نفسها موجودة في licenseRemoteHeartbeatService.js.
    if (tickRunning) return;
    tickRunning = true;
    try {
      const getActivations = deps.getActivations || (() => []);
      const sendHeartbeat = deps.sendHeartbeat;
      if (typeof sendHeartbeat !== 'function') {
        throw new Error('createHeartbeatScheduler: deps.sendHeartbeat is required to run a tick');
      }
      const result = await heartbeatRunner({ getActivations, sendHeartbeat, onError: deps.onError });
      if (typeof deps.onTick === 'function') {
        try { deps.onTick(result); } catch { /* onTick نفسها ميكسرش الـscheduler */ }
      }
    } catch (err) {
      if (typeof deps.onError === 'function') {
        try { deps.onError(err, null); } catch { /* noop */ }
      }
    } finally {
      tickRunning = false;
    }
  }

  /**
   * PART D/M: بيبدأ الـscheduler - **idempotent**: نداء start() أكتر من
   * مرة (من غير stop() بينهم) ميعملش أكتر من timer واحد. لو
   * LICENSE_REMOTE_HEARTBEAT_ENABLED=false، start() بترجع من غير ما
   * تعمل حاجة (مفيش timer خالص) - الـdefault يفضل "مطفي" حتى لو حد نده
   * start() بالغلط.
   * @param {{intervalMs?: number, force?: boolean}} [options] - `force:true`
   *   يفيد في التستات بس عشان تختبر سلوك الـscheduler نفسه من غير ما
   *   يتربط بـenv حقيقي؛ الاستخدام العادي في التطبيق ميحتاجش الـoption ده.
   */
  function start(options = {}) {
    if (timer) return; // idempotent - فيه timer شغال بالفعل
    if (!options.force && !isHeartbeatSchedulingEnabled()) return;

    stopped = false;
    const intervalMs = Number.isFinite(options.intervalMs) && options.intervalMs > 0
      ? options.intervalMs
      : getHeartbeatIntervalMs();

    timer = setInterval(() => { tick(); }, intervalMs);
    // مايمنعش Node process من الخروج (نفس أسلوب أي background timer
    // اختياري - العملية الرئيسية ميفضلش "معلق" بسببه بس).
    if (typeof timer.unref === 'function') timer.unref();
  }

  /**
   * PART D/L: بيوقف الـscheduler - **idempotent وآمن تمامًا**: نداء
   * stop() على scheduler مش شغال (أو أكتر من مرة) مبيعملش أي exception.
   * بيمسح الـtimer ويمنع أي tick مستقبلي، لكن **مبيقاطعش** tick شغال
   * دلوقتي بالفعل (بيخلص عادي، بس مفيش tick جديد بعده).
   */
  function stop() {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  /** @returns {boolean} هل فيه timer فعّال دلوقتي. */
  function isRunning() {
    return Boolean(timer) && !stopped;
  }

  return { start, stop, isRunning, _tickOnceForTests: tick };
}

module.exports = {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  isHeartbeatSchedulingEnabled,
  getHeartbeatIntervalMs,
  heartbeatRunner,
  createHeartbeatScheduler,
};