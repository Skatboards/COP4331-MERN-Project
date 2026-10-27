
const mongoose = require('mongoose');

const boardAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true
    },

    clicks: {
      type: Number,
      default: 0,
      min: 0
    },

    completed: {
      type: Boolean,
      default: false
    },

    efficiency: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    status: {
      type: String,
      enum: ['in_progress', 'won', 'lost'],
      default: 'in_progress'
    },

    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'boardAttempts',
    timestamps: true,
    versionKey: false
  }
);

// One attempt per user per board
boardAttemptSchema.index(
  { userId: 1, boardId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'BoardAttempt',
  boardAttemptSchema
);
