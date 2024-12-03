const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  products: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "products",
    required: true,
  }
});

const wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports = wishlist;
