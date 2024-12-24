const mongoose=require("mongoose")

const addressSchema=new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user",
        // required:true
    },
    firstname:{
        type:String,
        // required:true
    },
    lastname:{
        type:String,
        // required:true
    },
    address:{
        type:String,
        // required:true
    },
    phone: {
        type: String, 
        // required: true
    },
    email:{
        type:String,
        // required:true
    },
    place:{
        type:String,
        // required:true
    },
    city:{
        type:String,
        // required:true
    },
    pincode:{
        type:Number,
        // required:true
    },
    district:{
        type:String,
        required:false
    },
    isDefault:{
        type:String,
        default:false,
    },
    
})

const addresses=mongoose.model("addresses",addressSchema)
module.exports=addresses
