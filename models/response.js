const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
  roundId: { type: mongoose.Schema.Types.ObjectId, ref: "Round" },
  userEmpId: { type: String, required: true },
  userName: { type: String, required: true },
  answer: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
  timeTaken: { type: Number, required: true },
});

// Adding a compound unique index
responseSchema.index({ questionId: 1, userEmpId: 1 }, { unique: true });

const Response = mongoose.model("Response", responseSchema);

module.exports = Response;
