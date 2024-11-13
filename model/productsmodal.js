const mongoose = require("mongoose");
const productsShema = new mongoose.Schema({
  description: {
    type: String,
    required: false
  },
  popularity: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  stock: {
    type: Number,
    default:0
  },
  availability: {
    type: String,
    enum: ["in-stock", "out-of-stock"]
    // required: true
  },

  price: {
    type: Number,
    required: true
  },
  islisted: {
    type: Boolean,
    default: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  images: [
    {
      type: String,
      required: true
    }
  ]
});
productsShema.index({ name: "text", description: "text" });
const products = mongoose.model("products", productsShema);
module.exports = products;
