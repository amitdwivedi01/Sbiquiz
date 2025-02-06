const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const Round = require("./models/database");
const authRoutes = require("./routes/authRoutes");
const responseRoutes = require("./routes/responseRoutes");
const Response = require("./models/response");
const ObjectId = mongoose.Types.ObjectId;
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json()); // This line ensures that Express can parse JSON body data

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Restrict this in production
    methods: ["GET", "POST"],
  },
});

mongoose.connect(process.env.MONGO, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function seedDatabase() {
  try {
    const existingRounds = await Round.countDocuments();
    if (existingRounds === 0) {
      await Round.insertMany(seedRounds);
      console.log("Rounds seeded successfully");
    } else {
      console.log("Rounds already exist, skipping seeding");
    }
  } catch (error) {
    console.error("Error seeding rounds:", error);
  }
}

app.use("/api/auth", authRoutes);
app.use("/api/response", responseRoutes);

// Route to fetch all rounds and their questions
app.get("/rounds", (req, res) => {
  Round.find({})
    .then((rounds) => res.json(rounds))
    .catch((err) => res.status(500).json({ error: err.message }));
});

io.on("connection", (socket) => {
  socket.on("activateQuestion", ({ roundNumber, questionIndex }) => {
    Round.findOne({ roundNumber }).then((round) => {
      if (round && round.questions[questionIndex]) {
        // Deactivate all questions in all rounds initially
        Round.updateMany(
          {},
          { "questions.$[].isActive": false, isActive: false }
        ).then(() => {
          // Activate the specific round and question
          round.questions.forEach((q, idx) => {
            round.questions[idx].isActive = idx === questionIndex;
          });
          round.isActive = true;

          round.save().then(() => {
            io.emit("questionActivated", {
              roundId: round._id,
              roundNumber: round.roundNumber,
              question: round.questions[questionIndex],
              questionIndex,
              isActive: round.isActive,
              timeLimit: 15, // Initial time limit (seconds)
            });

            // Live countdown
            let remainingTime = 15;
            const countdownInterval = setInterval(() => {
              remainingTime -= 1;
              io.emit("updateTimer", {
                roundNumber,
                questionIndex,
                remainingTime,
              });

              if (remainingTime <= 0) {
                clearInterval(countdownInterval);
                round.questions[questionIndex].isActive = false;
                round.isActive = false;
                round.save().then(() => {
                  io.emit("timeUp", { roundNumber, questionIndex });
                });
              }
            }, 1000); // Emit every second
          });
        });
      }
    });
  });

  socket.on("requestLeaderboard", async ({ type, id }) => {
    const leaderboard = await calculateLeaderboard(type, id);
    io.emit("updateLeaderboard", leaderboard);
  });
});

async function calculateLeaderboard(type, id, page = 1, limit = 30) {
  const pointsPerCorrectAnswer = 5; // Points awarded for each correct answer
  const skip = (page - 1) * limit;
  let pipeline = [];

  if (type === "round") {
    // Get total number of questions in the round
    const round = await Round.findById(id);
    const totalQuestions = round ? round.questions.length : 0;

    // Leaderboard for a single round (only users who answered all questions correctly)
    pipeline = [
      { $match: { roundId: new mongoose.Types.ObjectId(id), isCorrect: true } },
      {
        $group: {
          _id: "$userEmpId",
          name: { $first: "$userName" },
          correctAnswers: { $sum: 1 },
          totalPoints: { $sum: pointsPerCorrectAnswer },
          timeTaken: { $sum: "$timeTaken" }, // Sum total time taken
        },
      },
      {
        $match: { correctAnswers: totalQuestions }, // Ensure user answered all questions correctly
      },
      { $sort: { timeTaken: 1 } }, // Sort by time taken (lower is better)
    ];
  } else if (type === "all") {
    // Get total number of questions across all rounds
    const rounds = await Round.find({}, "questions");
    const totalQuestions = rounds.reduce(
      (sum, round) => sum + round.questions.length,
      0
    );

    // Leaderboard across all rounds (only users who answered all questions correctly)
    pipeline = [
      { $match: { isCorrect: true } },
      {
        $group: {
          _id: "$userEmpId",
          name: { $first: "$userName" },
          totalCorrectAnswers: { $sum: 1 },
          totalPoints: { $sum: pointsPerCorrectAnswer },
          timeTaken: { $sum: "$timeTaken" },
        },
      },
      {
        $match: { totalCorrectAnswers: totalQuestions }, // Ensure user answered all questions correctly
      },
      { $sort: { timeTaken: 1 } }, // Sort by time taken (lower is better)
    ];
  } else if (type === "question") {
    // Leaderboard for a single question
    pipeline = [
      {
        $match: {
          questionId: new mongoose.Types.ObjectId(id),
          isCorrect: true,
        },
      },
      {
        $group: {
          _id: "$userEmpId",
          name: { $first: "$userName" },
          timeTaken: { $min: "$timeTaken" }, // Fastest correct answer
          totalPoints: { $sum: pointsPerCorrectAnswer },
        },
      },
      { $sort: { timeTaken: 1 } }, // Sort by fastest correct answer
    ];
  } else {
    throw new Error("Invalid leaderboard type specified");
  }

  // **Pagination**
  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [{ $skip: skip }, { $limit: limit }],
    },
  });

  const results = await Response.aggregate(pipeline);

  // Extract total count from metadata (if none, default to 0)
  const total =
    results[0].metadata.length > 0 ? results[0].metadata[0].total : 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: results[0].data,
    totalPages,
    currentPage: page,
    totalRecords: total,
  };
}

module.exports = calculateLeaderboard;

server.listen(4000, () => {
  console.log("Listening on port 4000");
});
