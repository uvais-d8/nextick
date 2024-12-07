const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "products",
    required: true
  },
  quantity: {
    type: Number,
    required: false,
    default: 1
  },
  priceWithDiscount: {
    type: Number,
    required: false
  },
  totalPrice: {
    type: Number,
    required: true
  }
});

const cartmodal = mongoose.model("cart", cartSchema);
module.exports = cartmodal;











const placeOrder = async (req, res) => {
  console.log("hellooo");
  const userId = req.session.userId;
  const {
    email,
    phone,
    paymentMethod,
    items,
    pincode,
    district,
    firstname,
    place,
    city,
    lastname,
    address
  } = req.body;

  console.log(req.body);

  const errors = {};

  // Validation
  if (!firstname) errors.firstname = "First name is required.";
  if (!lastname) errors.lastname = "Last name is required.";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Invalid email.";
  if (!phone || !/^[0-9]{10}$/.test(phone))
    errors.phone = "Invalid phone number.";
  if (!address) errors.address = "Address is required";
  if (!pincode || !/^[0-9]{6}$/.test(pincode))
    errors.pincode = "Invalid pin code";
  if (!place) errors.place = "Place is required";
  if (!city) errors.city = "City is required";
  if (!district) errors.district = "District is required";

   const allowedPaymentMethods = ["cod", "upi", "razorpay"];
  if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
    errors.paymentMethod = "Invalid or unsupported payment method selected";
  }

   if (!items || !Array.isArray(items) || items.length === 0) {
    errors.items = "No items in the cart";
  }

  try {
    const cartItems = await Cart.find({ user: userId }) 
      .populate("productId");

    if (cartItems.length === 0) {
      throw new Error("No items in the cart.");
    }

     const updatedCartItems = await Promise.all(
      cartItems.map(async item => {
        const product = item.productId;
        if (!product) throw new Error(`Product not found.`);
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}.`);
        }
        product.stock -= item.quantity;
        await product.save();
        return {
          ...item.toObject(), 
          price: product.price,
          total: product.price * item.quantity
        };
      })
    );

    const shippingAddress = {
      firstname,
      lastname,
      address,
      phone,
      email,
      place,
      city,
      pincode,
      district
    };

    // Calculate total and save the order
    const orderTotal = updatedCartItems.reduce(
      (acc, item) => acc + item.total,
      0
    );
    const newOrder = new Orders({
      userId,
      items: updatedCartItems,
      orderTotal,
      paymentMethod,
      shippingAddress 
       });

    console.log("New order details:", newOrder);
    await newOrder.save();
    console.log("Order saved successfully.");
    await Cart.deleteMany({ user: userId });
    console.log(`Cart items for user ${userId} have been deleted.`);

    res.json({ success: true });
  } catch (error) {
    console.log("Error placing order:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to place order."
    });
  }
};