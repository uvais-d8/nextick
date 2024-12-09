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

  try {
    // Check if coupon code is provided
    if (!couponCode) {
      console.log("Coupon code is required");
      return res.status(400).json({ message: "Coupon code is required" });
    }

    // Find the coupon in the database
    const coupon = await Coupons.findOne({ CouponCode: couponCode });

    if (!coupon) {
      console.log("Coupon code is invalid");
      return res.status(404).json({ message: "Coupon code is invalid" });
    }

    const currentDate = new Date();
    if (coupon.ExpiryDate < currentDate) {
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
const razorpayy = async (req, res) => {
  const userId = req.session.userId;
  console.log("razorpay processing");

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const {
      total,
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
    const amount = total * 100; // Razorpay amount is in paisa

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
    // Log the shipping address for debugging
    console.log("Received shippingAddress:", shippingAddress);
    const orderTotal = updatedCartItems.reduce(
      (acc, item) => acc + item.total,
      0
    );

 
    const newOrder = new Orders({
      userId,
      items: updatedCartItems,
      orderTotal,
      status:'payment-pending',
      shippingAddress,
      paymentMethod: "razorpay",
      items: updatedCartItems.map(item => ({
        ...item,
        status: "payment-pending", // Default status for each item
      })),
      razorpayDetails: {
        orderId: order.id, // Save the Razorpay order ID
        amount: order.amount,
        currency: order.currency,
      },
     
    });
    console.log("New order details:", newOrder);

    // Update the sales count for each product in the order
    for (let item of newOrder.items) {
      // Assuming 'items' contains products in the order
      const productId = item.productId; // Replace with the correct field name for product ID
      const quantity = item.quantity; // Replace with the correct field name for quantity

      // Find the product and increase its salesCount by the ordered quantity
      const product = await Products.findById(productId);

      if (product) {
        // Increase salesCount by the ordered quantity
        product.salesCount += quantity;

        // Save the updated product
        await product.save();
        console.log(
          `Product ${product.name} salesCount updated to ${product.salesCount}`
        );
      } else {
        console.log(`Product with ID ${productId} not found.`);
      }
    }
    await newOrder.save();
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
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    // Find the order and update its status
    const order = await Orders.findOne({ "razorpayDetails.orderId": orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.paymentStatus = status; // Update the payment status
    await order.save();
    res.json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency
    });
    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    console.error("Error updating order status:", error.message);
    res.status(500).json({ success: false, message: "Failed to update order status" });
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
    // Update the order's status and all items' statuses
    const result = await Orders.updateOne(
      { _id: orderId }, // Find the order by its ID
      {
        $set: {
          status: "scheduled", // Update the order's status
          "items.$[].status": "scheduled" // Update all items' statuses in the array
        }
      }
    );

    console.log("Update Result:", result);

    // Check if the order exists and was updated
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

  // Get the order ID from request params
  const orderId = req.params.id;
  console.log("orderId:", orderId);

  const userId = req.session.userId;
  console.log("userId:", userId);

  if (!userId) return res.redirect("/login");

  try {
    // Fetch the order from the database
    const order = await Orders.findOne({ 'items._id': orderId, userId });

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

    // If Razorpay details already exist, return them
    if (order.razorpayDetails?.orderId) {
      return res.json({
        success: true,
        razorpayOrder: order.razorpayDetails, // Razorpay order details
        orderId: order._id, // Our order ID
        items: order.items, // Items in the order
        shippingAddress: order.shippingAddress, // Shipping details
      });
    }

    // Otherwise, create a new Razorpay order
    const amount = order.orderTotal * 100; // Convert to paise (Razorpay expects the amount in paise)
    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `retry_${orderId}_${Date.now()}`,
    });

    // Update the Razorpay details in the order
    order.razorpayDetails = {
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    };
    await order.save();

    // Return the new Razorpay order details
    res.json({
      success: true,
      razorpayOrder, // New Razorpay order details
      orderId: order._id, // Our order ID
      items: order.items, // Items in the order
      shippingAddress: order.shippingAddress, // Shipping details
    });
  } catch (error) {
    console.error("Error processing retry payment:", error);
    res.status(500).json({ success: false, message: "Failed to retry payment." });
  }
};
const retrypaymentSuccess = async (req, res) => {
  console.log("Controller success");

  const itemId = req.params.id; // This is the item ID
  console.log("Item ID received:", itemId);

  try {
      // Find the order containing the item and update the item's status
      const updatedOrder = await Orders.findOneAndUpdate(
          { "items._id": itemId }, // Find the order containing the specific item
          { $set: { "items.$.status": "scheduled" } }, // Update the status of the matched item
          { new: true } // Return the updated document
      );

      // Check if the order and item were found and updated
      if (!updatedOrder) {
          return res.status(404).json({ message: "Item not found in any order" });
      }

      // Send a success response with the updated order
      res.status(200).json({
          message: "Item status updated to scheduled",
          updatedOrder,
      });
  } catch (error) {
      console.error("Error updating item status:", error);
      res.status(500).json({
          message: "Server error, unable to update item status",
      });
  }
};
module.exports = {
  retryRazorpay,
  retrypaymentSuccess,
   addtocart,
  paymentSuccess,
  updateOrderStatus, 
  loadcartpage,
  removecart,
  placeOrder,
  updateQuantity,
  getProductStock,
  razorpayy,
  applycoupon
};
