const mongoose = require("mongoose");

const productsShema = new mongoose.Schema({
  name: {
    type: String,
    required: false
  },
  description: {
    type: String,
    required: false
  },
  reviews: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
    },
  ], 
  averageRating: {
    type: Number,
    default: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "category",
    required: true
  },
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Offer",
    default:null
  },
  stock: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: false
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
  priceWithDiscount:{
    type:Number,
    required:false,
    default:0,
  },
  salesCount: {
    type: Number,
    default: 0
  },
  images: [
    {
      type: String,
      required: true
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
});

productsShema.index({ name: "text", description: "text" });

const products = mongoose.model("products", productsShema);
module.exports = products;
