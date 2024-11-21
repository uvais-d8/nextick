const bcrypt = require("bcrypt");
const User = require("../model/usermodal");
const Products = require("../model/productsmodal");
const Cart = require("../model/cartmodal");
const saltround = 10;
const path = require("path");
const userotpverification = require("../model/otpverification");
const nodemailer = require("nodemailer");
const googlemodal = require("../model/googlemodal");
const Address = require("../model/addressmodal");
const Orders = require("../model/ordersmodal");
const { OAuth2Client } = require("google-auth-library");
const { Console, profile, log, error } = require("console");
const Category = require("../model/categorymodal");
const addresses = require("../model/addressmodal");
const client = new OAuth2Client(
  "458432719748-rs94fgenq571a8jfulbls7dk9i10mv2o.apps.googleusercontent.com"
);
require("dotenv").config();
const updateUsername = async (req, res) => {
  try {
    const { userId, newName, newPhone } = req.body;
    console.log(req.body);

    // Check if newName is provided
    if (!newName) {
      return res.status(400).json({ error: "New name is required" });
    }

    // Update the user in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name: newName, phone: newPhone },
      { new: true } // Return the updated user document
    );

    console.log(updatedUser);

    // If the user is not found, return an error
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // If successful, return the updated user information
    return res.status(200).json({
      message: "Username and phone number updated successfully",
      user: updatedUser
    });
  } catch (error) {
    // Log the error message for debugging
    console.error("Error:", error);

    // Send an error response to the client
    return res
      .status(500)
      .json({ error: "Server error. Please try again later." });
  }
};  
const getProductStock = async (req, res) => {
  const { cartId } = req.params;
  try {
      const cartItem = await Cart.findById(cartId).populate('productId');
      if (!cartItem) {
          return res.status(404).json({ success: false, message: "Cart item not found" });
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
const editaddress = async (req, res) => {
  const { id } = req.params;
  console.log("id is:", id);

  const {
    firstname,
    lastname,
    address,
    email,
    phone,
    place,
    city,
    pincode,
    district
  } = req.body;

  try {
    const updatedAddress = await Address.findByIdAndUpdate(
      id,
      {
        firstname,
        lastname,
        address,
        email,
        phone,
        place,
        city,
        pincode,
        district
      },
      { new: true }
    );

    console.log(updatedAddress);

    if (!updatedAddress) {
      return res.status(404).send("Address not found");
    }

    // After successful update, redirect the user to the address page
    res.redirect("/address");
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).send("Server Error");
  }
};
const loadViewDetails = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    console.log(orderId, itemId);
    const order = await Orders.findById(orderId)
      .populate("userId") // Populate the user
      .populate("items.productId"); // Populate the productId for each item in the items array
    console.log(order.items);
    if (!order) {
      return res.status(404).send("Order not found");
    }
    const product = order.items.find(item => item._id.toString() === itemId);
    console.log(product);
    if (!product) {
      return res.status(404).send("Product not found in this order");
    }
    res.render("orderDetails", { order, product });
  } catch (error) {
    res.status(500).send(error);
    console.log("error: ", error);
  }
};
const ordertracking = async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch the order by ID and populate items' product details
    const order = await Orders.findById(id);
    const product = await Products.findById(id);
    console.log(order);
    console.log(product);

    if (!order) {
      console.log("Order not found");
      return res.render("orders");
    }

    // Render the order details on the tracking page
    res.render("ordertracking", { order, product });
  } catch (error) {
    console.log("Error fetching order:", error);
    res.status(500).send("Server error");
  }
};
// Load Forgot Password Page
const loadforgotpassword = (req, res) => {
  res.render("forgotpassword");
  req.session.message = null; // Clear message after rendering
};
// Function to send OTP to email
const sendotptoemail = async (req, res) => {
  const { email } = req.body;
  req.session.userEmail = email;
  console.log(email);

  try {
    if (!email) {
      const message = "You didn't enter any email.";
      console.log(message);
      return res.render("forgotpassword", {
        message: "You didn't enter any email"
      });
    }

    // Check if the email exists in the user schema
    const existingUser = await User.findOne({ email: email });
    console.log(existingUser);

    if (!existingUser) {
      const message = "This email doesn't exist.";
      console.log(message);
      return res.render("forgotpassword", {
        message: "This email doesn't exist."
      });
    }

    // Generate OTP and send email
    const otp = generateOtp();
    console.log("Generated OTP:", otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      req.session.message =
        "Error sending verification email. Please try again.";
      return res.redirect("/forgotpassword");
    }

    // Store OTP and email data in session for verification
    req.session.userOTP = otp;
    req.session.userEmail = email; // Store email for verifying user
    res.render("passwordverification"); // Render OTP verification page
  } catch (error) {
    console.log("Error:", error);
    req.session.message = "An unexpected error occurred. Please try again.";
    res.redirect("/forgotpassword");
  }
};
// Function to verify OTP entered by user
const verifyotpemail = async (req, res) => {
  const { otp } = req.body;

  try {
    // Check if the OTP from user input matches the OTP stored in the session
    if (otp == req.session.userOTP) {
      // Clear OTP from session after successful verification
      req.session.userOTP = null;
      res.render("newpassword"); // Load the new password page
    } else {
      // If OTP doesn't match, show error message on the verification page
      req.session.message = "Invalid OTP. Please try again.";
      console.log("Invalid OTP. Please try again");
      res.render("passwordverification", {
        message: "Invalid OTP. Please try again"
      });
    }
  } catch (error) {
    console.error("OTP verification error", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
// Load New Password Page// Load New Password Page
const loadnewpassword = (req, res) => {
  res.render("newpassword", { message: req.session.message || null });
  req.session.message = null; // Clear message after rendering
};
const setnewpassword = async (req, res) => {
  const newPassword = req.body.newPassword; // Assuming new password
  const confirmPassword = req.body.confirmPassword; // Confirm password

  // Basic password validation
  if (!newPassword || newPassword.length < 6) {
    req.session.message = "Password must be at least 6 characters long.";
    return res.redirect("/newpassword");
  }

  // Password complexity (Optional): e.g., at least one letter, one number, one special character
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;
  if (!passwordPattern.test(newPassword)) {
    req.session.message =
      "Password must include a uppercase letter, lowercase letter,and a number.";
    return res.redirect("/newpassword");
  }

  // Confirm password validation
  if (newPassword !== confirmPassword) {
    req.session.message = "Passwords do not match.";
    return res.redirect("/newpassword");
  }

  // Check if user passed OTP verification
  if (!req.session.userEmail) {
    req.session.message =
      "Session expired. Please start the reset process again.";
    return res.redirect("/newpassword");
  }

  try {
    const email = req.session.userEmail;
    const user = await User.findOne({ email });

    if (!user) {
      req.session.message = "User not found.";
      return res.redirect("/newpassword");
    }

    // Generate salt and hash the password
    const salt = await bcrypt.genSalt(saltround);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    req.session.userEmail = null;
    req.session.message = "Password updated successfully. Please log in.";
    res.redirect("/login");
  } catch (error) {
    console.error("Error changing password:", error);
    req.session.message = "Failed to update password. Please try again.";
    res.redirect("/newpassword");
  }
};
const placeOrder = async (req, res) => {
  const {
    email,
    phone,
    paymentMethod,
    items, // Assume items contain product IDs and quantities
    pincode,
    district,
    firstname,
    place,
    city,
    lastname,
    address
  } = req.body;

  const userId = req.session.userId;

  try {
    // Fetch product details for each item
    const cartItems = await Promise.all(
      items.map(async item => {
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
          total: product.price * item.quantity
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
        district
      },
      orderTotal
    });

    // Save the order to the database
    await newOrder.save();

    // Decrease the stock for each product
    await Promise.all(
      cartItems.map(async item => {
        await Products.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } }, // Decrease stock
          { new: true } // Return updated product
        );
      })
    );

    // Clear the user's cart from the database
    await Cart.deleteMany({});

    res.json({ success: true });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to place order." });
  }
};
const loadorderss = async (req, res) => {
  try {
    const orders = await Orders.find({ userId: req.session.userId })
      .populate({
        path: "items.productId",
        select: "name images description price"
      })
      .sort({ createdAt: -1 }); // Sort orders by creation date, descending

    res.render("orders", { orders });
  } catch (error) {
    console.error("Error during load orders", error);
    res.status(500).send("Failed to load orders.");
  }
};
const loadaddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log(userId);
    const addresses = await Address.find({});
    res.render("address", { addresses });
  } catch (error) {
    console.log(error);
  }
};
const addaddress = async (req, res) => {
  const userId = req.session.userId;
  const addresses =await Address.find({})
  if (!userId) {
    req.session.message = "User not authenticated.";
    return res.redirect("/login"); // Or redirect to login
  }

  console.log(userId);

  try {
    // Destructure values from req.body
    const {
      firstname,
      lastname,
      address,
      phone,
      email,
      place,
      city,
      pincode,
      district
    } = req.body;

    // Validation for required fields
    if (!firstname || !lastname || !address || !phone || !email || !place || !city || !pincode || !district) {
      req.session.message = "All fields are required.";
      console.log("All fields are required.");
      return res.render("address",{addresses,message:"All fields are required"});
    }

    // Email validation (basic check for a valid email)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      req.session.message = "Invalid email format.";
      return res.render("address",{addresses,message:"Invalid email format"});
    }

    // Phone validation (basic check for valid phone)
    const phoneRegex = /^[0-9]{10}$/; // Modify based on your country
    if (!phoneRegex.test(phone)) {
      req.session.message = "Invalid phone number.";
      return res.render("address",{addresses,message:"Invalid phone number"});
    }

    // Check if an address with the same email already exists for this user
    const existingAddress = await Address.findOne({ user: userId, email });
    if (existingAddress) {
      req.session.message = "Address with this email already exists for this user.";
      return res.render("address",{addresses,message:"Address with this email already exists for this user"});
    }

    // Create a new address document
    const newAddress = new Address({
      user: userId,
      firstname,
      lastname,
      address,
      phone,
      email,
      place,
      city,
      pincode,
      district
    });

    // If the user has no existing address, mark this as the default address
    const userAddresses = await Address.find({ user: userId });
    if (userAddresses.length === 0) {
      newAddress.isDefault = true; // Mark the first address as the default
    }

    // Save the address document to the database
    await newAddress.save();
    console.log("New address saved:", newAddress);

    // Set a success message and redirect
    req.session.message = "Address added successfully!";
    req.session.useraddress = newAddress; // You may want to update this based on your needs

    res.redirect("/address");
  } catch (error) {
    console.error("Adding address error:", error);
    req.session.message = "Error adding address. Please try again.";
    res.redirect("/address");
  }
};
const loadprofile = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log("Session User ID:", userId);

    // Find the user by userId
    const user = await User.findOne({ _id: userId }); // Use `user` model as defined in schema
    if (!user) {
      console.log("User not found");
      return res.redirect("/login");
    }

    // Format the date of account creation
    const createdAt = user.registered.toLocaleDateString("en-GB");
    const orders = await Orders.find({}) .populate({
      path: "items.productId",
      select: "name price images",
    })
    const address = await Address.findOne({ isDefault: true });

    // Render profile page with user info, formatted date, and address if found
    console.log(orders);
    res.render("profile", { user, createdAt, address, orders });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.redirect("/login"); // Redirect on error
  }
};
// Register user and send OTP
const registerUser = async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  try {
    // Check for empty fields
    if (!username || !email || !password || !confirmPassword) {
      req.session.message = "All fields are required.";
      return res.render("signup", { message: "All fields are required" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      // req.session.message = "Invalid email format.";
      return res.render("signup", { message: "Invalid email format" });
    }
    //check the password length if it is 6 charecters
    if (password.length < 6) {
      // req.session.message = "Password must be at least 6 characters long.";
      return res.render("signup", {
        message: "Password must be at least 6 characters long"
      });
    }
    // Check if passwords match
    if (password !== confirmPassword) {
      // req.session.message = "Passwords do not match.";
      return res.render("signup", { message: "Passwords do not match" });
    }

    // Password validation (minimum length and complexity)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!passwordRegex.test(password)) {
      // req.session.message = "Password must include an uppercase letter, a lowercase letter, and a number.";

      return res.render("signup", {
        message:
          "Password must include a uppercase letter, lowercase letter,and a number"
      });
    }

    // Check for existing user
    const alreadyuser = await User.findOne({ email });
    if (alreadyuser) {
      // req.session.message = "Email is already registered.";

      return res.render("signup", {
        message: "Email is already registered"
      });
    }

    // Generate OTP and send verification email
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      // req.session.message =
      //   "Error sending verification email. Please try again.";
      console.log("Error sending verification email. Please try again.");
      return res.redirect("/signup", {
        message: "Error sending verification email. Please try again"
      });
    }

    // Store OTP and user data in session
    req.session.userOTP = otp;
    req.session.userData = { username, email, password };
    console.log(otp);

    // Redirect to OTP verification page
    res.redirect("/verify-otp");
  } catch (error) {
    console.error("Signup error:", error);
    req.session.message = "Internal server error. Please try again later.";
    res.redirect("/signup");
  }
};
// Load OTP Verification Page
const loadVerifyOtp = async (req, res) => {
  res.render("verification", {});
  req.session.message = null;
};
// Verify OTP and create user
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp === req.session.userOTP) {
      const user = req.session.userData;
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const newUser = new User({
        name: user.username,
        email: user.email,
        password: hashedPassword,
        verified: true,
        ...(user.googleId ? { googleId: user.googleId } : {}) // Only include googleId if it exists
      });

      await newUser.save();
      req.session.user = newUser._id;

      // Clear session data after successful OTP verification
      req.session.userOTP = null;
      req.session.userData = null;

      res.redirect("/home");
    } else {
      req.session.message = "Invalid OTP. Please try again.";
      res.render("verification", { message: "Invalid OTP. Please try again" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
    console.error("OTP verification error", error);
  }
};
// Resend OTP
const resendOtp = async (req, res) => {
  console.log(req.session.userData);
  try {
    const { email } = req.session.userData;
    console.log("hioii");
    console.log(req.session.userData);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }
    const otp = generateOtp();
    req.session.userOTP = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log(otp);
      console.log("success to resend OTP");
    } else {
      console.log("Failed to resend OTP, please try again");
      res.status(500).json({
        success: false,
        message: "Failed to resend OTP, please try again"
      });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    return res.render("verification");

    // return res
    //   .status(500)
    //   .json({ success: false, message: "Server error, please try again" });
  }
};
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.SERVEREMAIL,
        pass: process.env.PASS // Make sure to store this securely in environment variables
      }
    });

    const info = await transporter.sendMail({
      from: process.env.SERVEREMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email);
    console.log(password);
    // Find the user by email
    const user = await User.findOne({ email });

    if (email === "" || password === "") {
      console.log("all fields are required");
      return res.render("login", { message: "All fields are required" });
    }

    if (!user) {
      console.log("User doesn't exist");
      return res.render("login", { message: "User doesn't exist" });
    }

    // Compare the provided password with the stored hashed password
    const ismatch = await bcrypt.compare(password, user.password);

    if (!ismatch) {
      console.log("Incorrect password");
      return res.render("login", { message: "Incorrect password" });
    }
    if (user.blocked) {
      return res.render("login", {
        message: "you have been blocked by the admin"
      });
    }
    req.session.userId = user._id;
    console.log(req.session);

    // Redirect to home page after successful login
    res.redirect("/home");
  } catch (error) {
    console.error("Error during login:", error);
    return res.render("signup", { message: "Something went wrong" });
  }
};
const loadsignup = (req, res) => {
  res.render("signup", { layout: false });
};
const loadlogin = (req, res) => {
  if (req.session.userId) {
    return res.redirect("/home");
  }
  res.render("login", { layout: false });
};
const loadhome = async (req, res) => {
  try {
    // Fetch products and populate their category data
    const products = await Products.find({ islisted: true }) // Fetch only listed products
      .populate({
        path: "category", // Reference the category field
        match: { islisted: true }, // Only include listed categories
        select: "category islisted" // Only include necessary fields from the category
      });

    // Filter out products where the category is not listed
    const filteredProducts = products.filter(product => product.category);

    // Render the home page with filtered products
    res.render("home", { products: filteredProducts });
  } catch (err) {
    console.error("Error loading home page:", err);
    res.status(500).send("Failed to load home page");
  }
};
const loadproducts = async (req, res) => {
  try {
    // Step 1: Fetch all categories and products
    const categories = await Category.find({});
    const products = await Products.find({});

    // Step 2: Update product categories with ObjectId if necessary
    for (const product of products) {
      const category = categories.find(
        cat => cat.category === product.category
      );

      if (category) {
        product.category = category._id; // Update product with category's ObjectId
        await product.save();
        console.log(
          `Updated product ${product.name} with category ${category.category}`
        );
      } else {
        // console.warn(`No matching category found for product ${product.name}`);
      }
    }

    // Step 3: Fetch listed products with their populated category data
    const listedProducts = await Products.find({ islisted: true }) // Only fetch listed products
      .populate({
        path: "category", // Populate the 'category' field
        match: { islisted: true }, // Only include listed categories
        select: "category brand islisted" // Select relevant fields
      });

    // Step 4: Filter products that have a valid category (category exists)
    const filteredProducts = listedProducts.filter(product => product.category);

    if (filteredProducts.length === 0) {
      console.warn("No products with valid listed categories found.");
      return res.render("products", { message: "No products available." });
    }

    // Step 5: Render the products page with filtered products
    res.render("products", { products: filteredProducts, categories });
  } catch (error) {
    console.error("Error fetching and updating products:", error);
    res.status(500).send("Failed to fetch or update products.");
  }
};
const singleproduct = async (req, res) => {
  const productId = req.params.id;
  // console.log(productId);
  try {
    const product = await Products.findById(productId);
    const products = await Products.find({ islisted: true });
    // console.log(product);
    if (!product) {
      return res.status(404).send("Product not found");
    }
    res.render("singleproduct", { product, products });
  } catch (error) {
    console.error(error);
  }
};
const loadshop = (req, res) => {
  try {
    res.redirect("/shop");
  } catch (error) {
    console.error(error);
  }
};
const logout = (req, res) => {
  req.session.userId = null;
  res.redirect("/login");
};
const loadaboutpage = (req, res) => {
  res.render("about");
};
const loadcontactpage = (req, res) => {
  res.render("contact");
};
const loadcartpage = async (req, res) => {
  try {
    const userId = req.session.userId;

    const carts = await Cart.find({ user: userId }).populate("productId");

    // If no items in the cart, render the page with a message
    if (!carts || carts.length === 0) {
      return res.render("cart", {
        message: "There are no items in your cart at the moment"
      });
    }

    // Calculate totals (if needed)
    const subtotal = carts.reduce(
      (acc, cart) => acc + cart.productId.price * cart.quantity,
      0
    );

    const shippingRate = 50; // Static shipping rate for now
    const total = subtotal + shippingRate;

    // Add the first image of each product to the cart items
    carts.forEach(cart => {
      if (cart.productId.images && cart.productId.images.length > 0) {
        cart.firstImage = cart.productId.images[0]; // Store the first image
      }
    });
    console.log(carts);

    // If cart has items, render the cart with the products
    res.render("cart", {
      carts,
      subtotal,
      shippingRate,
      total
    });
  } catch (error) {
    console.log("Error occurred during cart page:", error);
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
const removeorder = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Find the order to get its items
    const order = await Orders.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Check if the order is already canceled
    if (order.status === "canceled") {
      return res
        .status(400)
        .json({ success: false, message: "Order is already canceled." });
    }

    // Iterate through order items and update product stock
    await Promise.all(
      order.items.map(async (item) => {
        const product = await Products.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      })
    );

    // Update the order status to "canceled"
    order.status = "canceled";
    await order.save();

    res.status(200).json({ success: true, message: "Order canceled successfully and stock updated." });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({ success: false, message: "Error canceling order." });
  }
};
const removeItem = async (req, res) => {
  const { orderId, itemId } = req.params;
  try {
    // Find the order and retrieve the item
    const order = await Orders.findOne({ _id: orderId, "items._id": itemId });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order or item not found." });
    }

    // Find the specific item within the order
    const item = order.items.find(item => item._id.toString() === itemId);

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in the order." });
    }

    // Check if the item's status is 'delivered'
    if (item.status === "delivered") {
      return res.status(400).json({
        success: false,
        message: "Item is already delivered and cannot be canceled."
      });
    }

    // Update the item status to "canceled"
    await Orders.findOneAndUpdate(
      { _id: orderId, "items._id": itemId },
      { $set: { "items.$.status": "canceled" } }
    );

    // Update the stock of the product
    const product = await Products.findById(item.productId); // Assuming `productId` is stored in the item
    if (product) {
      product.stock += item.quantity;
      await product.save();
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Associated product not found." });
    }

    res
      .status(200)
      .json({ success: true, message: "Item canceled successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error canceling item." });
  }
};
const removeaddress = async (req, res) => {
  const { id } = req.params;
  console.log({ id });
  try {
    await Address.findByIdAndDelete(id);
    console.log(id);
    const address = await Address.find({});
    console.log("address deleted successfully");
    res.redirect("/address");
  } catch (error) {
    console.log("error during cancel order", error);
    res.redirect("/address");
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
const checkout = async (req, res) => {
  try {
    const userId = req.session.userId; // Get the user ID from the session
    // console.log(req.session.userId);
    // console.log(userId);

    const alladdresses = await Address.find({});
    const addresses = await Address.findOne({});

    const carts = await Cart.find({ user: userId })
      .populate("user")
      .populate("productId");
    // Calculate totals (if needed)
    const subtotal = carts.reduce(
      (acc, cart) => acc + cart.productId.price * cart.quantity,
      0
    );

    const shippingRate = 50; // Static shipping rate for now
    const total = subtotal + shippingRate;

    res.render("checkout", {
      addresses,
      carts,
      subtotal,
      shippingRate,
      total,
      alladdresses
    });
  } catch (error) {
    console.error(error); // Log any errors for debugging
    res.status(500).send("Internal Server Error"); // Send a response in case of error
  }
};
const changepassword = async (req, res) => {
  const { currentPassword, newpassword, confirmpassword } = req.body;
  const userId = req.session.userId;

  const user = await User.findOne({ _id: userId });
  const address = await Address.findOne({ isDefault: true });
  const orders = await Orders.find({});

  if (!req.session.userId) {
    req.session.message =
      "Session expired. Please start the reset process again.";
    return res.redirect("/profile");
  }

  try {
    if (!user) {
      req.session.message = "User not found.";
      return res.redirect("/profile");
    }

    const isPasswordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!currentPassword && newPassword == null) {
      res.redirect("/profile");
    }
    if (!isPasswordMatch) {
      return res.render("profile", {
        user,
        address,
        orders,
        message: "Current password is incorrect."
      });
    }

    if (newpassword !== confirmpassword) {
      return res.render("profile", {
        user,
        address,
        orders,
        message: "New password and confirm password do not match."
      });
    }

    if (newpassword.length < 6) {
      return res.render("profile", {
        user,
        address,
        orders,
        message: "Password must be at least 6 characters long."
      });
    }

    const uppercasePattern = /[A-Z]/;
    const lowercasePattern = /[a-z]/;
    const numberPattern = /[0-9]/;

    if (
      !uppercasePattern.test(newpassword) ||
      !lowercasePattern.test(newpassword) ||
      !numberPattern.test(newpassword)
    ) {
      return res.render("profile", {
        user,
        address,
        orders,
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number."
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newpassword, salt);
    user.password = hashedPassword;
    await user.save();

    // Set success message in session
    req.session.successMessage = "Password updated successfully.";
    res.render("profile", {
      user,
      address,
      orders,
      success: "Password updated successfully"
    });
  } catch (error) {
    console.error("Error changing password:", error);
    req.session.message = "Failed to update password. Please try again.";
    res.redirect("/profile");
  }
};
const resendotpemail = async (req, res) => {
  console.log(req.session.userEmail);
  try {
    const email = req.session.userEmail;
    console.log("hioii");
    console.log(req.session.userEmail);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }
    const otp = generateOtp();
    req.session.userOTP = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log(otp);
      console.log("success to resend OTP");
    } else {
      console.log("Failed to resend OTP, please try again");
      res.status(500).json({
        success: false,
        message: "Failed to resend OTP, please try again"
      });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    return res.render("passwordverification");

    // return res
    //   .status(500)
    //   .json({ success: false, message: "Server error, please try again" });
  }
};
const updateDefaultAddress = async (req, res) => {
  const { addressId } = req.body;
  const userId = req.session.userId; // Assuming you're using authentication to identify the user.

  try {
    // Set all addresses' isDefault to false
    await Address.updateMany({ userId }, { $set: { isDefault: false } });

    // Update the clicked address to be default
    const updatedAddress = await Address.findByIdAndUpdate(
      addressId,
      { isDefault: true },
      { new: true }
    );

    if (updatedAddress) {
      res
        .status(200)
        .json({ success: true, message: "Default address updated" });
    } else {
      res.status(404).json({ success: false, message: "Address not found" });
    }
  } catch (error) {
    console.error("Error updating default address:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
const advancedSearch = async (req, res) => {
  try {
    const {
      query = "",
      sort,
      showOutOfStock,
      minPrice,
      maxPrice,
      category,
      rating
    } = req.query;

    // Base filter: only fetch listed products
    let filter = { islisted: true };

    // Text search (use regex for partial and case-insensitive match)
    if (query) {
      filter.name = { $regex: query, $options: "i" }; // Match query anywhere in the name (case-insensitive)
    }

    // Stock filter
    if (showOutOfStock === "exclude") {
      filter.stock = { $gt: 0 }; // Products with stock greater than 0
    }

    // Price filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Category filter
    if (category && category !== "all") {
      const categoryDoc = await Category.findOne({ category }); // Find the category by name
      if (categoryDoc) {
        filter.category = categoryDoc._id; // Use ObjectId for filtering
      }
    }

    // Rating filter
    if (rating && rating !== "all") {
      filter.averageRating = { $gte: parseFloat(rating) };
    }

    // Define sorting criteria
    let sortOption = {};
    switch (sort) {
      case "popularity":
        sortOption = { popularity: -1 }; // Assuming 'popularity' field tracks product popularity
        break;
      case "priceLowToHigh":
        sortOption = { price: 1 };
        break;
      case "priceHighToLow":
        sortOption = { price: -1 };
        break;
      case "averageRatings":
        sortOption = { averageRating: -1 }; // Assuming 'averageRating' field stores ratings
        break;
      case "featured":
        sortOption = { featured: -1 }; // Assuming 'featured' field indicates featured products
        break;
      case "newArrivals":
        sortOption = { createdAt: -1 }; // Assuming 'createdAt' tracks product addition date
        break;
      case "aToZ":
        sortOption = { name: 1 }; // Alphabetical order A to Z
        break;
      case "zToA":
        sortOption = { name: -1 }; // Reverse alphabetical order Z to A
        break;
      default:
        sortOption = {}; // Default to no sorting if no valid option is selected
    }

    // Fetch products with filters, search, and sorting
    const products = await Products.find(filter)
      .sort(sortOption)
      .collation({ locale: "en", strength: 2 }) // Case-insensitive sorting
      .populate("category", "category brand");

    if (req.xhr) {
      return res.json(products); // AJAX response for live search
    } else {
      res.render("products", {
        products,
        query,
        sort,
        showOutOfStock,
        minPrice,
        maxPrice,
        category,
        rating
      });
    }
  } catch (error) {
    console.error("Error during advanced search:", error);
    res.status(500).json({ message: "Error fetching products." });
  }
};
module.exports = {
  updateDefaultAddress,
  resendotpemail,
  ordertracking,
  changepassword,
  advancedSearch,
  removeorder,
  removeItem,
  loadprofile,
  checkout,
  loadcontactpage,
  addtocart,
  loadshop,
  loadaboutpage,
  loadcartpage,
  registerUser,
  loadlogin,
  loadsignup,
  login,
  loadhome,
  logout,
  loadproducts,
  loadVerifyOtp,
  resendOtp,
  verifyOtp,
  singleproduct,
  removecart,
  loadaddress,
  addaddress,
  placeOrder,
  loadorderss,
  removeaddress,
  loadforgotpassword,
  sendotptoemail,
  verifyotpemail,
  loadnewpassword,
  setnewpassword,
  editaddress,
  updateUsername,
  loadViewDetails,
  updateQuantity,
  getProductStock
};
