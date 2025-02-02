const express = require("express");
const User = require("../models/User"); // Adjust path as necessary

const router = express.Router();

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).send("Email already in use.");
    }
    const user = new User({ name, email, phone });
    await user.save();
    res
      .status(201)
      .send({ message: "User registered successfully", user: user });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to register user", error: error.message });
  }
});

// Simple login route to check if user exists
router.post("/login", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).send("User not found.");
  }
  res.status(200).send({ message: "User logged in successfully", user: user });
});

module.exports = router;
