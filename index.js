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
          round.isActive = true; // Set the round itself as active

          round.save().then(() => {
            io.emit("questionActivated", {
              roundId: round._id,
              roundNumber: round.roundNumber,
              question: round.questions[questionIndex],
              questionIndex,
              isActive: round.isActive,
              timeLimit: 5, // seconds
            });

            // Set a timer to deactivate the question after the time limit
            setTimeout(() => {
              round.questions[questionIndex].isActive = false;
              round.isActive = false; // Optionally deactivate the round when the question deactivates
              round.save().then(() => {
                io.emit("timeUp", { roundNumber, questionIndex });
                console.log("time is up and data is changed");
              });
            }, 15000); // 5 seconds
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

  if (type === "question") {
    // Leaderboard for a single question
    pipeline = [
      { $match: { questionId: new ObjectId(id), isCorrect: true } },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: "$userEmail",
          name: { $first: "$userName" },
          earliestCorrect: { $first: "$timestamp" },
          totalPoints: { $sum: pointsPerCorrectAnswer }, // Assign points for each correct answer
        },
      },
      { $sort: { totalPoints: -1, earliestCorrect: 1 } },
    ];
  } else if (type === "round") {
    // Leaderboard for a single round
    pipeline = [
      { $match: { roundId: new ObjectId(id), isCorrect: true } },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: "$userEmail",
          name: { $first: "$userName" },
          correctAnswers: { $sum: 1 },
          totalPoints: { $sum: pointsPerCorrectAnswer },
          averageTime: { $avg: "$timestamp" },
        },
      },
      { $sort: { totalPoints: -1, averageTime: 1 } },
    ];
  } else if (type === "all") {
    // Leaderboard across all rounds
    pipeline = [
      { $match: { isCorrect: true } },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: "$userEmail",
          name: { $first: "$userName" },
          totalCorrectAnswers: { $sum: 1 },
          totalPoints: { $sum: pointsPerCorrectAnswer },
          averageTime: { $avg: "$timestamp" },
        },
      },
      { $sort: { totalPoints: -1, averageTime: 1 } },
    ];
  } else {
    throw new Error("Invalid leaderboard type specified");
  }

  // Add facet stage to split the pipeline into two parts:
  // 1. metadata: to count the total number of records
  // 2. data: to return the paginated results
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

server.listen(4000, () => {
  console.log("Listening on port 4000");
});
