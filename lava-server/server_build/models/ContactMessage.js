const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 254,
    default: '',
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 5000,
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied', 'archived'],
    default: 'unread',
    index: true,
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

contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ email: 1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
