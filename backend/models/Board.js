
const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
  {
    seed: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    totalAttempts: {
      type: Number,
      default: 0,
      min: 0
    },

    totalCompletions: {
      type: Number,
      default: 0,
      min: 0
    },

    globalCompletionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    averageClicks: {
      type: Number,
      default: 0,
      min: 0
    },

    averageEfficiency: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  {
    collection: 'boards',
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.model('Board', boardSchema);
