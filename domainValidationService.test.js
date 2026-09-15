'use strict';

const { isDomainAllowed } = require('../services/domainValidationService');

describe('domainValidationService.isDomainAllowed', () => {
  test('empty allowedDomains means unrestricted', () => {
    expect(isDomainAllowed([], 'anything.com')).toBe(true);
    expect(isDomainAllowed(undefined, 'anything.com')).toBe(true);
  });

  test('allows a normalized match', () => {
    expect(isDomainAllowed(['example.com'], 'https://www.example.com/')).toBe(true);
  });

  test('rejects a non-matching domain', () => {
    expect(isDomainAllowed(['example.com'], 'other.com')).toBe(false);
  });

  test('rejects empty request domain when restricted', () => {
    expect(isDomainAllowed(['example.com'], '')).toBe(false);
  });
});
