const { createHeartbeatScheduler } = require('./licenseRemoteHeartbeatScheduler');
const { getEligibleActivationsForHeartbeat } = require('./licenseRemoteActivationDiscovery');
const { sendHeartbeat } = require('./licenseRemoteHeartbeatService');
const { isRemoteEnabled } = require('./licenseRemoteConfig');

// ============================================================
// ===== LAVA Remote Heartbeat Bootstrap Wiring (PART 2B-2C-1) ===
// ============================================================
// الملف ده بس بيوصّل الأجزاء الموجودة بالفعل ببعض - **مفيش منطق جديد
// حقيقي هنا** غير الـwiring نفسه + logging آمن:
//
//   licenseRemoteHeartbeatScheduler (PART 2B-2B)
//           ↓ getActivations
//   licenseRemoteActivationDiscovery (PART 2B-2C-1، جديد)
//           ↓ sendHeartbeat
//   licenseRemoteHeartbeatService (PART 2B-2B)
//           ↓
//   licenseRemoteOrchestrator -> ... -> licenseRemoteResponsePipeline -> licenseRemoteStateService
//
// **مفيش أي side effect وقت require() الملف ده** (PART B/M) - الـscheduler
// instance نفسه بيتبني lazy جوه startLicenseHeartbeatScheduler() أول مرة
// بس، مش على مستوى module top-level. ده بيضمن كمان إن مفيش أكتر من
// instance واحد يتبني حتى لو الملف اتعمله require من أكتر من مكان
// (Node بيكاش الـmodule.exports نفسه أصلًا، لكن lazy init بتضيف طبقة أمان
// إضافية واضحة ضد أي إعادة هيكلة مستقبلية).

let schedulerInstance = null;

/**
 * PART D: `LICENSE_REMOTE_HEARTBEAT_ENABLED` و`LICENSE_REMOTE_ENABLED`
 * حاجتين منفصلتين تمامًا. لو remote مش مفعّل أصلًا (`LICENSE_REMOTE_ENABLED=false`)،
 * أي heartbeat هيترفض فورًا جوه orchestrator.remoteHeartbeat() (بدون أي
 * محاولة اتصال حقيقية على أي حال)، لكن بنرجع `[]` من هنا بدري كمان عشان
 * منستهلكش حتى query على LicenseActivation من غير داعي - النتيجة
 * العملية واحدة (مفيش heartbeat هيحصل)، لكن كده أوضح وأرخص.
 * @returns {Promise<Array<{licenseId: string, activationId: string}>>}
 */
async function getActivations() {
  if (!isRemoteEnabled()) return [];
  return getEligibleActivationsForHeartbeat();
}

/**
 * PART N: logging آمن بس - اسم/كود الخطأ للمراقبة، **مفيش** رسالة الخطأ
 * الخام ولا أي جزء من الـactivation/license نفسها (لا licenseId ولا
 * activationId في اللوج - حتى الاتنين دول مش secret لكن مفيش داعي
 * نطبعهم في logs عامة).
 * @param {Error} err
 */
function logHeartbeatCycleError(err) {
  const code = (err && err.code) || (err && err.name) || 'UNKNOWN_ERROR';
  console.warn(`[license-heartbeat] cycle reported an issue (${code})`);
}

/**
 * @param {{attempted: number, succeeded: number, failed: number}} result
 */
function logHeartbeatCycleCompleted(result) {
  console.log(`[license-heartbeat] cycle completed (attempted=${result.attempted}, succeeded=${result.succeeded}, failed=${result.failed})`);
}

/**
 * @returns {{start: Function, stop: Function, isRunning: Function}} نفس
 *   scheduler instance دايمًا (lazy singleton) - أول نداء بيبنيه، أي نداء
 *   بعد كده بيرجع نفس الـinstance.
 */
function getLicenseHeartbeatScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = createHeartbeatScheduler({
      getActivations,
      sendHeartbeat,
      onError: logHeartbeatCycleError,
      onTick: logHeartbeatCycleCompleted,
    });
  }
  return schedulerInstance;
}

/**
 * PART J: بيبدأ الـscheduler - idempotent بالكامل (نفس ضمانات
 * createHeartbeatScheduler().start()). لو `LICENSE_REMOTE_HEARTBEAT_ENABLED`
 * مش `true`، start() الداخلية بترجع من غير ما تعمل حاجة (PART C) - مفيش
 * أي فحص تفعيل مكرر هنا.
 */
function startLicenseHeartbeatScheduler() {
  const scheduler = getLicenseHeartbeatScheduler();
  scheduler.start();
  if (scheduler.isRunning()) {
    console.log('[license-heartbeat] scheduler started');
  }
}

/**
 * PART L: بيوقف الـscheduler - آمن يتنادى حتى لو مكنش شغال أصلًا
 * (stop() الداخلية idempotent). **مفيش process.exit() هنا خالص** - ده
 * قرار الـcaller (server.js) في shutdown handler الموجود بالفعل.
 */
function stopLicenseHeartbeatScheduler() {
  if (!schedulerInstance) return;
  schedulerInstance.stop();
  console.log('[license-heartbeat] scheduler stopped');
}

module.exports = {
  getLicenseHeartbeatScheduler,
  startLicenseHeartbeatScheduler,
  stopLicenseHeartbeatScheduler,
};