const bcrypt = require("bcrypt");
const User = require("../model/usermodal");
const saltround = 10;
const nodemailer = require("nodemailer");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersmodal");

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
// const changepassword = async (req, res) => {
//   try {
//     const { currentPassword, newpassword, confirmpassword } = req.body;
//     const userId = req.session.userId;

//     if (!userId) {
//       return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
//     }

//     const user = await User.findOne({ _id: userId });
//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found." });
//     }

//     const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
//     if (!isPasswordMatch) {
//       return res.status(400).json({ success: false, message: "Current password is incorrect." });
//     }

//     if (newpassword !== confirmpassword) {
//       return res.status(400).json({ success: false, message: "New password and confirm password do not match." });
//     }

//     if (newpassword.length < 6) {
//       return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
//     }

//     const uppercasePattern = /[A-Z]/;
//     const lowercasePattern = /[a-z]/;
//     const numberPattern = /[0-9]/;

//     if (
//       !uppercasePattern.test(newpassword) ||
//       !lowercasePattern.test(newpassword) ||
//       !numberPattern.test(newpassword)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
//       });
//     }

//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(newpassword, salt);
//     user.password = hashedPassword;
//     await user.save();

//     return res.json({ success: true, message: "Password updated successfully." });
//   } catch (error) {
//     console.error("Error changing password:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

const changepassword = async (req, res) => {
  const { currentPassword, newpassword, confirmpassword } = req.body;
  const userId = req.session.userId;
  console.log("hellooo");
  const user = await User.findOne({ _id: userId });

  //  const createdAt = user.registered.toLocaleDateString("en-GB");
  const address = await Address.findOne({ isDefault: true });
  const orders = await Orders.find({ userId: user }).populate({
    path: "items.productId",
    select: "name price images"
  });
  if (!req.session.userId) {
    req.session.message =
      "Session expired. Please start the reset process again.";
    return res.render("profile", {
      user,
      address,
      orders,
      message: "Session expired.Start the reset process again"
    });
  }

  try {
    if (!user) {
      req.session.message = "User not found.";
      return res.render("profile", {
        user,
        address,
        orders,
        message: "User not found"
      });
    }

    const isPasswordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!currentPassword && newpassword == null) {
      res.redirect("/profile");
    }
    if (!currentPassword || !newpassword) {
      return res.render("profile", {
        user,
        address,
        orders,
        message: "You didn't entered all fields."
      });
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
    console.log("error::", error);
    res.redirect("/profile");
  }
};
const resendotpemail = async (req, res) => {
  console.log("Session email:", req.session.userEmail);
  try {
    const email = req.session.userEmail;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email not found in session",
      });
    }

    // Generate new OTP and save it in session
    const newotp = generateOtp();
    req.session.userOTP = newotp;
    console.log("New OTP generated and stored in session:", newotp);

    // Send the email
    const emailSent = await sendVerificationEmail(email, newotp);
    if (emailSent) {
      console.log("OTP resent successfully");
      return res.render("passwordverification",{
        success: "OTP resent successfully",
      });
    } else {
      console.log("Failed to send OTP");
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP, please try again",
      });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// const resendotpemail = async (req, res) => {
//   console.log(req.session.userEmail);
//   try {
//     const email = req.session.userEmail;
//     if (!email) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Email not found in session" });
//     }
//     const newotp = generateOtp();
//     req.session.userOTP = newotp;
//     const emailSent = await sendVerificationEmail(email, newotp);
//     if (emailSent) {
//       console.log("success to resend OTP :",newotp);
//       console.log("new resend otpp  newopt::",req.session.userOTP)
//     } else {
//       console.log("Failed to resend OTP, please try again");
//       res.status(500).json({
//         success: false,
//         message: "Failed to resend OTP, please try again"
//       });
//     }
//   } catch (error) {
//     console.error("Error resending OTP", error);
//     return res.render("passwordverification");

//     // return res
//     //   .status(500)
//     //   .json({ success: false, message: "Server error, please try again" });
//   }
// };
const updateDefaultAddress = async (req, res) => {
  try {
    console.log("hrlooo");

    const { addressId } = req.body;
    console.log(addressId);
    const userId = req.session.userId; // Assuming session contains the user ID

    if (!addressId || !userId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid request: Missing address ID or user ID."
        });
    }

    // Check if the address exists and belongs to the user
    const address = await Address.findOne({ _id: addressId, user: userId });
    console.log("found address is: ", address);
    if (!address) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Address not found or does not belong to the user."
        });
    }

    // Update all addresses for the user to `default: false`
    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    console.log("found address is: ", address);
    // Set the selected address to `default: true`
    await Address.findByIdAndUpdate(addressId, { $set: { isDefault: true } });

    return res.json({
      success: true,
      message: "Default address updated successfully."
    });
  } catch (error) {
    console.error("Error updating default address:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal server error. Please try again."
      });
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
    const address = await Address.findOne({ isDefault: true, user: userId });

    // Render profile page with user info, formatted date, and address if found
    console.log(orders);
    res.render("profile", { user, createdAt, address, orders });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.redirect("/login"); // Redirect on error
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
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
// const verifyotpemail = async (req, res) => {
//   const { otp } = req.body;
//   try {
//     // Check if the OTP from user input matches the OTP stored in the session
//     if (otp == req.session.userOTP) {
//       // Clear OTP from session after successful verification
//       req.session.userOTP = null;
//       console.log("lastt :null venamm",req.session.userOTP)
//       res.render("newpassword"); // Load the new password page
//     } else {
//       // If OTP doesn't match, show error message on the verification page
//       console.log("Invalid OTP. Please try again");
//       res.render("passwordverification", {
//         message: "Invalid OTP. Please try again"
//       });
//     }
//   } catch (error) {
//     console.error("OTP verification error", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

const verifyotpemail = async (req, res) => {
  const { otp } = req.body; // Extract user-entered OTP
  console.log("Received OTP:", otp);
  console.log("Stored OTP in session:", req.session.userOTP);

  try {
    // Compare the user-provided OTP with the stored one
    if (otp == req.session.userOTP) {
      // Clear OTP from session after successful verification
      req.session.userOTP = null;
      console.log("OTP verified successfully. Session OTP cleared.");
      return res.render("newpassword"); // Redirect to new password page
    } else {
      console.log("Invalid OTP entered");
      return res.render("passwordverification", {
        message: "Invalid OTP. Please try again",
      });
    }
  } catch (error) {
    console.error("Error during OTP verification:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
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

    const addresses = await Address.find({ user: userId }); // Find addresses for the user
    console.log("User ID:", userId);
    // console.log("Addresses:", addresses);

    res.render("address", { addresses }); // Render the address page with the fetched addresses
  } catch (error) {
    console.error("Error loading addresses:", error);
    res.status(500).send("Internal server error"); // Handle unexpected errors
  }
};
const addaddress = async (req, res) => {
  const userId = req.session.userId; // Get the user ID from the session

  if (!userId) {
    req.session.message = "User not authenticated.";
    return res.redirect("/login"); // Redirect to login if no user is logged in
  }

  const addresses = await Address.find({ user: userId }); // Find addresses for the user

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
      return res.render("address", {
        addresses,
        message: "All fields are required."
      });
    }

    // Email validation (basic check for a valid email)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      req.session.message = "Invalid email format.";
      return res.render("address", {
        addresses,
        message: "Invalid email format."
      });
    }

    // Phone validation (basic check for valid phone number)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      req.session.message = "Invalid phone number. Must be 10 digits.";
      return res.render("address", {
        addresses,
        message: "Invalid phone number. Must be 10 digits."
      });
    }

    // Pincode validation (check if it is numeric and 6 digits)
    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(pincode)) {
      req.session.message = "Invalid pincode. It must be 6 digits.";
      return res.render("address", {
        addresses,
        message: "Invalid pincode. It must be 6 digits."
      });
    }

    // Check if an address with the same email already exists for this user
    const existingAddress = await Address.findOne({ user: userId, email });
    if (existingAddress) {
      req.session.message =
        "Address with this email already exists for this user.";
      return res.render("address", {
        addresses,
        message: "Address with this email already exists for this user."
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
    return res.redirect("/address");
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
