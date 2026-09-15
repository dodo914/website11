'use strict';

/**
 * A minimal in-memory stand-in for the subset of the Mongoose Model API
 * that our services use. This lets service-layer tests (activation
 * limits, concurrency, idempotency, duplicate handling) run fully
 * offline without a real MongoDB instance, per STEP 15's "do not make
 * tests depend on a real external service."
 *
 * It intentionally reimplements just enough Mongo semantics to be a
 * faithful test double:
 *  - findOneAndUpdate with $set/$inc and a query filter (including a
 *    simple $expr $lt check, which is all activationService needs)
 *  - create() that enforces "unique" fields we register
 *  - findOne / updateOne / lean()
 */
class FakeModel {
  constructor({ uniqueFields = [] } = {}) {
    this.docs = [];
    this.uniqueFields = uniqueFields;
    this._autoInc = 0;
  }

  _matches(doc, filter) {
    return Object.entries(filter).every(([key, condition]) => {
      if (key === '$expr') {
        const [op, [leftPath, rightPath]] = [Object.keys(condition)[0], condition[Object.keys(condition)[0]]];
        const left = doc[leftPath.replace('$', '')];
        const right = doc[rightPath.replace('$', '')];
        if (op === '$lt') return left < right;
        throw new Error(`Unsupported $expr operator in fake model: ${op}`);
      }
      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        if ('$gt' in condition) return doc[key] > condition.$gt;
        if ('$gte' in condition) return doc[key] >= condition.$gte;
        if ('$lt' in condition) return doc[key] < condition.$lt;
        if ('$lte' in condition) return doc[key] <= condition.$lte;
        if ('$in' in condition) return condition.$in.includes(doc[key]);
        if ('$ne' in condition) return doc[key] !== condition.$ne;
      }
      return doc[key] === condition;
    });
  }

  findOne(filter = {}) {
    const found = this.docs.find((d) => this._matches(d, filter)) || null;
    const wrapped = found ? this._wrap(found) : null;

    // Return a thenable that also supports .lean() chaining, mirroring
    // the Mongoose query builder pattern used in the services under test.
    const query = {
      lean: () => Promise.resolve(wrapped),
      then: (resolve, reject) => Promise.resolve(wrapped).then(resolve, reject),
    };
    return query;
  }

  async findOneAndUpdate(filter, update, options = {}) {
    const idx = this.docs.findIndex((d) => this._matches(d, filter));
    if (idx === -1) return null;

    const doc = this.docs[idx];
    this._applyUpdate(doc, update);
    doc.updatedAt = new Date();

    return options.new === false ? this._wrap({ ...doc }) : this._wrap(doc);
  }

  async updateOne(filter, update, options = {}) {
    const idx = this.docs.findIndex((d) => this._matches(d, filter));
    if (idx === -1) {
      if (options.upsert) {
        const newDoc = { ...(update.$setOnInsert || {}), createdAt: new Date(), updatedAt: new Date() };
        this._checkUnique(newDoc);
        this.docs.push(newDoc);
        return { upsertedCount: 1, matchedCount: 0 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }
    this._applyUpdate(this.docs[idx], update);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async create(data) {
    this._checkUnique(data);
    const doc = { ...data, createdAt: new Date(), updatedAt: new Date() };
    this.docs.push(doc);
    return this._wrap(doc);
  }

  async deleteOne(filter = {}) {
    const idx = this.docs.findIndex((d) => this._matches(d, filter));
    if (idx === -1) return { deletedCount: 0 };
    this.docs.splice(idx, 1);
    return { deletedCount: 1 };
  }

  find(filter = {}) {
    const results = this.docs.filter((d) => this._matches(d, filter)).map((d) => this._wrap(d));
    let skipN = 0;
    let limitN = null;

    const query = {
      skip(n) {
        skipN = n;
        return query;
      },
      limit(n) {
        limitN = n;
        return query;
      },
      then(resolve, reject) {
        let out = results.slice(skipN);
        if (limitN != null) out = out.slice(0, limitN);
        return Promise.resolve(out).then(resolve, reject);
      },
    };
    return query;
  }

  async countDocuments(filter = {}) {
    return this.docs.filter((d) => this._matches(d, filter)).length;
  }

  _checkUnique(data) {
    for (const field of this.uniqueFields) {
      if (data[field] === undefined) continue;
      const clash = this.docs.find((d) => d[field] === data[field]);
      if (clash) {
        const err = new Error(`E11000 duplicate key error: ${field}`);
        err.code = 11000;
        throw err;
      }
    }
  }

  _applyUpdate(doc, update) {
    if (update.$set) Object.assign(doc, update.$set);
    if (update.$inc) {
      for (const [key, amount] of Object.entries(update.$inc)) {
        doc[key] = (doc[key] || 0) + amount;
      }
    }
  }

  _wrap(doc) {
    // Attach a no-op save()/lean() so callers written against Mongoose
    // documents work unmodified in tests.
    doc.save = async () => doc;
    doc.lean = () => doc;
    return doc;
  }

  reset() {
    this.docs = [];
  }
}

// Shared singleton fake models used by jest.mock() factories in test
// files. jest.mock factories are hoisted above local variable
// declarations, so tests reference these stable exports instead of
// per-file locals.
const __sharedLicenseModel = new FakeModel({ uniqueFields: ['licenseId'] });
const __sharedActivationModel = new FakeModel({ uniqueFields: ['activationId'] });
const __sharedEventModel = new FakeModel({ uniqueFields: [] });
const __sharedProcessedRequestModel = new FakeModel({ uniqueFields: ['requestId'] });

module.exports = {
  FakeModel,
  __sharedLicenseModel,
  __sharedActivationModel,
  __sharedEventModel,
  __sharedProcessedRequestModel,
};
