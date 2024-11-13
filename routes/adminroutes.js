const express = require("express");
const router=express.Router();
const adminController = require("../controllers/adminController");
const adminAuth=require("../middleware/adminAuth")

// Defining admin login routes
router.get("/login",adminAuth.islogin,adminController.loadlogin);
router.post("/login",adminAuth.islogin,adminController.login);
router.get("/dashboard",adminController.loaddashboard)
router.post("/logout",adminController.logout)
router.get("/userpage",adminController.loadUserMangment)
router.get("/products",adminAuth.checksession,adminController.loadproducts)
router.get('/orders',adminController.loadorders)
router.get("/inventory",adminController.loadinventory)
router.get("/category",adminController.loadcategory)
router.post("/block/:id",adminAuth.checksession,adminController.blockUser);
router.post("/unblock/:id",adminAuth.checksession,adminController.unblockUser);

router.post("/editproducts/:id",adminController.upload, adminController.editproducts)

router.get("/editcategory/:id",adminAuth.checksession,adminController.loadeditcategory)
router.post('/editcategory/:id', adminAuth.checksession,adminController.editcategory);
router.post("/products/:id",adminAuth.checksession,adminController.loadeditproducts)
router.get("/addproduct",adminAuth.checksession,adminController.loadaddproduct);
router.post('/addproducts', adminController.upload, adminController.addproduct); 

router.get("/addcoupon",adminAuth.checksession,adminController.loadaddcoupon)
router.post("/addingcoupon",adminAuth.checksession,adminController.addcoupon)


router.post("/category/add",adminAuth.checksession,adminController.addcategory)
router.get("/addcategory",adminAuth.checksession,adminController.loadaddcategory)
router.post("/category/list/:id", adminAuth.checksession,adminController.listcategory)
router.post("/category/unlist/:id", adminAuth.checksession,adminController.unlistcategory)
router.post("/addcategory", adminAuth.checksession,adminController.addcategory);
router.post("/products/unlist/:id", adminAuth.checksession, adminController.unlistproducts);
router.post("/products/list/:id", adminAuth.checksession, adminController.listproducts);

router.post("/orders/cancel", adminController.cancelOrderItem);
router.post("/updatestatus", adminAuth.checksession,adminController.updateOrderStatus);

router.post('/editinventory/:id',adminAuth.checksession,adminController.editinventory);

router.get("/coupon",adminAuth.checksession,adminController.loadcoupon)

// Export the router to use it in server.js
module.exports = router;