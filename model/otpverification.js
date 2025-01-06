const mongoose=require("mongoose")

const schema=mongoose.Schema

const userotpverificationSchema =new mongoose.Schema({
    userId:String,
    otp:String,
    createdAt:Date,
    expiresAt:Date,
})
const userotpverification =mongoose.model(
    "userotpverification",
    userotpverificationSchema
);

module.exports=userotpverification;