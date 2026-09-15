const orchestrator = require('./licenseRemoteOrchestrator');
const { getRemoteLicenseUsability } = require('./licenseRemoteStateService');
const { getRemoteTimeoutMs } = require('./licenseRemoteConfig');
const { RemoteLicenseUnavailableError } = require('./licenseErrors');

// ============================================================
// ===== LAVA Remote License Heartbeat Service (PART 2B-2B) ======
// ============================================================
// الملف ده هو "lifecycle" layer فوق الـorchestrator بس - مفيهوش أي
// protocol/signature/transport logic جديدة. اتجاه الاعتماد (PART P) بيفضل
// زي ما هو بالظبط:
//
//   licenseRemoteHeartbeatService (هنا)
//           ↓
//   licenseRemoteOrchestrator.remoteHeartbeat()
//           ↓
//   licenseRemoteClient -> licenseRemoteResponsePipeline -> licenseRemoteStateService
//
// الملف ده **مبيعملش** raw response handling ولا signature verification
// بنفسه - ده كله شغل orchestrator/pipeline الموجودين بالفعل. مسؤوليته
// الوحيدة: يبني نتيجة heartbeat واحدة، آمنة ومطبّعة، من غير ما يلمس
// الـLocal License/LicenseActivation خالص (PART C).
//
// ---- PART Q: مفيش shortcut للـverification ----
// كل استدعاء لـsendHeartbeat() بيعدي بالكامل على orchestrator.remoteHeartbeat()
// اللي بدورها بتنادي processRemoteResponse() (protocol → requestId →
// timestamp → Ed25519 signature → normalize) قبل أي persistence. الملف
// ده مبيقدرش "يتجاوز" الخطوات دي لأنه مبيشوفش raw response أصلًا.

/**
 * بيتأكد من الحقول الأساسية - fail fast محليًا، نفس أسلوب
 * licenseRemoteOrchestrator.js/licenseRemoteProtocol.js (مش typed
 * LicenseError، ده misuse من الكود نفسه مش remote failure).
 * @param {Object} fields
 * @param {string[]} requiredKeys
 */
function requireFields(fields, requiredKeys) {
  for (const key of requiredKeys) {
    if (!fields[key]) {
      throw new Error(`licenseRemoteHeartbeatService: missing required field "${key}"`);
    }
  }
}

/**
 * PART K - Timeout foundation: بيلف أي promise بـtimeout آمن بدل ما
 * يتعلق للأبد. بيعيد استخدام LICENSE_REMOTE_TIMEOUT_MS الموجودة بالفعل
 * في licenseRemoteConfig.js (**مفيش timeout جديد مختلف** بيتعارض مع
 * الـremote client - نفس القيمة بالظبط). لو الـpromise الأصلي rejected
 * أو resolved الأول، بترجع نتيجته زي ما هي من غير تغيير.
 * @param {Promise} promise
 * @param {string} operation - للاستخدام في رسالة الـtimeout error بس
 * @returns {Promise}
 */
function withTimeout(promise, operation) {
  const timeoutMs = getRemoteTimeoutMs();
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new RemoteLicenseUnavailableError({ reason: 'heartbeat_timeout', operation }));
    }, timeoutMs);
    // مايمنعش Node process من الخروج لو ده آخر حاجة شغالة (تست/سكريبت) -
    // نفس الأسلوب المتبع عادةً لـtimers مؤقتة.
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// ---- PART J: in-flight lock (single-process, in-memory بس) ----
// Map بسيطة: activation key -> true لو فيه heartbeat شغال دلوقتي لنفس
// الـactivation. **مش** Redis ولا distributed lock - حماية جوه نفس
// الـNode process بس، زي ما اتطلب صراحة.
const inFlightHeartbeats = new Map();

function lockKey(licenseId, activationId) {
  return `${licenseId}::${activationId}`;
}

/**
 * PART A/H - بيبعت heartbeat واحد لactivation معينة، ويرجّع نتيجة
 * موحّدة وآمنة. **لا يقرأ ولا يعدّل Local License/LicenseActivation
 * مباشرة** (PART C) - كل حاجة بتعدي على orchestrator اللي بيستخدم
 * licenseRemoteStateService بس للـpersistence.
 *
 * PART J: لو فيه heartbeat شغال بالفعل لنفس (licenseId, activationId)،
 * بيترفض فورًا بـerror واضح بدل ما يبعت طلب تاني متداخل - الـcaller
 * (الـscheduler أو أي حد تاني) هو اللي يقرر يعيد المحاولة بعدين.
 *
 * @param {{licenseId: string, activationId: string}} input
 * @returns {Promise<{success: boolean, status: string, code: string|null, usable: boolean}>}
 */
async function sendHeartbeat({ licenseId, activationId } = {}) {
  requireFields({ licenseId, activationId }, ['licenseId', 'activationId']);

  const key = lockKey(licenseId, activationId);
  if (inFlightHeartbeats.has(key)) {
    throw new Error(`licenseRemoteHeartbeatService: a heartbeat is already in flight for licenseId="${licenseId}" activationId="${activationId}"`);
  }
  inFlightHeartbeats.set(key, true);

  try {
    // PART K: timeout مضمون - orchestrator.remoteHeartbeat() بيعدي على
    // transport محقون ممكن يتعلق (مثلًا في تستات/مستقبلًا)؛ الـrace ده
    // بيضمن إن sendHeartbeat() نفسها دايمًا بترجع/ترفض خلال حدود معقولة.
    const processed = await withTimeout(orchestrator.remoteHeartbeat({ licenseId, activationId }), 'HEARTBEAT');

    // PART B/H: استخدام interpretRemoteLicenseState() الموجودة بدل أي
    // duplicate status-mapping logic - نفس الـactive/expired/revoked/
    // suspended/invalid mapping المستخدم في باقي النظام بالظبط.
    const interpreted = orchestrator.interpretRemoteLicenseState(processed);

    return {
      success: processed.success === true,
      status: interpreted.status,
      code: interpreted.code,
      usable: interpreted.usable,
    };
  } finally {
    // PART K/J: أي مسار خروج (نجاح، فشل، timeout) لازم يفك القفل - وإلا
    // نفس الـactivation هتفضل "مقفولة" للأبد بعد أول فشل.
    inFlightHeartbeats.delete(key);
  }
}

/**
 * هل فيه heartbeat شغال دلوقتي لـ(licenseId, activationId) دي؟ بيفيد في
 * التستات وفي أي caller عايز يتجنب الـerror بدل ما يعتمد على catch.
 * @param {string} licenseId
 * @param {string} activationId
 * @returns {boolean}
 */
function isHeartbeatInFlight(licenseId, activationId) {
  return inFlightHeartbeats.has(lockKey(licenseId, activationId));
}

/** للتستات بس - بيصفّر أي قفل عالق (مفيش استخدام production طبيعي ليها). */
function _resetLocksForTests() {
  inFlightHeartbeats.clear();
}

/**
 * PART F/G/I - Convenience wrapper: بيبعت heartbeat، ولو فشل (remote
 * unavailable/invalid/timeout) بيرجع فallback آمن بدل ما يرمي - مبني على
 * evaluateRemoteUsability() (نفس الـ72-hour grace foundation الموجودة،
 * **مفيش policy جديدة هنا**). ده مفيد لأي caller (زي الـscheduler) عايز
 * "نتيجة" دايمًا من غير try/catch بتاعه هو، لكن sendHeartbeat() الخام
 * نفسها لسه بترمي الـerror الحقيقي لمين عايز يتعامل معاه بنفسه.
 * @param {{licenseId: string, activationId: string}} input
 * @returns {Promise<{success: boolean, status: string, code: string|null, usable: boolean, usedGrace: boolean}>}
 */
async function sendHeartbeatWithGraceFallback({ licenseId, activationId } = {}) {
  try {
    const result = await sendHeartbeat({ licenseId, activationId });
    return { ...result, usedGrace: false };
  } catch (err) {
    // PART F: remote unavailable/untrusted response ≠ license متسحب -
    // بنرجع لآخر trusted remote state (لو موجودة) عن طريق grace policy
    // الموجودة، مش بنفترض أي حاجة جديدة.
    const usability = await getRemoteLicenseUsability(licenseId);
    const usable = usability.bucket === 'fresh' || usability.bucket === 'stale_in_grace';
    return {
      success: false,
      status: usability.state ? usability.state.status || 'invalid' : 'invalid',
      code: usability.code,
      usable,
      usedGrace: true,
    };
  }
}

module.exports = {
  sendHeartbeat,
  sendHeartbeatWithGraceFallback,
  isHeartbeatInFlight,
  _resetLocksForTests,
};