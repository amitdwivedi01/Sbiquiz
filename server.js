const mongoose = require("mongoose");
const Round = require("./models/database"); // Adjust this path to where your Round model is defined

mongoose.connect(
  "mongodb+srv://shyamdwivedi595:amit123@cluster0.rstxk8a.mongodb.net/?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

const seedRounds = [
  {
    roundNumber: 1,
    isActive: false,
    questions: [
      {
        questionText: "What is the capital of France?",
        options: ["Paris", "London", "Rome", "Berlin"],
        correct: "Paris",
        isActive: false,
      },
      {
        questionText: "What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        correct: "4",
        isActive: false,
      },
    ],
  },
  {
    roundNumber: 2,
    isActive: false,
    questions: [
      {
        questionText: "What color is the sky?",
        options: ["Blue", "Red", "Green", "Yellow"],
        correct: "Blue",
        isActive: false,
      },
      {
        questionText: "What is the largest ocean?",
        options: ["Atlantic", "Indian", "Arctic", "Pacific"],
        correct: "Pacific",
        isActive: false,
      },
    ],
  },
  {
    roundNumber: 3,
    isActive: false,
    questions: [
      {
        questionText: "Who wrote 'Hamlet'?",
        options: ["Shakespeare", "Dickens", "Austen", "Orwell"],
        correct: "Shakespeare",
        isActive: false,
      },
      {
        questionText: "What is the speed of light?",
        options: [
          "300,000 km/s",
          "150,000 km/s",
          "450,000 km/s",
          "600,000 km/s",
        ],
        correct: "300,000 km/s",
        isActive: false,
      },
    ],
  },
];

Round.insertMany(seedRounds)
  .then(() => {
    console.log("Rounds seeded successfully");
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error seeding rounds:", err);
    mongoose.disconnect();
  });
