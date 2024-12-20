const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: false
  },
  brand: {
    type: String,
    required: false
  },
  bandcolor: {
    type: String,
    required: false
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
