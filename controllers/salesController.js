const Cart = require("../model/cartModel");
const Products = require("../model/productsmodal");
const Orders = require("../model/ordersmodal");
const Razorpay = require("razorpay");
const Coupons = require("../model/couponModel");
const Offer = require("../model/offermodel");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
const applycoupon = async (req, res) => {
  const { couponCode, cartTotal } = req.body;
console.log("req.body",req.body)
  try {
    // Check if coupon code is provided
    if (!couponCode) {
      console.log("Coupon code is required");
      return res.status(400).json({ message: "Coupon code is required" });
    }

    // Find the coupon in the database
    const coupon = await Coupons.findOne({ couponCode: couponCode });
console.log("coupon",coupon)
    if (!coupon) {
      console.log("Coupon code is invalid");
      return res.status(404).json({ message: "Coupon code is invalid" });
    }

    const currentDate = new Date();
    if (coupon.expiryDate < currentDate) {
      console.log("Coupon code has expired");

      return res.status(400).json({ message: "Coupon code has expired" });
    }

    // Check usage limit
    if (coupon.UsageLimit <= 0) {
      console.log("Coupon code usage limit has been reached");
      return res
        .status(400)
        .json({ message: "Coupon code usage limit has been reached" });
    }

    // Check minimum cart value
    if (coupon.MinimumCartValue && cartTotal < coupon.MinimumCartValue) {
      console.log(
        `Minimum cart value for this coupon is ₹${coupon.MinimumCartValue}`
      );
      return res.status(400).json({
        message: `Minimum cart value for this coupon is ₹${coupon.MinimumCartValue}`
      });
    }

    // Calculate the discount
    let discount = 0;
    if (coupon.DiscountType === "percentage") {
      discount = cartTotal * coupon.DiscountValue / 100;
    } else if (coupon.DiscountType === "fixed") {
      discount = coupon.DiscountValue;
    }

    discount = Math.min(discount, cartTotal);

    // Calculate the new total
    const newTotal = cartTotal - discount;

    // Decrement usage limit and save the coupon
    if (coupon.UsageLimit > 0) {
      coupon.UsageLimit -= 1;
      await coupon.save();
    }

    res.status(200).json({
      message: "Coupon applied successfully",
      discount,
      newTotal
    });
  } catch (error) {
    console.error("Error while applying coupon:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const placeOrder = async (req, res) => { 
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

  const allowedPaymentMethods = ["cod","razorpay"];
  if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
    errors.paymentMethod = "Invalid or unsupported payment method selected";
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.items = "No items in the cart";
  }

  try {
    const cartItems = await Cart.find({ user: userId }).populate("productId");

    if (cartItems.length === 0) {
      throw new Error("No items in the cart.");
    }

    const updatedCartItems = await Promise.all(
      cartItems.map(async (item) => {
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
          total: product.price * item.quantity,
          status: "scheduled",   
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
      district,
    };

    // Calculate total and save the order
    const orderTotal = updatedCartItems.reduce(
      (acc, item) => acc + item.total,
      0
    );

    if (paymentMethod === "cod" && orderTotal > 1000) {
      return res.status(400).json({
        success: false,
        message: "Cash on Delivery (COD) is not available for orders above ₹1000.",
      });
    }
    const newOrder = new Orders({
      userId,
      items: updatedCartItems, // Items now include the status field
      orderTotal,
      paymentMethod,
      shippingAddress,
      status: "scheduled", // Set the overall order status to 'scheduled'
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
      message: error.message || "Failed to place order.",
    });
  }
};
 
const razorpayy = async (req, res) => {
  const userId = req.session.userId;
  console.log("razorppayyy processing");

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const {
      orderTotal,
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
      address,
      
    } = req.body;
    
    // Fetch user's cart items
    const cartItems = await Cart.find({ user: userId }).populate("productId");

const amount = orderTotal * 100; // Razorpay amount is in paisa

    
    
    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `order_${Date.now()}`
    });

    if (cartItems.length === 0) {
      throw new Error("No items in the cart.");
    }

    // Process cart items and stock checks
    const updatedCartItems = await Promise.all(
      cartItems.map(async item => {
        const product = item.productId;
        if (!product) throw new Error(`Product not found.`);
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}.`);
        }
        // Deduct stock from the product
        product.stock -= item.quantity;
        await product.save();
        return {
          ...item.toObject(), // Convert the Mongoose document to a plain object
          price: product.price,
          total: product.price * item.quantity
        };
      })
    );
    shippingAddress = {
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
    };
 
 
    const newOrder = new Orders({
      userId,
      items: updatedCartItems,
      orderTotal: orderTotal, 
      status: 'payment-pending',
      shippingAddress,
      paymentMethod: "razorpay",
      items: updatedCartItems.map(item => ({
        ...item,
        status: "payment-pending",
      })),
      razorpayDetails: {
        orderId: order.id, 
        amount,
        currency: order.currency,
      },
    });
    
    console.log("Order Total before save:", newOrder.orderTotal);  
    const Order = await newOrder.save();
    console.log("Order Total after save:", Order.orderTotal);  
     
    for (let item of newOrder.items) {
       const productId = item.productId; 
      const quantity = item.quantity; 
 
      const product = await Products.findById(productId);

      if (product) { 
        product.salesCount += quantity;
 
        await product.save();
        console.log(
          `Product ${product.name} salesCount updated to ${product.salesCount}`
        );
      } else {
        console.log(`Product with ID ${productId} not found.`);
      }
    }

    console.log(`Cart items for user ${userId} have been deleted.`);
    res.json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      orderId:newOrder._id
    });
        // Delete all items from the user's cart after placing the order
        await Cart.deleteMany({ user: userId });

  } catch (error) {
    console.log("Error creating Razorpay order:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getProductStock = async (req, res) => {
  const { cartId } = req.params;
  try {
    const cartItem = await Cart.findById(cartId).populate("productId");
    if (!cartItem) {
      return res
        .status(404)
        .json({ success: false, message: "Cart item not found" });
    }
    const product = cartItem.productId;
    return res.status(200).json({ stock: product.stock });
  } catch (error) {
    console.error("Error fetching product stock:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stock" });
  }
};
const updateQuantity = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (quantity < 1 || quantity > 11) {
    return res.status(400).json({ message: "Invalid quantity" });
  }

  try {
    await Cart.updateOne({ _id: id }, { $set: { quantity } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating quantity." });
  }
};
const loadcartpage = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log("sesssio user id::", userId);

    const carts = await Cart.find({ user: userId }).populate("productId");
    console.log("Cart Items:", carts);

    if (!carts || carts.length === 0) {
      return res.render("cart", {
        carts: [],
        message: "There are no items in your cart at the moment"
      });
    }

    carts.forEach(cart => {
      if (cart.productId.images && cart.productId.images.length > 0) {
        cart.firstImage = cart.productId.images[0];
      }
    });
    let subtotal = 0;
    carts.forEach(item => {
      if (item.priceWithDiscount) {
        subtotal += item.priceWithDiscount * item.quantity;
      } else {
        subtotal += item.productId.price * item.quantity;
      }
    });

    res.render("cart", {
      carts,
      subtotal,
      shippingRate: 50,
      total: subtotal + 50
    });
  } catch (error) {
    console.error("Error occurred during cart page:", error);
    res.status(500).send("Internal Server Error");
  }
};
const removecart = async (req, res) => {
  const { id } = req.params;

  try {
    const cartItem = await Cart.findById(id);
    if (!cartItem) {
      console.error("Cart item not found");
      return res.redirect("/cart");
    }

    await Cart.findByIdAndDelete(id);

    console.log("Item deleted and stock updated successfully");
    res.redirect("/cart");
  } catch (error) {
    console.error("Error deleting item or updating stock:", error);
    res.redirect("/cart");
  }
};
const addtocart = async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const { quantity, productId } = req.body;

    const productQuantity = parseInt(quantity) || 1;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const product = await Products.findById(productId).populate("offer");

    if (!product) {
      return res.render("singleproduct", { message: "Product not found" });
    }

    if (!product.islisted) {
      return res.render("singleproduct", {
        message: "This product is currently unavailable",
        product
      });
    }

    if (product.stock < productQuantity) {
      return res.render("singleproduct", {
        message: "Not enough stock available for this quantity",
        product
      });
    }

    let discountedPrice = product.price;
    if (
      product.offer &&
      product.offer.Status &&
      product.offer.ExpiryDate > Date.now()
    ) {
      if (product.offer.DiscountType === "percentage") {
        const discount = product.price * product.offer.DiscountValue / 100;
        discountedPrice = Math.max(0, product.price - discount); // Prevent negative price
      } else if (product.offer.DiscountType === "fixed") {
        discountedPrice = Math.max(
          0,
          product.price - product.offer.DiscountValue
        );
      }
    }

    const existingItem = await Cart.findOne({ user: userId, productId });

    if (existingItem) {
      const newQuantity = existingItem.quantity + productQuantity;

      if (newQuantity > product.stock) {
        return res.render("singleproduct", {
          message: "Cannot add more than the available stock to your cart",
          product
        });
      }

      if (newQuantity > 10) {
        return res.render("singleproduct", {
          message: "Cannot add more than 10 units of this item to your cart",
          product
        });
      }

      existingItem.quantity = newQuantity;
      existingItem.priceWithDiscount = discountedPrice;
      existingItem.totalPrice = newQuantity * discountedPrice;
      await existingItem.save();
    } else {
      const cartItem = new Cart({
        user: userId,
        productId,
        quantity: productQuantity,
        priceWithDiscount: discountedPrice,
        totalPrice: productQuantity * discountedPrice
      });
      await cartItem.save();
    }

    res.redirect("/cart");
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ error: "Failed to add product to cart" });
  }
};
const paymentSuccess = async (req, res) => {
  const orderId = req.params.id;
  console.log("Order ID:", orderId);

  try {
     const result = await Orders.updateOne(
      { _id: orderId },  
      {
        $set: {
          status: "scheduled", 
          "items.$[].status": "scheduled" 
        }
      }
    );

    console.log("Update Result:", result);

     if (result.matchedCount === 0) {
      console.error("No matching order found");
      return res.status(404).send("Order not found");
    }

    console.log("Order and items' statuses updated to scheduled.");
    return res.json({ success: true });
  } catch (error) {
    console.error("Error in paymentSuccess controller:", error);
    return res.status(500).send("Internal Server Error");
  }
};
const retryRazorpay = async (req, res) => {
  console.log("Retry payment processing 2");

   const orderId = req.params.id;
  console.log("orderId:", orderId);

  const userId = req.session.userId;
  console.log("userId:", userId);

  if (!userId) return res.redirect("/login");

  try {
    const order = await Orders.findOne({ _id: orderId, userId });

    if (!order) {
      console.log('not order',order)
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.status !== "payment-pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot retry payment for an order with status: ${order.status}.`,
      });
    }

     if (order.razorpayDetails?.orderId) {
      return res.json({
        success: true,
        razorpayOrder: order.razorpayDetails,  
        orderId: order._id,  
        items: order.items, 
        shippingAddress: order.shippingAddress, 
      });
    }

     const amount = order.orderTotal * 100; 
    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `retry_${orderId}_${Date.now()}`,
    });

     order.razorpayDetails = {
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    };
    await order.save();

     res.json({
      success: true,
      razorpayOrder, 
      orderId: order._id, 
      items: order.items, 
      shippingAddress: order.shippingAddress, 
    });
  } catch (error) {
    console.error("Error processing retry payment:", error);
    res.status(500).json({ success: false, message: "Failed to retry payment." });
  }
};
const retrypaymentSuccess = async (req, res) => {
  console.log("Controller success");

  const orderId = req.params.id; // This is the order ID
  console.log("Order ID received:", orderId);

  try {
    // Update the entire order's status to "scheduled" and each item's status to "scheduled"
    const updatedOrder = await Orders.findOneAndUpdate(
      { _id: orderId }, // Match the order by ID
      {
        $set: {
          status: "scheduled", // Update order status
          "items.$[].status": "scheduled", // Update all items' status
        },
      },
      { new: true } // Return the updated document
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order and all item statuses updated to scheduled",
      updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order and item statuses:", error);
    res.status(500).json({
      message: "Server error, unable to update order and item statuses",
    });
  }
};

const removecoupon = async (req, res) => {
  try {

    console.log("remove coupon processing")
     console.log("Raw coupon code from params:", req.params.couponCode);
    
     const couponCode = String(req.params.couponCode);    
    console.log("Coupon code to remove (converted to string):", couponCode);
    
     const coupon = await Coupons.findOne({ couponCode: couponCode });
     console.log("old usage limit",coupon.UsageLimit)

    if (!coupon) { 
        console.log("Coupon found:", coupon);
       return res.status(400).json({ message: 'Coupon not found' });
    
    }

  const cartTotal = req.body.cartTotal || 0; 
    res.status(200).json({
      originalTotal: cartTotal,  
            message: 'Coupon removed successfully',
    });
  // Increment the usage limit
    coupon.UsageLimit += 1;
    await coupon.save();
    console.log("new usage limit",coupon.UsageLimit)
     
  } catch (error) {
    console.error('Error removing coupon:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = {
  retryRazorpay,
  retrypaymentSuccess,
   addtocart,
  paymentSuccess,
   loadcartpage,
  removecart,
  placeOrder,
  updateQuantity,
  getProductStock,
  razorpayy,
  applycoupon,
  removecoupon
};
