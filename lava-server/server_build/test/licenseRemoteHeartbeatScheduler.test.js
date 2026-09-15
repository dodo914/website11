const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const schedulerModule = require(path.join(root, 'services/license/licenseRemoteHeartbeatScheduler.js'));
const { createHeartbeatScheduler, heartbeatRunner, isHeartbeatSchedulingEnabled, getHeartbeatIntervalMs } = schedulerModule;

// ============================================================
// PART 2B-2B - Remote License Heartbeat Scheduler tests.
// مفيش HTTP حقيقي هنا خالص - getActivations/sendHeartbeat دايمًا
// injected functions بسيطة. بنستخدم real timers بفواصل صغيرة جدًا (ملي
// ثواني قليلة) بدل fake-timer library عشان مفيش واحدة متاحة في المشروع
// أصلًا - بنسيب هامش وقت كافي (`waitMs`) لتفادي flakiness.
// ============================================================

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withEnv(vars, fn) {
  const original = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(original)) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    });
}

// ---------- module import must have zero side effects (PART M / test 14) ----------

test('module import: no automatic scheduler start / no top-level setInterval side effects', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(root, 'services/license/licenseRemoteHeartbeatScheduler.js'), 'utf8');
  // مفيش أي setInterval() مستدعاة على مستوى الملف نفسه (برّه أي function) -
  // فحص بسيط: كل استخدام لـsetInterval لازم يكون جوه function body (يعني
  // مسبوق بـindentation جوه {}) - هنا بنتأكد ببساطة إن معدل الاستدعاء
  // موجود بس جوه createHeartbeatScheduler/start(), مش استدعاء عاري فوري.
  assert.ok(!/^\s*setInterval\(/m.test(source), 'setInterval must not be called at module top-level');
});

// ---------- config helpers ----------

test('isHeartbeatSchedulingEnabled: defaults to false', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: undefined }, async () => {
    assert.equal(isHeartbeatSchedulingEnabled(), false);
  }));

test('getHeartbeatIntervalMs: falls back to a safe default for invalid values', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_INTERVAL_MS: 'not-a-number' }, async () => {
    assert.equal(getHeartbeatIntervalMs(), schedulerModule.DEFAULT_HEARTBEAT_INTERVAL_MS);
  }));

// ---------- heartbeatRunner (injection foundation - PART E) ----------

test('heartbeatRunner: calls sendHeartbeat for each activation from getActivations, one failure does not stop the rest', async () => {
  const activations = [{ licenseId: 'LIC-1', activationId: 'A' }, { licenseId: 'LIC-1', activationId: 'B' }, { licenseId: 'LIC-1', activationId: 'C' }];
  const calledWith = [];
  const sendHeartbeat = async (activation) => {
    calledWith.push(activation);
    if (activation.activationId === 'B') throw new Error('simulated failure');
    return { usable: true };
  };
  const errors = [];
  const result = await heartbeatRunner({ getActivations: () => activations, sendHeartbeat, onError: (err, activation) => errors.push({ err, activation }) });

  assert.equal(calledWith.length, 3);
  assert.deepEqual(result, { attempted: 3, succeeded: 2, failed: 1 });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].activation.activationId, 'B');
});

test('heartbeatRunner: supports an async getActivations and an empty list', async () => {
  const result = await heartbeatRunner({ getActivations: async () => [], sendHeartbeat: async () => ({}) });
  assert.deepEqual(result, { attempted: 0, succeeded: 0, failed: 0 });
});

test('heartbeatRunner: requires getActivations and sendHeartbeat to be functions', async () => {
  await assert.rejects(() => heartbeatRunner({ sendHeartbeat: async () => {} }));
  await assert.rejects(() => heartbeatRunner({ getActivations: () => [] }));
});

// ---------- scheduler: start/stop lifecycle ----------

test('scheduler: start() with force runs ticks at the configured interval', async () => {
  const scheduler = createHeartbeatScheduler({
    getActivations: () => [{ licenseId: 'LIC-1', activationId: 'A' }],
    sendHeartbeat: async () => ({ usable: true }),
  });
  let tickCount = 0;
  scheduler._tickOnceForTests; // sanity: exists for direct invocation too
  const withOnTick = createHeartbeatScheduler({
    getActivations: () => [{ licenseId: 'LIC-1', activationId: 'A' }],
    sendHeartbeat: async () => ({ usable: true }),
    onTick: () => { tickCount += 1; },
  });

  withOnTick.start({ force: true, intervalMs: 20 });
  try {
    await waitMs(90);
    assert.ok(tickCount >= 2, `expected at least 2 ticks in ~90ms with a 20ms interval, got ${tickCount}`);
  } finally {
    withOnTick.stop();
  }
  assert.equal(scheduler.isRunning(), false, 'a scheduler that never called start() must not be running');
});

test('scheduler: disabled config (no force) does not start', () =>
  withEnv({ LICENSE_REMOTE_HEARTBEAT_ENABLED: 'false' }, async () => {
    const scheduler = createHeartbeatScheduler({ getActivations: () => [], sendHeartbeat: async () => ({}) });
    scheduler.start(); // no force, env disabled
    assert.equal(scheduler.isRunning(), false);
    scheduler.stop(); // must be a safe no-op
  }));

test('scheduler: double start() does not create duplicate timers', async () => {
  let tickCount = 0;
  const scheduler = createHeartbeatScheduler({
    getActivations: () => [],
    sendHeartbeat: async () => ({}),
    onTick: () => { tickCount += 1; },
  });
  scheduler.start({ force: true, intervalMs: 20 });
  scheduler.start({ force: true, intervalMs: 20 });
  scheduler.start({ force: true, intervalMs: 20 });
  try {
    await waitMs(90);
    // لو فيه 3 timers شغالين، العدد كان هيبقى أكتر بكتير (تقريبًا x3).
    // نتأكد إن العدد في نطاق "timer واحد بس" مش مضاعف.
    assert.ok(tickCount <= 6, `expected roughly one timer's worth of ticks, got ${tickCount} (looks like duplicate timers)`);
  } finally {
    scheduler.stop();
  }
});

test('scheduler: double stop() is safe and does not throw', () => {
  const scheduler = createHeartbeatScheduler({ getActivations: () => [], sendHeartbeat: async () => ({}) });
  scheduler.start({ force: true, intervalMs: 1000 });
  assert.doesNotThrow(() => {
    scheduler.stop();
    scheduler.stop();
  });
  assert.equal(scheduler.isRunning(), false);
});

test('scheduler: stop() prevents future runs', async () => {
  let tickCount = 0;
  const scheduler = createHeartbeatScheduler({
    getActivations: () => [],
    sendHeartbeat: async () => ({}),
    onTick: () => { tickCount += 1; },
  });
  scheduler.start({ force: true, intervalMs: 20 });
  await waitMs(50);
  scheduler.stop();
  const countAfterStop = tickCount;
  await waitMs(80);
  assert.equal(tickCount, countAfterStop, 'no further ticks must happen after stop()');
});

// ---------- resilience ----------

test('scheduler: a heartbeat failure does not kill the scheduler (still running, still ticking)', async () => {
  let tickCount = 0;
  let errorCount = 0;
  const scheduler = createHeartbeatScheduler({
    getActivations: () => [{ licenseId: 'LIC-1', activationId: 'A' }],
    sendHeartbeat: async () => { throw new Error('simulated remote failure'); },
    onError: () => { errorCount += 1; },
    onTick: () => { tickCount += 1; },
  });
  scheduler.start({ force: true, intervalMs: 20 });
  try {
    await waitMs(90);
    assert.ok(tickCount >= 2, 'scheduler must keep ticking after a heartbeat failure');
    assert.ok(errorCount >= 2);
    assert.equal(scheduler.isRunning(), true);
  } finally {
    scheduler.stop();
  }
});

test('scheduler: a RemoteLicenseUnavailableError-like rejection does not kill the scheduler', async () => {
  const { RemoteLicenseUnavailableError } = require(path.join(root, 'services/license/licenseErrors.js'));
  let tickCount = 0;
  const scheduler = createHeartbeatScheduler({
    getActivations: () => [{ licenseId: 'LIC-1', activationId: 'A' }],
    sendHeartbeat: async () => { throw new RemoteLicenseUnavailableError({ reason: 'transport_error' }); },
    onTick: () => { tickCount += 1; },
  });
  scheduler.start({ force: true, intervalMs: 20 });
  try {
    await waitMs(90);
    assert.ok(tickCount >= 2);
    assert.equal(scheduler.isRunning(), true);
  } finally {
    scheduler.stop();
  }
});

test('scheduler: remains usable (can be stopped/restarted) after a failed heartbeat tick', async () => {
  const scheduler = createHeartbeatScheduler({
    getActivations: () => [{ licenseId: 'LIC-1', activationId: 'A' }],
    sendHeartbeat: async () => { throw new Error('boom'); },
  });
  scheduler.start({ force: true, intervalMs: 20 });
  await waitMs(50);
  scheduler.stop();
  assert.equal(scheduler.isRunning(), false);

  // restart بعد فشل - لازم يشتغل عادي من غير أي أثر من الفشل اللي فات.
  let tickCount = 0;
  const scheduler2 = createHeartbeatScheduler({
    getActivations: () => [],
    sendHeartbeat: async () => ({}),
    onTick: () => { tickCount += 1; },
  });
  scheduler2.start({ force: true, intervalMs: 20 });
  try {
    await waitMs(50);
    assert.ok(tickCount >= 1);
  } finally {
    scheduler2.stop();
  }
});

// ---------- overlap protection at the tick level ----------

test('scheduler: does not start a new tick while a previous slow tick is still running', async () => {
  let concurrentRuns = 0;
  let maxConcurrent = 0;
  let totalRuns = 0;
  const scheduler = createHeartbeatScheduler({
    getActivations: () => [{ licenseId: 'LIC-1', activationId: 'A' }],
    sendHeartbeat: async () => {
      concurrentRuns += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrentRuns);
      totalRuns += 1;
      await waitMs(60); // أبطأ من الـinterval (20ms) عمدًا
      concurrentRuns -= 1;
      return { usable: true };
    },
  });
  scheduler.start({ force: true, intervalMs: 20 });
  try {
    await waitMs(150);
    assert.equal(maxConcurrent, 1, 'a slow tick must not overlap with the next scheduled tick');
    assert.ok(totalRuns >= 1);
  } finally {
    scheduler.stop();
  }
});

// ---------- independent instances ----------

test('scheduler: two independent scheduler instances do not interfere with each other', async () => {
  let countA = 0;
  let countB = 0;
  const schedulerA = createHeartbeatScheduler({ getActivations: () => [], sendHeartbeat: async () => ({}), onTick: () => { countA += 1; } });
  const schedulerB = createHeartbeatScheduler({ getActivations: () => [], sendHeartbeat: async () => ({}), onTick: () => { countB += 1; } });

  schedulerA.start({ force: true, intervalMs: 20 });
  try {
    await waitMs(50);
    assert.equal(schedulerB.isRunning(), false, 'starting scheduler A must not start scheduler B');
    assert.equal(countB, 0);
  } finally {
    schedulerA.stop();
  }
});