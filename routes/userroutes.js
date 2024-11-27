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
    res.redirect("/home");
  }
);

router.post('/verify-razorpay-payment', async (req, res) => {
    try {
        const { paymentId, orderId, signature } = req.body;

        // Verify signature
        const body = `${orderId}|${paymentId}`;
        const expectedSignature = crypto
            .createHmac('sha256', 'SfFbZ3vFL1AMEEY0ZvS4d1yF')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== signature) {
            return res.json({ success: false, message: 'Invalid signature' });
        }

        // Payment verified, proceed to save order details
        res.json({ success: true });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, message: 'Could not verify payment' });
    }
});



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
router.post("/editaddress/:id", profileController.editaddress);
router.get("/profile", userAuth.checksession,profileController.loadprofile);
router.delete("/address/:id", profileController.removeaddress);
router.get("/newpassword", profileController.loadnewpassword);
router.post("/email", profileController.sendotptoemail);
router.post("/verifyotpemail", profileController.verifyotpemail);
router.post("/updatepassword", profileController.setnewpassword);
router.post("/changepassword",profileController.changepassword)
router.get("/address", profileController.loadaddress);
router.post("/addaddress", profileController.addaddress);

//sales Controller
router.post("/addtocart", salesController.addtocart);
router.post("/placeOrder", salesController.placeOrder);
router.get("/cart", salesController.loadcartpage);
router.get('/cart/:cartId/getProductStock',salesController.getProductStock)
router.delete("/cart/:id", salesController.removecart);
router.post('/cart/:id/updateQuantity',salesController.updateQuantity) 

router.post('/create-razorpay-order',salesController.razorpayy)

//Orders Controller
router.get("/checkout", orderController.checkout);
router.get("/viewDetails/:orderId/:itemId",orderController.loadViewDetails)
router.get("/orderss", orderController.loadorderss);
router.patch("/orders/:orderId", orderController.removeorder); 
router.patch("/orders/:orderId/items/:itemId", orderController.removeItem); 


//pages routes
router.get("/advancedSearch", userController.advancedSearch);
router.get("/ordertracking/:id",orderController.ordertracking)
router.get("/products", userController.loadproducts);
router.get("/product/:id", userController.singleproduct);
router.get("/about", userController.loadaboutpage);
router.get("/contact", userController.loadcontactpage);
router.get("/contact", userController.loadcontactpage);
router.get("/home", userController.loadhome);



module.exports = router;
