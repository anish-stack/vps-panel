const mongoose = require('mongoose');
const crypto = require('crypto');

const serverSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Server name is required'],
      trim: true,
      maxlength: [100, 'Server name cannot exceed 100 characters'],
    },
    ip: {
      type: String,
      required: [true, 'Server IP is required'],
      trim: true,
      match: [
        /^(\d{1,3}\.){3}\d{1,3}$|^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
        'Please enter a valid IP address or hostname',
      ],
    },
    port: {
      type: Number,
      default: 7001,
      min: [1, 'Port must be >= 1'],
      max: [65535, 'Port must be <= 65535'],
    },
    apiKey: {
      type: String,
      required: true,
      select: false, // Don't return by default
    },
    apiKeyHash: {
      type: String,
      required: true,
    },
    apiKeyPrefix: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'unknown'],
      default: 'unknown',
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

// Generate API key static method
serverSchema.statics.generateApiKey = function () {
  const rawKey = crypto.randomBytes(32).toString('hex');
  const prefix = rawKey.substring(0, 8);
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, prefix, hash };
};

// Verify API key method
serverSchema.methods.verifyApiKey = function (key) {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return hash === this.apiKeyHash;
};

// Compound index: one IP per owner
serverSchema.index({ owner: 1, ip: 1 }, { unique: true });

module.exports = mongoose.model('Server', serverSchema);
