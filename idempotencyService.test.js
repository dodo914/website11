'use strict';

jest.mock('../models/ProcessedRequest', () => ({
  ProcessedRequest: require('./helpers/fakeModel').__sharedProcessedRequestModel,
}));

describe('idempotencyService', () => {
  let idempotencyService;
  let ProcessedRequest;

  beforeEach(() => {
    jest.resetModules();
    const { __sharedProcessedRequestModel } = require('./helpers/fakeModel');
    __sharedProcessedRequestModel.reset();
    ProcessedRequest = __sharedProcessedRequestModel;
    idempotencyService = require('../services/idempotencyService');
  });

  const key = { requestId: 'req-1', operation: 'ACTIVATE', licenseContext: 'lic-1' };

  test('claims a brand-new requestId', async () => {
    const claim = await idempotencyService.claimRequest(key);
    expect(claim.claimed).toBe(true);
  });

  test('completing a claim persists the response for later replay', async () => {
    await idempotencyService.claimRequest(key);
    const response = { protocolVersion: 1, success: true, code: 'OK' };
    await idempotencyService.completeRequest({ requestId: key.requestId, response });

    const second = await idempotencyService.claimRequest(key);
    expect(second.claimed).toBe(false);
    expect(second.response).toEqual(response);
  });

  test('same requestId + same operation + same license is treated as a duplicate, not re-executed', async () => {
    await idempotencyService.claimRequest(key);
    await idempotencyService.completeRequest({
      requestId: key.requestId,
      response: { success: true },
    });

    const dup = await idempotencyService.claimRequest({ ...key });
    expect(dup.claimed).toBe(false);
  });

  test('same requestId reused for a different operation is rejected as a conflict', async () => {
    await idempotencyService.claimRequest(key);
    await idempotencyService.completeRequest({ requestId: key.requestId, response: { success: true } });

    await expect(
      idempotencyService.claimRequest({ ...key, operation: 'DEACTIVATE' })
    ).rejects.toThrow(idempotencyService.IdempotencyConflictError);
  });

  test('same requestId reused for a different licenseContext is rejected as a conflict', async () => {
    await idempotencyService.claimRequest(key);
    await idempotencyService.completeRequest({ requestId: key.requestId, response: { success: true } });

    await expect(
      idempotencyService.claimRequest({ ...key, licenseContext: 'lic-2' })
    ).rejects.toThrow(idempotencyService.IdempotencyConflictError);
  });

  test('same requestId reused for a different activationContext is rejected as a conflict', async () => {
    const hbKey = { requestId: 'req-hb', operation: 'HEARTBEAT', licenseContext: 'lic-1', activationContext: 'act-1' };
    await idempotencyService.claimRequest(hbKey);
    await idempotencyService.completeRequest({ requestId: hbKey.requestId, response: { success: true } });

    await expect(
      idempotencyService.claimRequest({ ...hbKey, activationContext: 'act-2' })
    ).rejects.toThrow(idempotencyService.IdempotencyConflictError);
  });

  test('a second concurrent claim on a still-processing requestId is reported as busy, not executed', async () => {
    await idempotencyService.claimRequest(key);
    // Still RECEIVED (never completed/failed) — a fresh concurrent
    // claim must not proceed and must not silently succeed.
    await expect(idempotencyService.claimRequest({ ...key })).rejects.toThrow(
      idempotencyService.IdempotencyBusyError
    );
  }, 10000);

  test('a failed claim can be safely reclaimed and retried', async () => {
    await idempotencyService.claimRequest(key);
    await idempotencyService.failRequest({ requestId: key.requestId });

    const retry = await idempotencyService.claimRequest({ ...key });
    expect(retry.claimed).toBe(true);
  });

  test('a stale abandoned RECEIVED claim can be reclaimed instead of deadlocking forever', async () => {
    await idempotencyService.claimRequest(key);
    // Simulate a crashed process: back-date claimedAt beyond the
    // staleness window instead of waiting for it in real time.
    const doc = ProcessedRequest.docs.find((d) => d.requestId === key.requestId);
    doc.claimedAt = new Date(Date.now() - idempotencyService.PROCESSING_STALE_MS - 1000);

    const reclaimed = await idempotencyService.claimRequest({ ...key });
    expect(reclaimed.claimed).toBe(true);
  });

  test('the ProcessedRequest unique index is enforced on requestId alone', async () => {
    await ProcessedRequest.create({
      requestId: 'req-unique',
      operation: 'ACTIVATE',
      licenseContext: 'lic-1',
      status: 'RECEIVED',
      claimedAt: new Date(),
    });

    await expect(
      ProcessedRequest.create({
        requestId: 'req-unique',
        operation: 'DEACTIVATE',
        licenseContext: 'lic-9',
        status: 'RECEIVED',
        claimedAt: new Date(),
      })
    ).rejects.toMatchObject({ code: 11000 });
  });
});
