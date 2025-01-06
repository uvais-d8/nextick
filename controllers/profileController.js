const bcrypt = require("bcrypt");
const User = require("../model/usermodal");
const saltround = 10;
const nodemailer = require("nodemailer");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersmodal");
const Wallet = require("../model/walletModel");

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.SERVEREMAIL,
        pass: process.env.PASS
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
  console.log("hellooo");
  const user = await User.findOne({ _id: userId });

  
  const orders = await Orders.find({ userId: user })
    .sort({ createdAt: -1 })
    .limit(2)
    .populate({
      path: "items.productId",
      select: "name price images"
    });
  const address = await Address.findOne({ isDefault: true, user: userId });

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
          "Password must contain at least one uppercase,lowercase and a number."
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newpassword, salt);
    user.password = hashedPassword;
    await user.save();

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
        message: "Email not found in session"
      });
    }

    const newotp = generateOtp();
    req.session.userOTP = newotp;
    console.log("New OTP generated and stored in session:", newotp);

    const emailSent = await sendVerificationEmail(email, newotp);
    if (emailSent) {
      console.log("OTP resent successfully");
      return res.render("passwordverification", {
        success: "OTP resent successfully"
      });
    } else {
      console.log("Failed to send OTP");
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP, please try again"
      });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
const updateDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.body;
    console.log(addressId);
    const userId = req.session.userId;

    if (!addressId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid request: Missing address ID or user ID."
      });
    }

    const address = await Address.findOne({ _id: addressId, user: userId });
    console.log("found address is: ", address);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or does not belong to the user."
      });
    }

    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    console.log("found address is: ", address);
    await Address.findByIdAndUpdate(addressId, { $set: { isDefault: true } });

    return res.json({
      success: true,
      message: "Default address updated successfully."
    });
  } catch (error) {
    console.error("Error updating default address:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again."
    });
  }
};
const loadprofile = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log("Session User ID:", userId);

    const user = await User.findOne({ _id: userId });
    if (!user) {
      console.log("User not found");
      return res.redirect("/login");
    }

    const createdAt = user.registered.toLocaleDateString("en-GB");
    const orders = await Orders.find({ userId: user })
      .sort({ createdAt: -1 })
      .limit(2) 
      .populate({
        path: "items.productId",
        select: "name price images" 
      });
    const address = await Address.findOne({ isDefault: true, user: userId });

    res.render("profile", { user, createdAt, address, orders });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.redirect("/login");
  }
};
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
const updateUsername = async (req, res) => {
  try {
    const { userId, newName, newPhone } = req.body;
    console.log(req.body);

    if (!newName) {
      return res.status(400).json({ error: "New name is required" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name: newName, phone: newPhone },
      { new: true }
    );

    console.log(updatedUser);

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: "Username and phone number updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error:", error);

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

    res.redirect("/address");
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).send("Server Error");
  }
};
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

    const existingUser = await User.findOne({ email: email });
    console.log(existingUser);

    if (!existingUser) {
      const message = "This email doesn't exist.";
      console.log(message);
      return res.render("forgotpassword", {
        message: "This email doesn't exist."
      });
    }
    const otp = generateOtp();
    console.log("Generated OTP:", otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      req.session.message =
        "Error sending verification email. Please try again.";
      return res.redirect("/forgotpassword");
    }

    req.session.userOTP = otp;
    req.session.userEmail = email;
    res.render("passwordverification");
  } catch (error) {
    console.log("Error:", error);
    req.session.message = "An unexpected error occurred. Please try again.";
    res.redirect("/forgotpassword");
  }
};
const verifyotpemail = async (req, res) => {
  const { otp } = req.body;
  console.log("Received OTP:", otp);
  console.log("Stored OTP in session:", req.session.userOTP);

  try {
    if (otp == req.session.userOTP) {
      req.session.userOTP = null;
      console.log("OTP verified successfully. Session OTP cleared.");
      return res.render("newpassword");
    } else {
      console.log("Invalid OTP entered");
      return res.render("passwordverification", {
        message: "Invalid OTP. Please try again"
      });
    }
  } catch (error) {
    console.error("Error during OTP verification:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
const loadnewpassword = (req, res) => {
  res.render("newpassword", { message: req.session.message || null });
  req.session.message = null;
};
const setnewpassword = async (req, res) => {
  const newPassword = req.body.newPassword;
  const confirmPassword = req.body.confirmPassword;

  if (!newPassword || newPassword.length < 6) {
    req.session.message = "Password must be at least 6 characters long.";
    return res.redirect("/newpassword");
  }

  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;
  if (!passwordPattern.test(newPassword)) {
    req.session.message =
      "Password must include a uppercase letter, lowercase letter,and a number.";
    return res.redirect("/newpassword");
  }

  if (newPassword !== confirmPassword) {
    req.session.message = "Passwords do not match.";
    return res.redirect("/newpassword");
  }

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

    const salt = await bcrypt.genSalt(saltround);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

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
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect("/login");
    }

    const addresses = await Address.find({ user: userId });
    console.log("User ID:", userId);

    res.render("address", { addresses });
  } catch (error) {
    console.error("Error loading addresses:", error);
    res.status(500).send("Internal server error");
  }
};
const addaddress = async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    req.session.message = "User not authenticated.";
    return res.redirect("/login");
  }

  const addresses = await Address.find({ user: userId }); 
  try {
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

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      req.session.message = "Invalid email format.";
      return res.render("address", {
        addresses,
        message: "Invalid email format."
      });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      req.session.message = "Invalid phone number. Must be 10 digits.";
      return res.render("address", {
        addresses,
        message: "Invalid phone number. Must be 10 digits."
      });
    }

    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(pincode)) {
      req.session.message = "Invalid pincode. It must be 6 digits.";
      return res.render("address", {
        addresses,
        message: "Invalid pincode. It must be 6 digits."
      });
    }

    const existingAddress = await Address.findOne({ user: userId, email });
    if (existingAddress) {
      req.session.message =
        "Address with this email already exists for this user.";
      return res.render("address", {
        addresses,
        message: "Address with this email already exists for this user."
      });
    }

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

    const userAddresses = await Address.find({ user: userId });
    if (userAddresses.length === 0) {
      newAddress.isDefault = true; 
        }

    await newAddress.save();
    console.log("New address saved:", newAddress);
 req.session.message = "Address added successfully!";
    req.session.useraddress = newAddress; 
    res.redirect("/address");
  } catch (error) {
    console.error("Adding address error:", error);
    req.session.message = "Error adding address. Please try again.";
    return res.redirect("/address");
  }
};
const loadWallet = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log("User ID:", userId);

    // Fetch wallet details
    const wallet = await Wallet.findOne({ user: userId });

    // Fetch user details
    const user = await User.findById(userId);

    if (!user) {
      return res.render("wallet", {
        message: "User not found",
        balance: 0,
        transactions: [],
        user: {}
      });
    }

    // Wallet balance and transactions
    let balance = 0;
    let transactions = [];
    if (wallet) {
      balance = Math.round(wallet.balance * 100) / 100;
      transactions = wallet.transactions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    res.render("wallet", {
      balance, // Wallet balance
      transactions, // Sorted wallet transactions
      user: {
        referralCode: user.referralCode,
 
      }
    });
  } catch (error) {
    console.error("Error loading wallet:", error);
    res.status(500).send("Server Error");
  }
};


module.exports = {
  updateDefaultAddress,
  resendotpemail,
  loadWallet,
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
