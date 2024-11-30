const mongoose =require("mongoose")

const offerSchema = new mongoose.Schema({
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
    Description: {
        type: String,
        maxlength: 500 
    },
    Products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "products",
    }],
    Categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "category",
    }],
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