const mongoose =require("mongoose")

const offerSchema = new mongoose.Schema({
    DiscountType: {
        type: String,
        enum: ["percentage", "fixed"], // Limit discount type to specific options
        required: true
    },
    DiscountValue: {
        type: Number,
        required: true,
        min: 0 // Minimum discount value of 0
    },
    Description: {
        type: String,
        maxlength: 500 // Limit description length
    },
    Products: {
        type: [String], // Array of product IDs or names
        default: []
    },
    Categories: {
        type: [String], // Array of applicable category names or IDs
        default: []
    },
    ExpiryDate: {
        type: Date,
        required: true
    },
    Status:{
        type:Boolean,
        default:true
    }
});

const Offer = mongoose.model("Offer",offerSchema)
module.exports = Offer;