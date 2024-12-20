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
    required: false
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
  availability: {
    type: String,
    enum: ["in-stock", "out-of-stock"],
    default: function () {
      return this.stock > 0 ? "in-stock" : "out-of-stock";
    }
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
  ]
});

productsShema.index({ name: "text", description: "text" });

const products = mongoose.model("products", productsShema);
module.exports = products;
