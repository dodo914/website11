'use strict';

// jest.mock factories are hoisted, so models are swapped for shared
// in-memory fakes (see helpers/fakeModel.js) before activationService is
// required anywhere below.
jest.mock('../models/License', () => ({
  License: require('./helpers/fakeModel').__sharedLicenseModel,
}));
jest.mock('../models/LicenseActivation', () => ({
  LicenseActivation: require('./helpers/fakeModel').__sharedActivationModel,
}));
jest.mock('../services/eventService', () => ({
  recordEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('activationService', () => {
  let activationService;
  let License;
  let LicenseActivation;

  beforeEach(() => {
    jest.resetModules();
    const { __sharedLicenseModel, __sharedActivationModel } = require('./helpers/fakeModel');
    __sharedLicenseModel.reset();
    __sharedActivationModel.reset();
    License = __sharedLicenseModel;
    LicenseActivation = __sharedActivationModel;
    activationService = require('../services/activationService');
  });

  async function seedLicense(overrides = {}) {
    return License.create({
      licenseId: 'lic-1',
      customerReference: 'cust-1',
      type: 'standard',
      status: 'active',
      allowedDomains: [],
      maxActivations: 2,
      activeActivationCount: 0,
      ...overrides,
    });
  }

  test('activates successfully and increments the counter', async () => {
    await seedLicense();
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
    });
    expect(activation.status).toBe('active');

    const license = await License.findOne({ licenseId: 'lic-1' });
    expect(license.activeActivationCount).toBe(1);
  });

  test('rejects activation for an unknown license', async () => {
    await expect(
      activationService.activateLicense({ licenseId: 'nope', domain: 'example.com', fingerprintHash: 'fp' })
    ).rejects.toThrow('License not found');
  });

  test('rejects a disallowed domain and does not reserve a slot', async () => {
    await seedLicense({ allowedDomains: ['allowed.com'] });
    await expect(
      activationService.activateLicense({ licenseId: 'lic-1', domain: 'evil.com', fingerprintHash: 'fp' })
    ).rejects.toThrow('Domain is not allowed');

    const license = await License.findOne({ licenseId: 'lic-1' });
    expect(license.activeActivationCount).toBe(0);
  });

  test('enforces the activation limit', async () => {
    await seedLicense({ maxActivations: 1 });
    await activationService.activateLicense({ licenseId: 'lic-1', domain: 'a.com', fingerprintHash: 'fp-1' });

    await expect(
      activationService.activateLicense({ licenseId: 'lic-1', domain: 'b.com', fingerprintHash: 'fp-2' })
    ).rejects.toThrow('Activation limit reached');
  });

  test('duplicate activation requests (same domain+fingerprint) return the existing activation', async () => {
    await seedLicense({ maxActivations: 5 });
    const first = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
    });
    const second = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
    });

    expect(second.activationId).toBe(first.activationId);

    const license = await License.findOne({ licenseId: 'lic-1' });
    expect(license.activeActivationCount).toBe(1); // not double-counted
  });

  test('concurrent activation requests never exceed maxActivations', async () => {
    await seedLicense({ maxActivations: 3 });

    const attempts = Array.from({ length: 10 }, (_, i) =>
      activationService.activateLicense({
        licenseId: 'lic-1',
        domain: `domain-${i}.com`,
        fingerprintHash: `fp-${i}`,
      }).catch((err) => ({ failed: true, message: err.message }))
    );

    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => !r.failed);
    expect(succeeded.length).toBe(3);

    const license = await License.findOne({ licenseId: 'lic-1' });
    expect(license.activeActivationCount).toBe(3);
  });

  test('heartbeat updates lastSeenAt for an active activation', async () => {
    await seedLicense();
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
    });

    const before = activation.lastSeenAt;
    await new Promise((r) => setTimeout(r, 5));
    const updated = await activationService.heartbeat({
      licenseId: 'lic-1',
      activationId: activation.activationId,
    });

    expect(updated.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  test('heartbeat throws for an unknown activation', async () => {
    await seedLicense();
    await expect(
      activationService.heartbeat({ licenseId: 'lic-1', activationId: 'nope' })
    ).rejects.toThrow('Active activation not found');
  });

  test('deactivation frees the activation slot', async () => {
    await seedLicense({ maxActivations: 1 });
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
    });

    await activationService.deactivateActivation({
      licenseId: 'lic-1',
      activationId: activation.activationId,
    });

    const license = await License.findOne({ licenseId: 'lic-1' });
    expect(license.activeActivationCount).toBe(0);

    // Slot is free again for a new activation.
    const reactivated = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'other.com',
      fingerprintHash: 'fp-2',
    });
    expect(reactivated.status).toBe('active');
  });

  test('deactivate is idempotent: repeating it returns success instead of erroring', async () => {
    await seedLicense({ maxActivations: 1 });
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
    });

    const first = await activationService.deactivateActivation({
      licenseId: 'lic-1',
      activationId: activation.activationId,
    });
    expect(first.status).toBe('deactivated');

    const second = await activationService.deactivateActivation({
      licenseId: 'lic-1',
      activationId: activation.activationId,
    });
    expect(second.status).toBe('deactivated');

    // The slot must only ever have been released once.
    const license = await License.findOne({ licenseId: 'lic-1' });
    expect(license.activeActivationCount).toBe(0);
  });

  test('activation succeeds when the requested buildId matches the license', async () => {
    await seedLicense({ buildId: 'build-42' });
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
      buildId: 'build-42',
    });
    expect(activation.status).toBe('active');
    expect(activation.buildId).toBe('build-42');
  });

  test('activation is rejected when the requested buildId does not match the license', async () => {
    await seedLicense({ buildId: 'build-42' });
    await expect(
      activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
        buildId: 'build-99',
      })
    ).rejects.toThrow('Build ID does not match');
  });

  test('a buildId mismatch does not reserve an activation slot', async () => {
    await seedLicense({ buildId: 'build-42', maxActivations: 1 });
    await expect(
      activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
        buildId: 'wrong',
      })
    ).rejects.toThrow('Build ID does not match');

    const license = await License.findOne({ licenseId: 'lic-1' });
    expect(license.activeActivationCount).toBe(0);
  });

  test('a buildId mismatch does not modify an existing activation for the same domain+fingerprint', async () => {
    await seedLicense({ buildId: null, maxActivations: 2 });
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
      buildId: 'build-A',
    });

    // Reconfigure the license to require a different build and retry
    // the same domain/fingerprint pair with a mismatching buildId.
    const license = await License.findOne({ licenseId: 'lic-1' });
    license.buildId = 'build-B';

    await expect(
      activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
        buildId: 'build-A',
      })
    ).rejects.toThrow('Build ID does not match');

    const unchanged = await LicenseActivation.findOne({ activationId: activation.activationId });
    expect(unchanged.buildId).toBe('build-A');
    expect(unchanged.status).toBe('active');
  });

  test('a license with no configured buildId accepts any (or no) requested buildId', async () => {
    await seedLicense({ buildId: null });
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
      buildId: 'whatever-the-client-sends',
    });
    expect(activation.status).toBe('active');
  });

  test('heartbeat never changes the activation buildId', async () => {
    await seedLicense({ buildId: null });
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
      buildId: 'build-A',
    });

    const updated = await activationService.heartbeat({
      licenseId: 'lic-1',
      activationId: activation.activationId,
    });

    expect(updated.buildId).toBe('build-A');
  });

  test('heartbeat cannot reactivate a deactivated activation', async () => {
    await seedLicense();
    const activation = await activationService.activateLicense({
      licenseId: 'lic-1',
      domain: 'example.com',
      fingerprintHash: 'fp-1',
    });
    await activationService.deactivateActivation({
      licenseId: 'lic-1',
      activationId: activation.activationId,
    });

    await expect(
      activationService.heartbeat({ licenseId: 'lic-1', activationId: activation.activationId })
    ).rejects.toThrow('Active activation not found');

    const stillDeactivated = await LicenseActivation.findOne({ activationId: activation.activationId });
    expect(stillDeactivated.status).toBe('deactivated');
  });

  describe('PART 3A-FIX-2: activation state integrity', () => {
    async function activeCount() {
      const docs = await LicenseActivation.find({ status: 'active' });
      return docs.length;
    }

    test('CASE 1: successful activation keeps counter and active activation consistent', async () => {
      await seedLicense({ maxActivations: 2 });
      const activation = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });

      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(1);
      expect(await activeCount()).toBe(1);
      expect(activation.status).toBe('active');
    });

    test('CASE 2: slot reservation failure (limit reached) leaves counter and activations unchanged', async () => {
      await seedLicense({ maxActivations: 1 });
      await activationService.activateLicense({ licenseId: 'lic-1', domain: 'a.com', fingerprintHash: 'fp-1' });

      await expect(
        activationService.activateLicense({ licenseId: 'lic-1', domain: 'b.com', fingerprintHash: 'fp-2' })
      ).rejects.toThrow('Activation limit reached');

      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(1);
      expect(await activeCount()).toBe(1);
    });

    test('CASE 3: activation-document creation failure rolls back the reserved slot', async () => {
      await seedLicense({ maxActivations: 2 });

      const createSpy = jest
        .spyOn(LicenseActivation, 'create')
        .mockRejectedValueOnce(new Error('simulated activation write failure'));

      await expect(
        activationService.activateLicense({ licenseId: 'lic-1', domain: 'a.com', fingerprintHash: 'fp-1' })
      ).rejects.toThrow('simulated activation write failure');

      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(0);
      expect(await activeCount()).toBe(0);

      createSpy.mockRestore();
    });

    test('CASE 4: event-creation failure after activation creation cannot leave an orphaned active activation', async () => {
      const eventService = require('../services/eventService');
      await seedLicense({ maxActivations: 2 });

      eventService.recordEvent.mockImplementationOnce(async ({ eventType }) => {
        if (eventType === 'LICENSE_ACTIVATED') {
          throw new Error('simulated event write failure');
        }
      });

      await expect(
        activationService.activateLicense({ licenseId: 'lic-1', domain: 'a.com', fingerprintHash: 'fp-1' })
      ).rejects.toThrow('simulated event write failure');

      // The critical invariant: counter and active-activation documents
      // must never disagree, even though the event write failed after
      // the activation document was created.
      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(await activeCount());
      expect(license.activeActivationCount).toBe(0);
      expect(await activeCount()).toBe(0);

      // A subsequent, correctly-behaving activation attempt must still
      // succeed cleanly (no leftover unique-index residue).
      eventService.recordEvent.mockResolvedValue(undefined);
      const retried = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'a.com',
        fingerprintHash: 'fp-1',
      });
      expect(retried.status).toBe('active');
      const licenseAfterRetry = await License.findOne({ licenseId: 'lic-1' });
      expect(licenseAfterRetry.activeActivationCount).toBe(1);
    });

    test('CASE 5: duplicate activation request does not increment the counter twice', async () => {
      await seedLicense({ maxActivations: 5 });
      const first = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });
      const second = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });

      expect(second.activationId).toBe(first.activationId);
      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(1);
      expect(await activeCount()).toBe(1);
    });

    test('CASE 6: concurrent activation attempts never exceed maxActivations and stay consistent', async () => {
      await seedLicense({ maxActivations: 1 });

      const attempts = Array.from({ length: 5 }, (_, i) =>
        activationService
          .activateLicense({ licenseId: 'lic-1', domain: `d${i}.com`, fingerprintHash: `fp-${i}` })
          .catch((err) => ({ failed: true, message: err.message }))
      );
      const results = await Promise.all(attempts);
      const succeeded = results.filter((r) => !r.failed);
      expect(succeeded.length).toBe(1);

      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(1);
      expect(await activeCount()).toBe(1);
    });

    test('CASE 7: replaying activation via the idempotency layer does not mutate activation state again', async () => {
      // This exercises the activationService side directly: calling
      // activateLicense a second time with the exact same
      // domain+fingerprint (as a replayed protocol request would,
      // since the controller's idempotency claim would normally short
      // circuit before ever reaching here) must not double-count.
      await seedLicense({ maxActivations: 5 });
      const first = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });

      const replayed = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });

      expect(replayed.activationId).toBe(first.activationId);
      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(1);
    });

    test('deactivate still decrements the counter correctly after the transactional refactor', async () => {
      await seedLicense({ maxActivations: 1 });
      const activation = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });

      await activationService.deactivateActivation({
        licenseId: 'lic-1',
        activationId: activation.activationId,
      });

      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(0);
      expect(await activeCount()).toBe(0);
    });
  });

  describe('PART 3A-FIX-3: transaction/duplicate-key safety audit', () => {
    async function activeCount() {
      const docs = await LicenseActivation.find({ status: 'active' });
      return docs.length;
    }

    test('a unique-index race (duplicate key) resolves to the winning activation without a session, with no double-count', async () => {
      await seedLicense({ maxActivations: 5 });

      // Simulate a concurrent winner: LicenseActivation.create throws a
      // duplicate-key error, but the "winning" document already exists
      // when we look it up afterwards.
      const winnerId = 'winner-activation-id';
      const createSpy = jest.spyOn(LicenseActivation, 'create').mockImplementationOnce(async () => {
        // Simulate the concurrent winner's own request path: it
        // reserved its own slot (counter +1) and created its own
        // document before we hit the unique-index collision.
        await activationService.reserveActivationSlot('lic-1');
        await LicenseActivation.create({
          activationId: winnerId,
          licenseId: 'lic-1',
          domain: 'example.com',
          fingerprintHash: 'fp-1',
          status: 'active',
          activatedAt: new Date(),
          lastSeenAt: new Date(),
        });
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      });

      const result = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });

      expect(result.activationId).toBe(winnerId);

      // Our own reservation must have been released — only the
      // winner's slot remains counted, never double-reserved.
      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(1);
      expect(await activeCount()).toBe(1);

      createSpy.mockRestore();
    });

    test('a duplicate-key error never triggers a second increment or a second active document', async () => {
      await seedLicense({ maxActivations: 5 });

      const winnerId = 'winner-2';
      const createSpy = jest.spyOn(LicenseActivation, 'create').mockImplementationOnce(async () => {
        // Simulate the concurrent winner's own request path: it
        // reserved its own slot (counter +1) before creating its
        // document, exactly like a real competing request would.
        await activationService.reserveActivationSlot('lic-1');
        await LicenseActivation.create({
          activationId: winnerId,
          licenseId: 'lic-1',
          domain: 'race.com',
          fingerprintHash: 'fp-race',
          status: 'active',
          activatedAt: new Date(),
          lastSeenAt: new Date(),
        });
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      });

      await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'race.com',
        fingerprintHash: 'fp-race',
      });

      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(1);
      expect(await activeCount()).toBe(1);

      createSpy.mockRestore();
    });

    test('deactivate: an event-write failure restores the activation to active and re-increments the counter (no-session compensation)', async () => {
      const eventService = require('../services/eventService');
      await seedLicense({ maxActivations: 1 });
      const activation = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });

      eventService.recordEvent.mockImplementationOnce(async ({ eventType }) => {
        if (eventType === 'LICENSE_DEACTIVATED') {
          throw new Error('simulated deactivate event failure');
        }
      });

      await expect(
        activationService.deactivateActivation({ licenseId: 'lic-1', activationId: activation.activationId })
      ).rejects.toThrow('simulated deactivate event failure');

      // Compensation must have fully restored the pre-deactivate state.
      const restored = await LicenseActivation.findOne({ activationId: activation.activationId });
      expect(restored.status).toBe('active');

      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(1);
      expect(await activeCount()).toBe(1);

      // A retried deactivate (event now succeeding) must complete
      // cleanly from the restored state.
      eventService.recordEvent.mockResolvedValue(undefined);
      const retried = await activationService.deactivateActivation({
        licenseId: 'lic-1',
        activationId: activation.activationId,
      });
      expect(retried.status).toBe('deactivated');
      const licenseAfterRetry = await License.findOne({ licenseId: 'lic-1' });
      expect(licenseAfterRetry.activeActivationCount).toBe(0);
    });

    test('repeated deactivate never decrements the counter twice, even across a retried failure', async () => {
      await seedLicense({ maxActivations: 1 });
      const activation = await activationService.activateLicense({
        licenseId: 'lic-1',
        domain: 'example.com',
        fingerprintHash: 'fp-1',
      });

      await activationService.deactivateActivation({ licenseId: 'lic-1', activationId: activation.activationId });
      await activationService.deactivateActivation({ licenseId: 'lic-1', activationId: activation.activationId });
      await activationService.deactivateActivation({ licenseId: 'lic-1', activationId: activation.activationId });

      const license = await License.findOne({ licenseId: 'lic-1' });
      expect(license.activeActivationCount).toBe(0);
    });
  });
});
