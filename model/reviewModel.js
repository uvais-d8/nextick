// models/Review.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    name: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: false,
    },
    number: {
        type: String,
        required: false
    },
    productId: {
        type: Schema.Types.ObjectId,
        required: false,
        ref: "Products"
    },
    userId: {
        type: Schema.Types.ObjectId,
        required: false,
        ref: "user"
    },
    rating: {
        type: Number,
        required: false,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Review", reviewSchema);
