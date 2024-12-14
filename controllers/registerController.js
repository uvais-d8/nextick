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
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
const logout = (req, res) => {
 try {
  console.log("oldddd::",req.session)

  req.session.userId = null;
  req.session.passport = null;
  console.log("newww ::",req.session)
  res.redirect("/login");
 } catch (error) {
  console.log("error to logout",error)
 }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email);
    console.log(password);
    const user = await User.findOne({ email });
    if (email === "" || password === "") {
      console.log("all fields are required");
      return res.render("login", { message: "All fields are required" });
    }
    if (!user) {
      console.log("User doesn't exist");
      return res.render("login", { message: "User doesn't exist" });
    }
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
    res.redirect("/");
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
    return res.redirect("/");
  }
  res.render("login", { layout: false });
};
const registerUser = async (req, res) => {
  const { username, email, phone, password } = req.body;

  try {
    // Only check for email existence here
    const alreadyUser = await User.findOne({ email });
    if (alreadyUser) {
      return res.render("signup", {
        message: "Email is already registered",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      console.log("Error sending verification email. Please try again.");
      return res.redirect("/signup", {
        message: "Error sending verification email. Please try again",
      });
    }

    req.session.userOTP = otp;
    req.session.userData = { username, email, password, phone };
    console.log(otp);

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
        phone: user.phone,
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
      return res.redirect("/");
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
    res.status(500).render("verification", {
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
    return res.render("verification", { success: "OTP resend Successfully" });
  }
};
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
  verifyOtp
};
