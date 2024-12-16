const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    couponCode: {
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
    minPurchase: {
        type: Number, 
        min: 0
    },
    UsageLimit: {
        type: Number, 
        min: 0  
    },
    expiryDate: {
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
