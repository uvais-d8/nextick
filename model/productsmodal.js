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
    type: mongoose.Schema.Types.ObjectId, // Reference to the category model
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
  priceWithDiscount: {
    type: Number,
    default: function () {
      if (this.offer) {
        if (this.offer.DiscountType === "percentage") {
          return this.price - (this.price * this.offer.DiscountValue) / 100;
        } else if (this.offer.DiscountType === "fixed") {
          return this.price - this.offer.DiscountValue;
        }
      }
      return this.price; // If no offer, just return the original price
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
