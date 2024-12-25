const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: false
  },
  firstname: {
    type: String,
    required: false
  },
  lastname: {
    type: String,
    required: false
  },
  address: {
    type: String,
    required: false
  },
  phone: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false
  },
  place: {
    type: String,
    required: false
  },
  city: {
    type: String,
    required: false
  },
  pincode: {
    type: Number,
    required: false
  },
  district: {
    type: String,
    required: false
  },
  isDefault: {
    type: String,
    default: false
  }
});

const addresses = mongoose.model("addresses", addressSchema);
module.exports = addresses;
