const express = require("express");
const User = require("../models/User"); // Adjust path as necessary
const Round = require("../models/database");
const Response = require("../models/response");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const router = express.Router();

router.post("/submit-answer", async (req, res) => {
  const { questionId, userEmpId, answer, userName, timeTaken } = req.body;
  try {
    // Use aggregation to unwind the questions and match the specific question
    const results = await Round.aggregate([
      { $unwind: "$questions" },
      { $match: { "questions._id": new ObjectId(questionId) } },
      { $project: { questions: 1, roundNumber: 1 } }, // project only the questions and roundNumber if needed
    ]);

    if (results.length === 0) return res.status(404).send("Question not found");

    const question = results[0].questions; // As we expect only one question to match

    // Check if the answer is correct
    const isCorrect = question.correct === answer;

    // Optionally, determine roundId if needed from the results
    const roundId = results[0]._id; // If you need roundId for response recording

    // Create and save the response
    const newResponse = new Response({
      questionId,
      roundId,
      userEmpId,
      userName,
      answer,
      isCorrect,
      timeTaken,
    });

    await newResponse.save();
    res.json({ isCorrect, message: "Response recorded" });
  } catch (error) {
    if (error.name === "MongoError" || error.code === 11000) {
      // This is a duplicate key error, which means the user has already submitted a response
      console.error("Duplicate response submission:", error);
      res
        .status(409)
        .send("You have already submitted a response for this question.");
    } else {
      // Log and send generic error message
      console.error("Error processing answer:", error);
      res.status(500).send("Error processing answer");
    }
  }
});

// Route to fetch the currently active question
router.get("/active-question", async (req, res) => {
  try {
    // Find the first round that has an active question
    const round = await Round.findOne(
      { "questions.isActive": true },
      { "questions.$": 1 }
    ).exec();
    if (!round) {
      return res.status(404).json({ message: "No active question available." });
    }

    // Extract the active question from the round
    const activeQuestion = round.questions[0]; // Assuming that $ projection returns the active question as the first element
    res.json(activeQuestion);
  } catch (error) {
    console.error("Failed to fetch active question:", error);
    res.status(500).send("Server error while fetching active question");
  }
});

module.exports = router;
