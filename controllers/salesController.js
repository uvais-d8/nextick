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

// const applycoupon = async (req, res) => {
//   const { couponCode } = req.body;

//   try {
//     const coupon = await Coupons.findOne({ CouponCode: couponCode });

//     if (!coupon) {
//       console.log("Coupon code is invalid")
//       return res.status(404).json({ message: "Coupon code is invalid" });
//     }

//     // Check if the coupon is expired
//     const currentDate = new Date();
//     if (coupon.ExpiryDate < currentDate) {
//       return res.status(400).json({ message: "Coupon code has expired" });
//     }

//     // Check if the coupon has any usage limit and if it is less than or equal to 0
//     if (coupon.UsageLimit <= 0) {
//       // You can choose to skip applying this coupon, or reset usage limit to 1 or any custom logic.
//       return res.status(400).json({ message: "Coupon code usage limit has been reached" });
//     }

//     // Check the minimum cart value
//     if (
//       coupon.MinimumCartValue &&
//       req.body.cartTotal < coupon.MinimumCartValue
//     ) {
//       return res.status(400).json({
//         message: `Minimum cart value for this coupon is ₹${coupon.MinimumCartValue}`
//       });
//     }

//     // Calculate the discount
//     let discount = 0;
//     if (coupon.DiscountType === "percentage") {
//       discount = req.body.cartTotal * coupon.DiscountValue / 100;
//     } else if (coupon.DiscountType === "fixed") {
//       discount = coupon.DiscountValue;
//     }

//     // Update cart total after applying the discount
//     const newTotal = req.body.cartTotal - discount;

//     // Optionally, you can update the coupon usage count in the database
//     if (coupon.UsageLimit > 0) {
//       coupon.UsageLimit -= 1;
//       await coupon.save(); // Save the coupon after decrementing the usage limit
//     }

//     // Send the discount details and new total back to the front end
//     res.status(200).json({
//       message: "Coupon applied successfully",
//       discount,
//       newTotal
//     });
//   } catch (error) {
//     console.log("Error while applying coupon:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

const applycoupon = async (req, res) => {
  const { couponCode, cartTotal } = req.body;

  try {
    // Check if coupon code is provided
    if (!couponCode) {
      console.log("Coupon code is required")
      return res.status(400).json({ message: "Coupon code is required" });
    }

    // Find the coupon in the database
    const coupon = await Coupons.findOne({ CouponCode: couponCode });

    if (!coupon) {
      console.log("Coupon code is invalid")
      return res.status(404).json({ message: "Coupon code is invalid" });
    }

    // Check if the coupon is expired
    const currentDate = new Date();
    if (coupon.ExpiryDate < currentDate) {
      console.log("Coupon code has expired")

      return res.status(400).json({ message: "Coupon code has expired" });
    }

    // Check usage limit
    if (coupon.UsageLimit <= 0) {
      console.log("Coupon code usage limit has been reached")
      return res.status(400).json({ message: "Coupon code usage limit has been reached" });
    }

    // Check minimum cart value
    if (coupon.MinimumCartValue && cartTotal < coupon.MinimumCartValue) {
      console.log(`Minimum cart value for this coupon is ₹${coupon.MinimumCartValue}`)
      return res.status(400).json({
        message: `Minimum cart value for this coupon is ₹${coupon.MinimumCartValue}`,
      });
    }

    // Calculate the discount
    let discount = 0;
    if (coupon.DiscountType === "percentage") {
      discount = (cartTotal * coupon.DiscountValue) / 100;
    } else if (coupon.DiscountType === "fixed") {
      discount = coupon.DiscountValue;
    }

    // Ensure discount does not exceed cart total
    discount = Math.min(discount, cartTotal);

    // Calculate the new total
    const newTotal = cartTotal - discount;

    // Decrement usage limit and save the coupon
    if (coupon.UsageLimit > 0) {
      coupon.UsageLimit -= 1;
      await coupon.save();
    }

    // Send success response
    res.status(200).json({
      message: "Coupon applied successfully",
      discount,
      newTotal,
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

  // Payment method validation
  const allowedPaymentMethods = ["cod", "upi", "razorpay"];
  if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
    errors.paymentMethod = "Invalid or unsupported payment method selected";
  }

  // Items validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.items = "No items in the cart";
  }

  try {
    const cartItems = await Cart.find({ user: userId }) 
      .populate("productId");

    if (cartItems.length === 0) {
      throw new Error("No items in the cart.");
    }

    // Process cart items and stock checks
    const updatedCartItems = await Promise.all(
      cartItems.map(async item => {
        const product = item.productId; // The product is populated already
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

    // Shipping address details
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
      shippingAddress // Add the shipping address to the order
    });

    console.log("New order details:", newOrder);
    await newOrder.save();
    console.log("Order saved successfully.");
    // Delete all items from the user's cart after placing the order
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
      address
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
        const product = item.productId; // The product is populated already
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

    // Save the order to the database
    const newOrder = new Orders({
      userId,
      items: updatedCartItems,
      orderTotal,
      shippingAddress,
      paymentMethod: "razorpay"
    });

    console.log("New order details:", newOrder);
    await newOrder.save();
    // Delete all items from the user's cart after placing the order
    await Cart.deleteMany({ user: userId });
    console.log(`Cart items for user ${userId} have been deleted.`);
    res.json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency
    });
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
// const loadcartpage = async (req, res) => {
//   const userId = req.session.userId;

//   if (!userId) {
//     return res.redirect("/login");
//   }

//   try {
//     // Fetch cart items and populate product details
//     const carts = await Cart.find({ user: userId })
//       .populate({
//         path: "productId",
//         populate: {
//           path: "offer" // Populate offer details within the product
//         }
//       });

//     // Map the cart items to include calculated discounted price
//     const cartItems = carts.map((item) => {
//       const product = item.productId;

//       // Default price is the original product price
//       let discountedPrice = product.price;

//       // Calculate discounted price if the offer exists
//       if (product.offer) {
//         if (product.offer.DiscountType === "percentage") {
//           const discount = (product.price * product.offer.DiscountValue) / 100;
//           discountedPrice = Math.max(0, product.price - discount);
//         } else if (product.offer.DiscountType === "fixed") {
//           discountedPrice = Math.max(0, product.price - product.offer.DiscountValue);
//         }
//       }

//       return {
//         ...item._doc, // Include other fields in the cart item
//         discountedPrice // Add the calculated discounted price
//       };
//     });

//     res.render("cart", { carts: cartItems ,carts});
//   } catch (error) {
//     console.error("Error fetching cart:", error);
//     res.status(500).json({ error: "Failed to load cart" });
//   }
// };

const loadcartpage = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log("sesssio user id::", userId);

    const carts = await Cart.find({ user: userId }).populate("productId");
    console.log("Cart Items:", carts);

    // If no items in the cart, render the page with a message
    if (!carts || carts.length === 0) {
      return res.render("cart", {
        carts: [], // Pass an empty array to avoid errors
        message: "There are no items in your cart at the moment"
      });
    }

    // // Calculate totals
    // const subtotal = carts.reduce(
    //   (acc, cart) => acc + (cart.productId.price || 0) * cart.quantity,
    //   0
    // );
    // const shippingRate = 50; // Static shipping rate for now
    // const total = subtotal + shippingRate;

    // Add the first image of each product to the cart items
    carts.forEach(cart => {
      if (cart.productId.images && cart.productId.images.length > 0) {
        cart.firstImage = cart.productId.images[0];
      }
    });
    let subtotal = 0;
    carts.forEach((item) => {
      if (item.priceWithDiscount) {
        subtotal += item.priceWithDiscount * item.quantity;
      } else {
        subtotal += item.productId.price * item.quantity;
      }
    });
    
    res.render("cart", {
      carts,
      subtotal,
      shippingRate: 50, // Example shipping rate
      total: subtotal + 50, // Example total with shipping
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
// const addtocart = async (req, res) => {
//   const userId = req.session.userId;

//   if (!userId) {
//     return res.redirect("/login");
//   }

//   try {
//     const { quantity, productId } = req.body;

//     if (!quantity || !productId) {
//       return res
//         .status(400)
//         .json({ error: "Quantity and Product ID are required" });
//     }

//     const product = await Products.findById(productId);

//     if (!product) {
//       return res.render("singleproduct", { message: "Product not found" });
//     }

//     if (!product.islisted) {
//       return res.render("singleproduct", {
//         message: "This product is currently unavailable",
//         product
//       });
//     }

//     if (product.stock < quantity) {
//       return res.render("singleproduct", {
//         message: "Not enough stock available for this quantity",
//         product
//       });
//     }

//     const existingItem = await Cart.findOne({ user: userId, productId });

//     if (existingItem) {
//       const newQuantity = existingItem.quantity + parseInt(quantity);

//       // Ensure the new quantity doesn't exceed stock or a maximum limit
//       if (newQuantity > product.stock) {
//         return res.render("singleproduct", {
//           message: "Cannot add more than the available stock to your cart",
//           product
//         });
//       }

//       if (newQuantity > 10) {
//         return res.render("singleproduct", {
//           message: "Cannot add more than 10 units of this item to your cart",
//           product
//         });
//       }

//       existingItem.quantity = newQuantity;
//       existingItem.total = newQuantity * product.price;
//       await existingItem.save();
//     } else {
//       // Create a new cart item
//       const cartItem = new Cart({
//         user: userId,
//         productId,
//         quantity,
//         total: product.price * quantity
//       });
//       await cartItem.save();
//     }

//     // Decrease stock of the product after adding to cart
//     await product.save();

//     // Redirect to the cart page after successfully adding the product
//     res.redirect("/cart");
//   } catch (error) {
//     console.error("Error adding product to cart:", error);
//     res.status(500).json({ error: "Failed to add product to cart" });
//   }
// };

// const addtocart = async (req, res) => {
//   const userId = req.session.userId;

//   if (!userId) {
//     return res.redirect("/login");
//   }

//   try {
//     const { quantity, productId } = req.body;

//     // Default quantity to 1 if not provided
//     const productQuantity = parseInt(quantity) || 1;

//     if (!productId) {
//       return res.status(400).json({ error: "Product ID is required" });
//     }

//     const product = await Products.findById(productId).populate("offer");
//     console.log("producctttctctct::", product);
//     if (!product) {
//       return res.render("singleproduct", { message: "Product not found" });
//     }

//     if (!product.islisted) {
//       return res.render("singleproduct", {
//         message: "This product is currently unavailable",
//         product
//       });
//     }

//     if (product.stock < productQuantity) {
//       return res.render("singleproduct", {
//         message: "Not enough stock available for this quantity",
//         product
//       });
//     }

//     // Calculate discounted price if offer exists
//     let priceWithDiscount = null;
//     console.log("kkkoooiiii", product.offer);
//     if (product.offer && product.Status) {
//       if (product.offer.DiscountType === "percentage") {
//         const discount = product.price * product.offer.DiscountValue / 100;
//         priceWithDiscount = Math.max(0, product.price - discount); // Prevent negative price
//       } else if (product.offer.DiscountType === "fixed") {
//         priceWithDiscount = Math.max(
//           0,
//           product.price - product.offer.DiscountValue
//         ); 
//       }
//     }
//     console.log("priceWithDiscount", priceWithDiscount);

//     const existingItem = await Cart.findOne({ user: userId, productId });

//     if (existingItem) {
//       const newQuantity = existingItem.quantity + productQuantity;

//       // Ensure the new quantity doesn't exceed stock or a maximum limit
//       if (newQuantity > product.stock) {
//         return res.render("singleproduct", {
//           message: "Cannot add more than the available stock to your cart",
//           product
//         });
//       }

//       if (newQuantity > 10) {
//         return res.render("singleproduct", {
//           message: "Cannot add more than 10 units of this item to your cart",
//           product
//         });
//       }

//       existingItem.quantity = newQuantity;
//       existingItem.totalPrice = newQuantity * priceWithDiscount;
//       await existingItem.save();
//     } else {
//       // Create a new cart item
//       const cartItem = new Cart({
//         user: userId,
//         productId,
//         quantity: productQuantity,
//         priceWithDiscount: priceWithDiscount * productQuantity,
//         totalPrice: priceWithDiscount * productQuantity
//       });
//       await cartItem.save();     
//       console.log("cart itemsssss::",cartItem)

//     }

//     // Redirect to the cart page after successfully adding the product
//     res.redirect("/cart");
//   } catch (error) {
//     console.error("Error adding product to cart:", error);
//     res.status(500).json({ error: "Failed to add product to cart" });
//   }
// };

const addtocart = async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const { quantity, productId } = req.body;

    // Default quantity to 1 if not provided
    const productQuantity = parseInt(quantity) || 1;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Fetch the product with the offer populated
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

    // Calculate discounted price if offer exists and is active
    let discountedPrice = product.price;
    if (product.offer && product.offer.Status && product.offer.ExpiryDate > Date.now()) {
      if (product.offer.DiscountType === "percentage") {
        const discount = (product.price * product.offer.DiscountValue) / 100;
        discountedPrice = Math.max(0, product.price - discount); // Prevent negative price
      } else if (product.offer.DiscountType === "fixed") {
        discountedPrice = Math.max(0, product.price - product.offer.DiscountValue);
      }
    }

    const existingItem = await Cart.findOne({ user: userId, productId });

    if (existingItem) {
      const newQuantity = existingItem.quantity + productQuantity;

      // Ensure the new quantity doesn't exceed stock or a maximum limit
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
      // Create a new cart item
      const cartItem = new Cart({
        user: userId,
        productId,
        quantity: productQuantity,
        priceWithDiscount: discountedPrice,
        totalPrice: productQuantity * discountedPrice
      });
      await cartItem.save();
    }

    // Redirect to the cart page after successfully adding the product
    res.redirect("/cart");
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ error: "Failed to add product to cart" });
  }
};

module.exports = {
  addtocart,
  loadcartpage,
  removecart,
  placeOrder,
  updateQuantity,
  getProductStock,
  razorpayy,
  applycoupon
};
