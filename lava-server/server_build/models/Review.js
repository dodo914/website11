const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  name: {
    type: String,
    trim: true,
    maxlength: 120,
    default: '',
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'rating must be an integer between 1 and 5',
    },
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 2000,
  },
  image: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  verifiedPurchase: {
    type: Boolean,
    default: false,
  },
  legacyId: {
    type: String,
    default: null,
    select: false,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false },
});

reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ productId: 1, customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);