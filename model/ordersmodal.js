const mongoose = require("mongoose");

const ordersSchema = new mongoose.Schema({
  
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"users",
        require:true
    },
    islisted:{
        type:Boolean,
        default:true
    },
    status:{
        type:String,
        enum:["scheduled", "pending", "delivered", "shipped", "canceled"],
        require:true,
        default:"scheduled" 
    },
    items: [{      
        productId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"products",
            require:true
        },
        status:{
            type:String,
            enum:["scheduled", "pending", "delivered", "shipped", "canceled"],
            require:true,
            default:"scheduled"
        },
        stock:{
            type:Number
        },
        name: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        stock: {
            type: Number,
            required: false,
        },
        total: {
            type: Number,
            required: true,
            default: function() {
                return this.price * this.quantity;
            }
        },
        images: [{
            type: String,
            required: false
        }]
    }],
   
    paymentMethod: {
        type: String,
        enum: ['online', 'cod'],
        required: true
    },
    shippingAddress: { 
        // type: mongoose.Schema.Types.ObjectId,
        // ref: "addresses", 
        // required: true
        firstname:{
            type:String,
        },lastname:{
            type:String,
        },address:{
            type:String,
        },phone:{
            type:Number,
        },email:{
            type:String,
        },place:{
            type:String,
        },city:{
            type:String,
        },pincode:{
            type:Number,
        },district:{
            type:String
        }
    },
    orderTotal: {
        type: Number,
        required: true,
        default: 0 // This will be calculated based on the items' totals
    },
    time: {
        type: Date, 
        default: Date.now 
    }
});

// Calculate the total order amount based on items' total values
ordersSchema.pre('save', function(next) {
    this.orderTotal = this.items.reduce((sum, item) => sum + item.total, 0);
    next();
});

const orders = mongoose.model("orders", ordersSchema);
module.exports = orders;

