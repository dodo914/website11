'use strict';

const { assertNoSecrets } = require('../utils/assertNoSecrets');

describe('assertNoSecrets', () => {
  test('allows descriptive, non-sensitive metadata', () => {
    expect(() => assertNoSecrets({ domain: 'example.com', reason: 'limit reached' })).not.toThrow();
  });

  test('throws when a private key is present', () => {
    expect(() => assertNoSecrets({ privateKey: 'abc' })).toThrow();
  });

  test('throws when a password is present', () => {
    expect(() => assertNoSecrets({ password: 'hunter2' })).toThrow();
  });

  test('throws when a raw installationId is present', () => {
    expect(() => assertNoSecrets({ installationId: 'xyz' })).toThrow();
  });

  test('throws when a forbidden key is nested', () => {
    expect(() => assertNoSecrets({ context: { mongoUri: 'mongodb://...' } })).toThrow();
  });

  test('handles empty/undefined metadata safely', () => {
    expect(() => assertNoSecrets({})).not.toThrow();
    expect(() => assertNoSecrets(undefined)).not.toThrow();
  });
});
