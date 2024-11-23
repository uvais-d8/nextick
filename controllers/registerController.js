const bcrypt = require("bcrypt");
const User = require("../model/usermodal");
const { OAuth2Client } = require("google-auth-library");
const { Console, profile, log, error } = require("console");
const Category = require("../model/categoryModel");
const nodemailer = require("nodemailer");
const googlemodal = require("../model/googleModel");
const client = new OAuth2Client(
  "458432719748-rs94fgenq571a8jfulbls7dk9i10mv2o.apps.googleusercontent.com"
);
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

const logout = (req, res) => {
    req.session.userId = null;
    res.redirect("/login");
  };
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
  const loadVerifyOtp = async (req, res) => {
    res.render("verification");
  };
  const verifyOtp = async (req, res) => {
    try {
      const { otp } = req.body;
  
      // Debug logs
      console.log("Received OTP from user:", otp);
      console.log("Stored OTP in session:", req.session.userOTP);
  
      // Check if session data exists
      if (!req.session.userOTP || !req.session.userData) {
        return res.render("verification", {
          message: "Session expired. Try again."
        });
      }
  
      // Verify OTP
      if (otp === req.session.userOTP) {
        const user = req.session.userData;
  
        // Hash the password
        const hashedPassword = await bcrypt.hash(user.password, 10);
  
        // Create a new user object
        const newUser = new User({
          name: user.username,
          email: user.email,
          password: hashedPassword,
          verified: true,
          ...(user.googleId ? { googleId: user.googleId } : {})
        });
  
        // Save the user to the database
        await newUser.save();
  
        // Set the session user
        req.session.user = newUser._id;
  
        // Clear session data
        delete req.session.userOTP;
        req.session.userData = null;
  
        // Redirect to home
        return res.redirect("/home");
      } else {
        // OTP mismatch
  
        console.log(req.session.userOTP.toString());
        console.error("OTP mismatch: Received OTP does not match session OTP.");
        return res.render("verification", {
          message: "Invalid OTP. Please try again."
        });
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      res
        .status(500)
        .render("error", {
          message: "Something went wrong. Please try again later."
        });
    }
  };
  
  const resendOtp = async (req, res) => {
    console.log(req.session.userData);
    try {
      const { email } = req.session.userData;
      console.log(req.session.userData);
      if (!email) {
        return res
          .status(400)
          .json({ success: false, message: "Email not found in session" });
      }
      const newotp = generateOtp();
      req.session.userOTP = newotp;
      await req.session.save();   
      console.log("this is newotp :", req.session.userOTP);
      const emailSent = await sendVerificationEmail(email, newotp);
      if (emailSent) {
        console.log("success to resend OTP");
        console.log(newotp);
      } else {
        console.log("Failed to resend OTP, please try again");
        res.status(500).json({
          success: false,
          message: "Failed to resend OTP, please try again"
        });
      }
    } catch (error) {
      console.error("Error resending OTP", error);
      return res.render("verification",{success:"OTP resend Successfully"});
  
      // return res
      //   .status(500)
      //   .json({ success: false, message: "Server error, please try again" });
    }
  };
  function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
// Load Forgot Password Page
const loadforgotpassword = (req, res) => {
    res.render("forgotpassword");
    req.session.message = null; // Clear message after rendering
  };
  module.exports = {
    loadforgotpassword,
    registerUser,
    loadlogin,
    loadsignup,
    login,
    logout,
    loadVerifyOtp,
    resendOtp,
    verifyOtp,
  };
  