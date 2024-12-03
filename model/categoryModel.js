const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  bandcolor: {
    type: String,
    required: true
  },
  islisted: {
    type: Boolean,
    default: true
  },
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Offer",
    default:null
  },
});

const categories = mongoose.model("category", categorySchema);
module.exports = categories;
