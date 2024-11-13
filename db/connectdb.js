const mongoose=require("mongoose")
require("dotenv").config()

const connectdb = async () => {
    try {
        await mongoose.connect(process.env.MONGODBURL, {
        });
        console.log('Connected to MongoDB');
    } catch (err) {
        console.log('MongoDB connection error:', err);
    }
};
connectdb()

module.exports =connectdb