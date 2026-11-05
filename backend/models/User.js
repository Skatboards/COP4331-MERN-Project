
const mongoose = require('mongoose');
const { PROVIDERS } = require('../lib/oauth');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      default: '',
      trim: true
    },

    lastName: {
      type: String,
      default: '',
      trim: true
    },

    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true
    },

    // Empty for users who only sign in with GitHub or Google; they can add a
    // password through "forgot password"
    passwordHash: {
      type: String,
      select: false
    },

    // GitHub and Google accounts linked to this user. Left out (rather than
    // empty) when there are none, so the unique index below skips the user.
    oauthAccounts: {
      type: [
        {
          _id: false,
          provider: { type: String, enum: Object.keys(PROVIDERS), required: true },
          providerId: { type: String, required: true }
        }
      ],
      default: undefined
    },

    // Set to true once the user follows the link in the verification email
    emailVerified: {
      type: Boolean,
      default: false
    },

    // Only SHA-256 hashes of the emailed tokens are stored, so a database
    // leak does not hand out working verification or reset links
    emailVerificationTokenHash: {
      type: String,
      default: null,
      select: false
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false
    },

    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false
    },

    totalClicks: {
      type: Number,
      default: 0,
      min: 0
    },

    boardsCompleted: {
      type: Number,
      default: 0,
      min: 0
    },

    efficiency: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  {
    collection: 'users',
    timestamps: true,
    versionKey: false
  }
);

// One user per GitHub or Google account
userSchema.index(
  { 'oauthAccounts.provider': 1, 'oauthAccounts.providerId': 1 },
  { unique: true, partialFilterExpression: { oauthAccounts: { $exists: true } } }
);

module.exports = mongoose.model('User', userSchema);
