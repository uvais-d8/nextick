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
  // priceWithDiscount: {
  //   type: Number,
  //   require:false,
  //   default: function () {
  //     if (this.offer && this.price) {
  //       if (this.offer.DiscountType === "percentage") {
  //         const discount = (this.price * this.offer.DiscountValue) / 100;
  //         return Math.max(0, this.price - discount); // Prevent negative price
  //       } else if (this.offer.DiscountType === "fixed") {
  //         return Math.max(0, this.price - this.offer.DiscountValue); // Prevent negative price
  //       }
  //     }
  //     return this.price || 0; // Fallback to original price or 0 if price is missing
  //   }
  // },
  
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
