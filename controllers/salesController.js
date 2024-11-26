const Cart = require("../model/cartModel");
const Products = require("../model/productsmodal");
const Orders = require("../model/ordersmodal");

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
    address,
  } = req.body;

  const errors = {};

  // Validation
  if (!firstname) errors.firstname = "First name is required";
  if (!lastname) errors.lastname = "Last name is required";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email address";
  if (!phone || !/^[0-9]{10}$/.test(phone)) errors.phone = "Invalid phone number";
  if (!address) errors.address = "Address is required";
  if (!pincode || !/^[0-9]{6}$/.test(pincode)) errors.pincode = "Invalid pin code";
  if (!place) errors.place = "Place is required";
  if (!city) errors.city = "City is required";
  if (!district) errors.district = "District is required";
  if (!paymentMethod) errors.paymentMethod = "Payment method is required";
  if (!items || !Array.isArray(items) || items.length === 0) errors.items = "No items in the cart";

  // If validation errors exist, re-render the form with messages
  if (Object.keys(errors).length > 0) {
    return res.render("checkout", {
      message: "Validation failed",
      errors,
      formData: req.body, // Pass the input data back to the form
    });
  }

  try {
    // Fetch product details for each item
    const cartItems = await Promise.all(
      items.map(async (item) => {
        const product = await Products.findById(item.productId);

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found.`);
        }

        // Check if stock is sufficient
        if (item.quantity > product.stock) {
          throw new Error(`Insufficient stock for product: ${product.name}`);
        }

        return {
          productId: product._id,
          price: product.price,
          quantity: item.quantity,
          total: product.price * item.quantity,
        };
      })
    );

    // Calculate order total
    const orderTotal = cartItems.reduce((sum, item) => sum + item.total, 0);

    // Create a new order
    const newOrder = new Orders({
      userId,
      items: cartItems,
      paymentMethod,
      shippingAddress: {
        firstname,
        lastname,
        address,
        phone,
        email,
        place,
        city,
        pincode,
        district,
      },
      orderTotal,
    });

    // Save the order to the database
    await newOrder.save();

    // Decrease the stock for each product
    await Promise.all(
      cartItems.map(async (item) => {
        await Products.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } }, // Decrease stock
          { new: true } // Return updated product
        );
      })
    );

    // Clear the user's cart
    await Cart.deleteMany({ userId }); // Delete only this user's cart items

    res.json({ success: true });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to place order.",
    });
  }
};
const loadcartpage = async (req, res) => {
  try {
    const userId = req.session.userId;

    const carts = await Cart.find({ user: userId }).populate("productId");

    // If no items in the cart, render the page with a message
    if (!carts || carts.length === 0) {
      return res.render("cart", {
        carts: [], // Pass an empty array to avoid errors
        message: "There are no items in your cart at the moment"
      });
    }

    // Calculate totals
    const subtotal = carts.reduce(
      (acc, cart) => acc + (cart.productId.price || 0) * cart.quantity,
      0
    );
    const shippingRate = 50; // Static shipping rate for now
    const total = subtotal + shippingRate;

    // Add the first image of each product to the cart items
    carts.forEach(cart => {
      if (cart.productId.images && cart.productId.images.length > 0) {
        cart.firstImage = cart.productId.images[0];
      }
    });

    // Render the cart page with items
    res.render("cart", {
      carts,
      subtotal,
      shippingRate,
      total
    });
  } catch (error) {
    console.error("Error occurred during cart page:", error);
    res.status(500).send("Internal Server Error");
  }
};
const removecart = async (req, res) => {
  const { id } = req.params;

  try {
    // Step 1: Find the cart item to get the quantity and product ID
    const cartItem = await Cart.findById(id);
    if (!cartItem) {
      console.error("Cart item not found");
      return res.redirect("/cart");
    }

    // Step 3: Delete the cart item
    await Cart.findByIdAndDelete(id);

    console.log("Item deleted and stock updated successfully");
    res.redirect("/cart");
  } catch (error) {
    console.error("Error deleting item or updating stock:", error);
    res.redirect("/cart");
  }
};
const addtocart = async (req, res) => {
  const userId = req.session.userId; // Assume `req.user` contains the authenticated user's details

  // Early redirect if no user is authenticated
  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const { quantity, productId } = req.body;
    console.log(quantity);
    if (!quantity || !productId) {
      return res
        .status(400)
        .json({ error: "Quantity and Product ID are required" });
    }

    // Find the product in the database
    const product = await Products.findById(productId);
    console.log("hellooo ::", product.stock);
    if (!product) {
      return res.render("singleproduct", { message: "Product not found" });
    }

    // Check if the product is listed and has enough stock
    if (!product.islisted) {
      return res.render("singleproduct", {
        message: "This product is currently unavailable",
        product
      });
    }

    if (product.stock < quantity) {
      console.log("stock : ", product.stock);
      console.log(quantity);

      return res.render("singleproduct", {
        message: "Not enough stock available for this quantity",
        product
      });
    }

    // Check if the product already exists in the user's cart
    const existingItem = await Cart.findOne({ user: userId, productId });

    if (existingItem) {
      // Update the quantity and total
      const newQuantity = existingItem.quantity + parseInt(quantity);

      // Ensure the new quantity doesn't exceed stock or a maximum limit
      if (newQuantity > 10) {
        return res.render("singleproduct", {
          message: "Cannot add more than 10 units of this item to your cart",
          product
        });
      }
      existingItem.quantity = newQuantity;
      existingItem.total = newQuantity * product.price;
      await existingItem.save();
    } else {
      // Create a new cart item
      const cartItem = new Cart({
        user: userId,
        productId,
        quantity,
        total: product.price * quantity
      });
      await cartItem.save();
    }

    // Decrease stock of the product after adding to cart
    // product.stock -= quantity;
    await product.save();

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
  getProductStock
};
