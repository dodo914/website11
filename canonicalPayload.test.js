'use strict';

const { buildCanonicalPayload } = require('../license/canonicalPayload');

describe('buildCanonicalPayload', () => {
  const base = {
    protocolVersion: 1,
    operation: 'VALIDATE',
    requestId: 'req-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    success: true,
    code: 'OK',
    data: { b: 2, a: 1 },
  };

  test('is deterministic regardless of key order in data', () => {
    const p1 = buildCanonicalPayload(base);
    const p2 = buildCanonicalPayload({ ...base, data: { a: 1, b: 2 } });
    expect(p1).toBe(p2);
  });

  test('differs when any signed field changes', () => {
    const p1 = buildCanonicalPayload(base);
    const p2 = buildCanonicalPayload({ ...base, code: 'FAIL' });
    expect(p1).not.toBe(p2);
  });

  test('does not include a message field even if passed extraneously', () => {
    const payload = buildCanonicalPayload({ ...base, message: 'should be ignored' });
    expect(payload).not.toContain('should be ignored');
  });

  test('defaults missing data to an empty object', () => {
    const payload = buildCanonicalPayload({ ...base, data: undefined });
    expect(JSON.parse(payload).data).toEqual({});
  });
});
