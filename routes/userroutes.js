// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const salesController = require("../controllers/salesController")
const orderController = require("../controllers/orderController")
const registerController = require("../controllers/registerController")
const profileController = require("../controllers/profileController")
const userAuth = require("../middleware/userAuth");
const passport = require("passport");
const crypto = require("crypto");


router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    console.log(".");
    res.redirect("/");
  }
);



// Add a review
router.post('/add-review', userAuth.checksession,userController.addReview);
 
//register user routes
router.post("/login", userAuth.islogin, registerController.login);
router.post("/logout", registerController.logout);
router.get("/signup", registerController.loadsignup);
router.post("/signup", registerController.registerUser);
router.get("/login", registerController.loadlogin);
router.get("/verify-otp", registerController.loadVerifyOtp);
router.post("/verify-otp", registerController.verifyOtp);
router.post("/resend-otp", registerController.resendOtp);
router.get("/forgotpassword", registerController.loadforgotpassword);


//profile controller routes
router.post("/updateDefaultAddress",profileController.updateDefaultAddress)
router.post("/resendotpemail", profileController.resendotpemail);
router.post("/updateUsername",profileController.updateUsername);
router.post("/editaddress/:id", userAuth.checksession,profileController.editaddress);
router.get("/profile", userAuth.checksession,profileController.loadprofile);
router.delete("/address/:id", profileController.removeaddress);
router.get("/newpassword", profileController.loadnewpassword);
router.post("/email", profileController.sendotptoemail);
router.post("/verifyotpemail", profileController.verifyotpemail);
router.post("/updatepassword", profileController.setnewpassword);
router.post("/changepassword",profileController.changepassword)
router.get("/address",userAuth.checksession,profileController.loadaddress);
router.post("/addaddress", userAuth.checksession,profileController.addaddress);
router.get("/wallet",userAuth.checksession,profileController.loadWallet)
router.get("/shop",userController.loadshop)

//sales Controller
router.post("/addtocart", userAuth.checksession,salesController.addtocart);
router.post("/placeOrder", userAuth.checksession,salesController.placeOrder);
router.get("/cart",salesController.loadcartpage);
router.get('/cart/:cartId/getProductStock',salesController.getProductStock)
router.delete("/cart/:id", salesController.removecart);
router.post('/cart/:id/updateQuantity',salesController.updateQuantity) 
router.post("/applycoupon",userAuth.checksession,salesController.applycoupon)
router.post('/create-razorpay-order',userAuth.checksession,salesController.razorpayy)
 router.post("/payment-success/:id",userAuth.checksession,salesController.paymentSuccess)
 router.get("/retry-razorpay/:id",userAuth.checksession,salesController.retryRazorpay)
router.post("/retry-payment-success/:id",userAuth.checksession,salesController.retrypaymentSuccess)
router.post("/removeCoupon/:couponCode",userAuth.checksession,salesController.removecoupon)

//Orders Controller
router.get("/checkout", userAuth.checksession,orderController.checkout);
router.get("/viewDetails/:orderId/:itemId",userAuth.checksession,orderController.loadViewDetails)
router.get("/orderss", userAuth.checksession,orderController.loadOrders);
router.patch("/orders/:orderId", userAuth.checksession,orderController.removeorder); 
router.patch("/orders/:orderId/items/:itemId", userAuth.checksession,orderController.removeItem); 
router.post('/update-payment-status',userAuth.checksession,orderController.failedpayment)
router.get("/download-invoice/:orderId", userAuth.checksession,orderController.generateInvoicePDF);
router.post("/createWalletOrder",userAuth.checksession,orderController.walletpayment)
router.post('/return-order/:id',userAuth.checksession,orderController.returnOrder)


//pages routes
router.get("/advancedSearch", userController.advancedSearch);
router.get("/ordertracking/:id",orderController.ordertracking)
router.get("/products",userController.loadproducts);
router.get("/product/:id", userController.singleproduct);
router.get("/about", userController.loadaboutpage);
router.get("/contact", userController.loadcontactpage);
router.get("/contact", userController.loadcontactpage);
router.get("/", userController.loadhome);
router.get("/wishlist",userController.loadWishlist)
router.post('/toggle/:productId', userController.toggleWishlist);

router.use((req, res) => {
  res.status(404).render('404')
});

module.exports = router;
