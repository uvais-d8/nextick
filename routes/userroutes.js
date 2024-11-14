// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const userAuth = require("../middleware/userAuth");
const passport = require("passport");

router.get("/signup", userController.loadsignup);
router.post("/signup", userController.registerUser);
router.get("/login", userController.loadlogin);
router.post("/login", userAuth.islogin, userController.login);

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    console.log("User authenticated, redirecting to home.");
    res.redirect("/home");
  }
);

router.post("/updateUsername",userController.updateUsername);

router.get('/search', userController.searchProducts);

router.post("/editaddress/:id",userController.editaddress)
router.get("/ordertracking/:id",userController.ordertracking)
router.get('/filtered',userController.filtered);
router.get("/verify-otp", userController.loadVerifyOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.post("/resendotpemail", userController.resendotpemail);

router.get("/home", userController.loadhome);
router.get("/products", userController.loadproducts);
router.post("/logout", userController.logout);
router.get("/product/:id", userController.singleproduct);
router.get("/about", userController.loadaboutpage);
router.get("/contact", userController.loadcontactpage);
router.get("/cart", userController.loadcartpage);
router.get("/contact", userController.loadcontactpage);
router.get("/profile", userController.loadprofile);
router.get("/checkout", userController.checkout);
router.post("/addtocart", userController.addtocart);

router.delete("/cart/:id", userController.removecart);
router.post("/cart/:id/updateQuantity", userController.updateCartQuantity);
// Routes
router.patch("/orders/:orderId", userController.removeorder); 
router.patch("/orders/:orderId/items/:itemId", userController.removeItem); 

 

router.delete("/address/:id", userController.removeaddress);
router.get("/forgotpassword", userController.loadforgotpassword);
router.get("/newpassword", userController.loadnewpassword);
router.post("/email", userController.sendotptoemail);
router.post("/verifyotpemail", userController.verifyotpemail);
router.post("/updatepassword", userController.setnewpassword);

router.post("/changepassword",userController.changepassword)

router.get("/orderss", userController.loadorderss);

router.post("/placeOrder", userController.placeOrder);

router.get("/address", userController.loadaddress);
router.get("/sorted", userController.advancedSearch);

router.post("/addaddress", userController.addaddress);

module.exports = router;
