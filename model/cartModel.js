const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "products",
    required: true
  },
  quantity: {
    type: Number,
    required: false,
    default: 1
  },
  priceWithDiscount: {
    type: Number,
    required: false
  },
  totalPrice: {
    type: Number,
    required: true
  }
});

const cartmodal = mongoose.model("cart", cartSchema);
module.exports = cartmodal;
