
const mongoose = require('mongoose');

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

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false
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

module.exports = mongoose.model('User', userSchema);
