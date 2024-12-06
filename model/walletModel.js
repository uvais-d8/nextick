const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: [
    {
      type: {
        type: String,
        enum: ["refund", "debit", "credit"],
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      description: {
        type: String
      },
      date: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
const Wallet = mongoose.model("Wallet", WalletSchema);
module.exports = Wallet;
