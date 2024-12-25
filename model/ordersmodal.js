const mongoose = require("mongoose");

const ordersSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true
    },
    islisted: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: [
        "scheduled",
        "pending",
        "delivered",
        "shipped",
        "canceled",
        "payment-pending",
        "returned"
      ],
      required: false,
      default: "payment-pending"
    },
 
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "products",
          required: true
        },
        status: {
          type: String,
          enum: [
            "scheduled",
            "pending",
            "delivered",
            "shipped",
            "canceled",
            "payment-pending",
            "returned"
          ],
          required: false
        },
        stock: {
          type: Number
        },
        price: {
          type: Number,
          required: true
        },
        priceWithDiscount: {
          type: Number,
          required: false,
          default: 0
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        total: {
          type: Number,
          required: true
        },
        description: {
          type: String
        },
        images: [
          {
            type: String,
            required: false
          }
        ]
      }
    ],
    razorpayDetails: {
      orderId: {
        type: String,
        required: false
      },
      amount: {
        type: Number,
        required: false
      },
      currency: {
        type: String,
        required: false
      }
    },
    paymentMethod: {
      type: String,
      enum: ["wallet", "cod", "razorpay"],
      required: true
    },
    shippingAddress: {
      firstname: { type: String, required: true },
      lastname: { type: String },
      address: { type: String, required: true },
      phone: { type: Number, required: true },
      email: { type: String, required: true },
      place: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: Number, required: true },
      district: { type: String, required: true }
    },
    
    orderTotal: {
      type: Number,
      required: true
    },
    totalAfterCoupon: {
      type: Number,
      default: false
    },
    time: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);


const orders = mongoose.model("orders", ordersSchema);
module.exports = orders;
