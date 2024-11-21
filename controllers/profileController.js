const bcrypt = require("bcrypt");
const User = require("../model/userModel");
const saltround = 10;
const nodemailer = require("nodemailer");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersModel");

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
    try {
        const { addressId } = req.body;
        const userId = req.session.userId; // Assuming session contains user ID

        if (!addressId || !userId) {
            return res.status(400).json({ success: false, message: "Invalid request" });
        }

        // Update the default address for the user
        await Address.updateMany({ userId }, { $set: { default: false } }); // Remove default from all addresses
        await Address.findByIdAndUpdate(addressId, { $set: { default: true } });

        res.json({ success: true });
    } catch (error) {
        console.error("Error updating default address:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
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
    const orders = await Orders.find({ userId: user }).populate({
      path: "items.productId",
      select: "name price images"
    });
    const address = await Address.findOne({ isDefault: true });

    // Render profile page with user info, formatted date, and address if found
    console.log(orders);
    res.render("profile", { user, createdAt, address, orders });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.redirect("/login"); // Redirect on error
  }
};
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
      // req.session.message = "Invalid OTP. Please try again.";
      console.log("Invalid OTP. Please trhghyhghhy again");
      res.render("passwordverification", {
        message: "Invalid OTP. Please yuyutytytytry again"
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
const loadaddress = async (req, res) => {
  try {
    const userId = req.session.userId; // Get the user ID from the session
    if (!userId) {
      return res.redirect("/login"); // Redirect to login if no user is logged in
    }


    const addresses = await Address.find({ user:userId }); // Find addresses for the user
    console.log("User ID:", userId);
    console.log("Addresses:", addresses);

    res.render("address", { addresses }); // Render the address page with the fetched addresses
  } catch (error) {
    console.error("Error loading addresses:", error);
    res.status(500).send("Internal server error"); // Handle unexpected errors
  }
};

const addaddress = async (req, res) => {
   const userId = req.session.userId; // Get the user ID from the session
    if (!userId) {
      return res.redirect("/login"); // Redirect to login if no user is logged in
    }
    const addresses = await Address.find({ user:userId }); // Find addresses for the user
   if (!userId) {
    req.session.message = "User not authenticated.";
    console.log("User not authenticated.");
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
    if (
      !firstname ||
      !lastname ||
      !address ||
      !phone ||
      !email ||
      !place ||
      !city ||
      !pincode ||
      !district
    ) {
      req.session.message = "All fields are required.";
      console.log("All fields are required.");
      return res.render("address", {
        addresses,
        message: "All fields are required"
      });
    }

    // Email validation (basic check for a valid email)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      req.session.message = "Invalid email format.";
      return res.render("address", {
        addresses,
        message: "Invalid email format"
      });
    }

    // Phone validation (basic check for valid phone)
    const phoneRegex = /^[0-9]{10}$/; // Modify based on your country
    if (!phoneRegex.test(phone)) {
      req.session.message = "Invalid phone number.";
      return res.render("address", {
        addresses,
        message: "Invalid phone number"
      });
    }

    // Check if an address with the same email already exists for this user
    const existingAddress = await Address.findOne({ user: userId, email });
    if (existingAddress) {
      req.session.message =
        "Address with this email already exists for this user.";
      return res.render("address", {
        addresses,
        message: "Address with this email already exists for this user"
      });
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
module.exports = {
  updateDefaultAddress,
  resendotpemail,
  changepassword,
  loadprofile,
  loadaddress,
  addaddress,
  removeaddress,
  sendotptoemail,
  verifyotpemail,
  loadnewpassword,
  setnewpassword,
  editaddress,
  updateUsername
};
