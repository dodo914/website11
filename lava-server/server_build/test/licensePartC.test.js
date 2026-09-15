const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const licenseMiddleware = require(path.join(root, 'middleware/licenseMiddleware.js'));
const licenseService = require(path.join(root, 'services/license/licenseService.js'));
const License = require(path.join(root, 'models/License.js'));
const {
  hasLicensedFeature,
  isKnownFeature,
  KNOWN_FEATURES,
} = require(path.join(root, 'services/license/featureEntitlementService.js'));
const {
  LicenseExpiredError,
  LicenseRevokedError,
  LicenseSuspendedError,
} = require(path.join(root, 'services/license/licenseErrors.js'));

// ============================================================
// نفس فلسفة test/licensePartB.test.js: من غير اتصال حقيقي بـMongoDB.
// licenseService.validateLocalLicense و License.findOne بيتعملهم mock
// مؤقت (بيترجعوا لأصلهم في finally/بعد كل تست) عشان نختبر الـmiddleware
// منعزلة عن الداتابيز.
// ============================================================

function makeReqResNext() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  return { req: {}, res, next, wasNextCalled: () => nextCalled };
}

async function withEnv(key, value, fn) {
  const original = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
}

function mockValidateLocalLicense(impl) {
  const original = licenseService.validateLocalLicense;
  licenseService.validateLocalLicense = impl;
  return () => {
    licenseService.validateLocalLicense = original;
  };
}

function mockLicenseFindOne(impl) {
  const original = License.findOne;
  License.findOne = impl;
  return () => {
    License.findOne = original;
  };
}

// ---------- 1: LICENSE_ENABLED=false allows the request ----------

test('licenseMiddleware: LICENSE_ENABLED=false -> requireValidLicense() allows the request without touching the DB', async () => {
  await withEnv('LICENSE_ENABLED', 'false', async () => {
    let dbWasCalled = false;
    const restore = mockValidateLocalLicense(async () => {
      dbWasCalled = true;
    });
    const { req, res, next, wasNextCalled } = makeReqResNext();
    try {
      await licenseMiddleware.requireValidLicense()(req, res, next);
    } finally {
      restore();
    }
    assert.equal(wasNextCalled(), true);
    assert.equal(res.statusCode, null);
    assert.equal(dbWasCalled, false, 'when disabled, license check must not run at all');
  });
});

test('licenseMiddleware: unset LICENSE_ENABLED defaults to non-blocking (false)', async () => {
  await withEnv('LICENSE_ENABLED', undefined, async () => {
    const { req, res, next, wasNextCalled } = makeReqResNext();
    await licenseMiddleware.requireValidLicense()(req, res, next);
    assert.equal(wasNextCalled(), true);
    assert.equal(res.statusCode, null);
  });
});

// ---------- 2: active license allows ----------

test('licenseMiddleware: enforcement on + active license -> allows the request', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-ACTIVE-1', async () => {
      const restore = mockValidateLocalLicense(async () => ({ status: 'active' }));
      const { req, res, next, wasNextCalled } = makeReqResNext();
      try {
        await licenseMiddleware.requireValidLicense()(req, res, next);
      } finally {
        restore();
      }
      assert.equal(wasNextCalled(), true);
      assert.equal(res.statusCode, null);
    });
  });
});

// ---------- 3: expired license rejected when enforcement enabled ----------

test('licenseMiddleware: enforcement on + expired license -> rejected with LICENSE_EXPIRED, next() not called', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-EXPIRED-1', async () => {
      const restore = mockValidateLocalLicense(async () => {
        throw new LicenseExpiredError({ licenseId: 'LIC-EXPIRED-1' });
      });
      const { req, res, next, wasNextCalled } = makeReqResNext();
      try {
        await licenseMiddleware.requireValidLicense()(req, res, next);
      } finally {
        restore();
      }
      assert.equal(wasNextCalled(), false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'LICENSE_EXPIRED');
    });
  });
});

// ---------- 4: revoked license rejected ----------

test('licenseMiddleware: enforcement on + revoked license -> rejected with LICENSE_REVOKED', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-REVOKED-1', async () => {
      const restore = mockValidateLocalLicense(async () => {
        throw new LicenseRevokedError({ licenseId: 'LIC-REVOKED-1' });
      });
      const { req, res, next, wasNextCalled } = makeReqResNext();
      try {
        await licenseMiddleware.requireValidLicense()(req, res, next);
      } finally {
        restore();
      }
      assert.equal(wasNextCalled(), false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'LICENSE_REVOKED');
    });
  });
});

// ---------- 5: suspended license rejected ----------

test('licenseMiddleware: enforcement on + suspended license -> rejected with LICENSE_SUSPENDED', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-SUSPENDED-1', async () => {
      const restore = mockValidateLocalLicense(async () => {
        throw new LicenseSuspendedError({ licenseId: 'LIC-SUSPENDED-1' });
      });
      const { req, res, next, wasNextCalled } = makeReqResNext();
      try {
        await licenseMiddleware.requireValidLicense()(req, res, next);
      } finally {
        restore();
      }
      assert.equal(wasNextCalled(), false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'LICENSE_SUSPENDED');
    });
  });
});

// ---------- 6: feature entitlement ----------

test('licenseMiddleware: requireFeature() allows when the license has the feature', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-FEAT-1', async () => {
      const restoreValidate = mockValidateLocalLicense(async () => ({ status: 'active' }));
      // License.findOne(...).lean() chain - mock returns an object with .lean()
      const restoreFind = mockLicenseFindOne(() => ({ lean: async () => ({ features: ['analytics', 'marketing'] }) }));

      const { req, res, next, wasNextCalled } = makeReqResNext();
      try {
        await licenseMiddleware.requireFeature('analytics')(req, res, next);
      } finally {
        restoreValidate();
        restoreFind();
      }
      assert.equal(wasNextCalled(), true);
      assert.equal(res.statusCode, null);
    });
  });
});

test('licenseMiddleware: requireFeature() rejects when the license does not have the feature', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-FEAT-2', async () => {
      const restoreValidate = mockValidateLocalLicense(async () => ({ status: 'active' }));
      const restoreFind = mockLicenseFindOne(() => ({ lean: async () => ({ features: ['marketing'] }) }));

      const { req, res, next, wasNextCalled } = makeReqResNext();
      try {
        await licenseMiddleware.requireFeature('analytics')(req, res, next);
      } finally {
        restoreValidate();
        restoreFind();
      }
      assert.equal(wasNextCalled(), false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'FEATURE_NOT_LICENSED');
    });
  });
});

// ---------- 7: invalid/unknown feature ----------

test('featureEntitlementService: unknown feature name is never entitled, even if present in license.features by mistake', () => {
  assert.equal(isKnownFeature('not-a-real-feature'), false);
  assert.equal(hasLicensedFeature({ features: ['not-a-real-feature'] }, 'not-a-real-feature'), false);
});

test('featureEntitlementService: every KNOWN_FEATURES entry is entitled when present on the license', () => {
  for (const feature of KNOWN_FEATURES) {
    assert.equal(hasLicensedFeature({ features: [feature] }, feature), true);
  }
});

test('featureEntitlementService: hasLicensedFeature is false for a null/missing license', () => {
  assert.equal(hasLicensedFeature(null, 'analytics'), false);
  assert.equal(hasLicensedFeature({}, 'analytics'), false);
});

// ---------- 8: no secrets in license status / error responses ----------

test('licenseMiddleware: rejection responses only ever contain {code, message} - no secrets/internal fields', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-SAFE-1', async () => {
      const restore = mockValidateLocalLicense(async () => {
        throw new LicenseExpiredError({ licenseId: 'LIC-SAFE-1', internalDbHost: 'should-never-leak' });
      });
      const { req, res, next } = makeReqResNext();
      try {
        await licenseMiddleware.requireValidLicense()(req, res, next);
      } finally {
        restore();
      }
      assert.deepEqual(Object.keys(res.body).sort(), ['code', 'message']);
      assert.ok(!JSON.stringify(res.body).includes('should-never-leak'));
    });
  });
});

// ---------- 9: middleware does not expose internal errors ----------

test('licenseMiddleware: an unexpected internal error (e.g. DB failure) never leaks err.message - generic response only', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-INTERNAL-1', async () => {
      const restore = mockValidateLocalLicense(async () => {
        throw new Error('connection refused at mongodb://internal-host:27017 - secret detail');
      });
      const { req, res, next, wasNextCalled } = makeReqResNext();
      try {
        await licenseMiddleware.requireValidLicense()(req, res, next);
      } finally {
        restore();
      }
      assert.equal(wasNextCalled(), false);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.code, 'LICENSE_CHECK_FAILED');
      assert.ok(!JSON.stringify(res.body).includes('mongodb://'));
      assert.ok(!JSON.stringify(res.body).includes('internal-host'));
    });
  });
});

test('licenseMiddleware: missing LICENSE_ID while enforcement is enabled is rejected safely (INVALID_LICENSE, no crash)', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', undefined, async () => {
      const { req, res, next, wasNextCalled } = makeReqResNext();
      await licenseMiddleware.requireValidLicense()(req, res, next);
      assert.equal(wasNextCalled(), false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'INVALID_LICENSE');
    });
  });
});

test('licenseMiddleware: requireLicenseType() allows a matching type and rejects a non-matching one', async () => {
  await withEnv('LICENSE_ENABLED', 'true', async () => {
    await withEnv('LICENSE_ID', 'LIC-TYPE-1', async () => {
      const restoreValidate = mockValidateLocalLicense(async () => ({ status: 'active' }));

      // matching type
      let restoreFind = mockLicenseFindOne(() => ({ lean: async () => ({ type: 'enterprise' }) }));
      let ctx = makeReqResNext();
      try {
        await licenseMiddleware.requireLicenseType('enterprise', 'source-code')(ctx.req, ctx.res, ctx.next);
      } finally {
        restoreFind();
      }
      assert.equal(ctx.wasNextCalled(), true);

      // non-matching type
      restoreFind = mockLicenseFindOne(() => ({ lean: async () => ({ type: 'standard' }) }));
      ctx = makeReqResNext();
      try {
        await licenseMiddleware.requireLicenseType('enterprise', 'source-code')(ctx.req, ctx.res, ctx.next);
      } finally {
        restoreFind();
        restoreValidate();
      }
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.body.code, 'LICENSE_TYPE_NOT_ALLOWED');
    });
  });
});

test('licenseMiddleware: is not wired into any existing route file (foundation only, per scope)', () => {
  const fs = require('node:fs');
  const routesDir = path.join(root, 'routes');
  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'));
  for (const file of routeFiles) {
    const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
    assert.ok(
      !source.includes('licenseMiddleware'),
      `${file} must not reference licenseMiddleware yet (PART 1C is foundation-only)`
    );
  }
});