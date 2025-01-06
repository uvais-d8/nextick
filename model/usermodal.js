const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false
    },
    email: {
      type: String,
      required: true
    },

    googleId: {
      type: String,
      unique: true
    },
    password: {
      type: String,
      required: false
    },
    blocked: {
      type: Boolean,
      default: false
    },
    registered: {
      type: Date,
      default: Date.now
    },
    verified: {
      type: Boolean,
      default: false
    },
    phone: {
      type: Number,
      required: false
    },
    referralCode: {
      type: String,
      unique: true
    },
  },
  { timestamps: true }
);

const User = mongoose.model("user", userSchema);
module.exports = User;
