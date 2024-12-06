const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    CouponCode: {
        type: String,
        required: true,
        unique: true  
    },
    DiscountType: {
        type: String,
        enum: ["percentage", "fixed"],  
        required: true
    },
    DiscountValue: {
        type: Number,
        required: true,
        min: 0 
    },
    Products: {
        type: [String], 
        default: []
    },
    Categories: {
        type: [String], 
        default: []
    },
    MinimumCartValue: {
        type: Number, 
        min: 0
    },
    UsageLimit: {
        type: Number, 
        min: 0 
    },
    ExpiryDate: {
        type: Date,
        required: true
    },
    Description: {
        type: String,
        maxlength: 500 
    },
    Status:{
        type:Boolean,
        default:true
    }
});

const Coupons = mongoose.model("Coupon", couponSchema);
module.exports = Coupons;
