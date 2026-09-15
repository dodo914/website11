'use strict';

const { normalizeDomain } = require('../utils/normalizeDomain');

describe('normalizeDomain', () => {
  test('lowercases the domain', () => {
    expect(normalizeDomain('Example.COM')).toBe('example.com');
  });

  test('strips protocol', () => {
    expect(normalizeDomain('https://example.com')).toBe('example.com');
    expect(normalizeDomain('http://example.com')).toBe('example.com');
  });

  test('strips www prefix', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });

  test('strips path/query/hash', () => {
    expect(normalizeDomain('example.com/path?query=1#hash')).toBe('example.com');
  });

  test('strips port', () => {
    expect(normalizeDomain('example.com:8080')).toBe('example.com');
  });

  test('strips trailing dot', () => {
    expect(normalizeDomain('example.com.')).toBe('example.com');
  });

  test('handles combined cases identically', () => {
    expect(normalizeDomain('https://www.Example.com:443/foo')).toBe('example.com');
  });

  test('returns empty string for falsy input', () => {
    expect(normalizeDomain('')).toBe('');
    expect(normalizeDomain(undefined)).toBe('');
  });
});
