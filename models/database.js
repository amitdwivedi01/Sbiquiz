const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  questionText: String,
  options: [String],
  correct: String,
  isActive: { type: Boolean, default: false },
});

const RoundSchema = new mongoose.Schema({
  roundNumber: Number,
  isActive: Boolean,
  questions: [QuestionSchema],
});

const Round = mongoose.model("Round", RoundSchema);

module.exports = Round;
