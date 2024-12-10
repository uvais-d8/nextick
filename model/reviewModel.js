const mongoose=require("mongoose");
const Schema = mongoose.Schema;

const  reviewSchema=  new Schema({
    name:{
        type:String,
        required:true
    },
    email: {
        type: String,
        required: false,
    },
    number: {
        type: String,
        required: true
    },
    productId:{
        type: Schema.Types.ObjectId,
        required:true,
        ref:"Product"
    },
    userId:{
        type: Schema.Types.ObjectId,
        required:true,
        ref:"user"
    },
    rating:{
        type:Number,
        required:true,
        min:1,
        max:5
    },
    comment:{
        type:String,
        required:true
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
})

 
const Review = mongoose.model("Review", reviewSchema);
module.exports = Review;
