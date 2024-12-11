const mongoose=require("mongoose")
require("dotenv").config()

const connectdb = async () => {
    try {
        await mongoose.connect("mongodb+srv://muhammeduvais:Hello786%40gmail.com@cluster0.q6tgs.mongodb.net/watchpremium?retryWrites=true&w=majority&appName=Cluster0", {
        });
        console.log('Connected to MongoDB');
    } catch (err) {
        console.log('MongoDB connection error:', err);
    }
};
connectdb()

module.exports =connectdb