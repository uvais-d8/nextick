const mongoose=require("mongoose")

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
}, { collection: 'admin' });  // This forces the collection to be 'admin'


const admin = mongoose.model("admin",adminSchema)
module.exports=admin;