const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Settings = require('../models/Settings');
const Product = require('../models/Product');
const User = require('../models/User');
const Review = require('../models/Review');
const ContactMessage = require('../models/ContactMessage');

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

const asObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return value;
};

const migrateReviews = async (settings) => {
  const legacy = asObject(settings.productReviews);
  let sourceCount = 0;
  let migratedCount = 0;
  let skippedCount = 0;

  for (const [productId, rawReviews] of Object.entries(legacy)) {
    if (!isValidObjectId(productId) || !Array.isArray(rawReviews)) {
      skippedCount += Array.isArray(rawReviews) ? rawReviews.length : 0;
      continue;
    }

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      skippedCount += rawReviews.length;
      console.warn(`Skipping ${rawReviews.length} review(s): product ${productId} does not exist.`);
      continue;
    }

    for (let index = 0; index < rawReviews.length; index += 1) {
      const legacyReview = rawReviews[index] || {};
      sourceCount += 1;

      const legacyId = String(
        legacyReview.id ??
        `${productId}:${index}:${legacyReview.date || ''}:${legacyReview.rating || ''}:${legacyReview.comment || ''}`
      );

      const alreadyMigrated = await Review.exists({ productId, legacyId });
      if (alreadyMigrated) {
        continue;
      }

      let customerId = null;
      const possibleCustomerId = legacyReview.customerId || legacyReview.userId;
      if (possibleCustomerId && isValidObjectId(possibleCustomerId)) {
        const customer = await User.exists({ _id: possibleCustomerId, role: 'customer' });
        if (customer) customerId = possibleCustomerId;
      }

      const rating = Number(legacyReview.rating);
      const comment = String(legacyReview.comment || '').trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 3) {
        skippedCount += 1;
        console.warn(`Skipping invalid legacy review ${legacyId} for product ${productId}.`);
        continue;
      }

      const rawDate = legacyReview.createdAt || legacyReview.date;
      const createdAt = rawDate && !Number.isNaN(new Date(rawDate).getTime())
        ? new Date(rawDate)
        : new Date();

      await Review.create({
        productId,
        customerId,
        name: String(legacyReview.name || '').trim(),
        rating,
        comment,
        // Old reviews were visible immediately, so mark them approved to preserve
        // the storefront's existing behavior after migration.
        status: 'approved',
        verifiedPurchase: false,
        legacyId,
        createdAt,
        updatedAt: createdAt,
      });

      migratedCount += 1;
    }
  }

  const postCount = await Review.countDocuments({ legacyId: { $ne: null } });
  const verifySource = sourceCount - skippedCount;
  if (postCount < verifySource) {
    throw new Error(`Review migration verification failed: expected at least ${verifySource} migrated legacy reviews, found ${postCount}.`);
  }

  return { sourceCount, migratedCount, skippedCount, postCount };
};

const migrateContacts = async (settings) => {
  const legacyMessages = Array.isArray(settings.contactMessages) ? settings.contactMessages : [];
  let sourceCount = legacyMessages.length;
  let migratedCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < legacyMessages.length; index += 1) {
    const legacyMessage = legacyMessages[index] || {};
    const legacyId = String(
      legacyMessage.id ??
      `${index}:${legacyMessage.date || ''}:${legacyMessage.phone || ''}:${legacyMessage.message || ''}`
    );

    const alreadyMigrated = await ContactMessage.exists({ legacyId });
    if (alreadyMigrated) continue;

    const name = String(legacyMessage.name || '').trim();
    const phone = String(legacyMessage.phone || '').trim();
    const message = String(legacyMessage.message || '').trim();

    if (name.length < 2 || name.length > 120 || !phone || message.length < 3 || message.length > 5000) {
      skippedCount += 1;
      console.warn(`Skipping invalid legacy contact message ${legacyId}.`);
      continue;
    }

    const normalizedEmail = String(legacyMessage.email || '').trim().toLowerCase();
    const rawDate = legacyMessage.createdAt || legacyMessage.date;
    const createdAt = rawDate && !Number.isNaN(new Date(rawDate).getTime())
      ? new Date(rawDate)
      : new Date();

    await ContactMessage.create({
      name,
      email: normalizedEmail,
      phone,
      message,
      status: legacyMessage.status && ['unread', 'read', 'replied', 'archived'].includes(legacyMessage.status)
        ? legacyMessage.status
        : 'unread',
      legacyId,
      createdAt,
      updatedAt: createdAt,
    });

    migratedCount += 1;
  }

  const postCount = await ContactMessage.countDocuments({ legacyId: { $ne: null } });
  const verifySource = sourceCount - skippedCount;
  if (postCount < verifySource) {
    throw new Error(`Contact migration verification failed: expected at least ${verifySource} migrated legacy messages, found ${postCount}.`);
  }

  return { sourceCount, migratedCount, skippedCount, postCount };
};

const main = async () => {
  await connectDB();

  const settings = await Settings.findOne().lean();
  if (!settings) {
    console.log('No Settings document found. Nothing to migrate.');
    await mongoose.connection.close();
    return;
  }

  console.log('Starting safe migration. Legacy Settings data will NOT be deleted.');

  const reviewResult = await migrateReviews(settings);
  const contactResult = await migrateContacts(settings);

  // Final count verification against the legacy source.
  const legacyReviewCount = Object.values(asObject(settings.productReviews))
    .reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  const legacyContactCount = Array.isArray(settings.contactMessages) ? settings.contactMessages.length : 0;

  const migratedLegacyReviewCount = await Review.countDocuments({ legacyId: { $ne: null } });
  const migratedLegacyContactCount = await ContactMessage.countDocuments({ legacyId: { $ne: null } });

  console.log(JSON.stringify({
    reviews: {
      legacySourceCount: legacyReviewCount,
      processedSourceCount: reviewResult.sourceCount,
      insertedThisRun: reviewResult.migratedCount,
      skippedInvalidOrMissingProduct: reviewResult.skippedCount,
      verifiedMigratedLegacyCount: migratedLegacyReviewCount,
    },
    contactMessages: {
      legacySourceCount: legacyContactCount,
      processedSourceCount: contactResult.sourceCount,
      insertedThisRun: contactResult.migratedCount,
      skippedInvalid: contactResult.skippedCount,
      verifiedMigratedLegacyCount: migratedLegacyContactCount,
    },
    cleanup: 'NOT PERFORMED',
  }, null, 2));

  const expectedReviews = reviewResult.sourceCount - reviewResult.skippedCount;
  const expectedContacts = contactResult.sourceCount - contactResult.skippedCount;

  if (migratedLegacyReviewCount < expectedReviews || migratedLegacyContactCount < expectedContacts) {
    throw new Error('Migration verification failed. Legacy Settings data was intentionally left untouched.');
  }

  console.log('Migration verification passed. It is safe to keep legacy fields until manual cleanup is approved.');
  await mongoose.connection.close();
};

main().catch(async (err) => {
  console.error('Migration failed:', err);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exitCode = 1;
});
