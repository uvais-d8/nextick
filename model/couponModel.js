const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    CouponCode: {
        type: String,
        required: true,
        unique: true // Ensure each coupon code is unique
    },
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
    Products: {
        type: [String], // Array of product IDs or names
        default: []
    },
    MinimumCartValue: {
        type: Number, // Changed to Number for cart value comparison
        min: 0
    },
    UsageLimit: {
        type: Number, // Changed to Number for limit counting
        min: 1 // Minimum usage limit of 1
    },
    ExpiryDate: {
        type: Date,
        required: true
    },
    Description: {
        type: String,
        maxlength: 500 // Limit description length
    },
    ApplicableProducts: {
        type: [String], // Array of applicable product IDs or names
        default: []
    },
    ApplicableCategories: {
        type: [String], // Array of applicable category names or IDs
        default: []
    }
});

const Coupons = mongoose.model("Coupon", couponSchema);
module.exports = Coupons;
