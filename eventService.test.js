'use strict';

jest.mock('../models/LicenseEvent', () => ({
  LicenseEvent: require('./helpers/fakeModel').__sharedEventModel,
}));

describe('eventService.recordEvent', () => {
  let eventService;
  let LicenseEvent;

  beforeEach(() => {
    jest.resetModules();
    const { __sharedEventModel } = require('./helpers/fakeModel');
    __sharedEventModel.reset();
    LicenseEvent = __sharedEventModel;
    eventService = require('../services/eventService');
  });

  test('persists a well-formed event', async () => {
    await eventService.recordEvent({
      eventType: 'LICENSE_CREATED',
      licenseId: 'lic-1',
      metadata: { note: 'created via test' },
    });

    const events = await LicenseEvent.find({ licenseId: 'lic-1' });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('LICENSE_CREATED');
  });

  test('refuses to persist an event whose metadata contains a secret', async () => {
    await expect(
      eventService.recordEvent({
        eventType: 'SUSPICIOUS_ACTIVITY',
        licenseId: 'lic-1',
        metadata: { privateKey: 'leaked' },
      })
    ).rejects.toThrow();

    const events = await LicenseEvent.find({ licenseId: 'lic-1' });
    expect(events).toHaveLength(0);
  });
});
