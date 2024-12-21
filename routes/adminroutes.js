const express = require("express");
const router=express.Router();
const adminController = require("../controllers/adminController");
const adminAuth=require("../middleware/adminAuth")

// Admin Pages routes
router.get("/login",adminAuth.islogin,adminController.loadlogin);
router.post("/login",adminAuth.islogin,adminController.login);
router.get("/dashboard",adminAuth.checksession,adminController.loaddashboard)
router.post("/logout",adminAuth.checksession,adminController.logout)
router.get("/category-sales-data", adminAuth.checksession,adminController.categorySales);


//User Management
router.get("/userpage",adminAuth.checksession,adminController.loadUserMangment)
router.post("/block/:id",adminAuth.checksession,adminController.blockUser);
router.post("/unblock/:id",adminAuth.checksession,adminController.unblockUser);

//Orders Management
router.get('/orders',adminAuth.checksession,adminController.loadOrder)
router.post("/orders/cancel", adminAuth.checksession,adminController.cancelOrderItem);
router.post("/updatestatus", adminAuth.checksession,adminController.updateOrderStatus);

//Inventory Management
router.get("/inventory",adminAuth.checksession,adminController.loadinventory)
router.post('/editinventory/:id',adminAuth.checksession,adminController.editinventory);

//Category Management
router.get("/category",adminAuth.checksession,adminController.loadcategory)
router.get("/editcategory/:id",adminAuth.checksession,adminController.loadeditcategory)
router.post('/editcategory/:id', adminAuth.checksession,adminController.editcategory);
router.post("/category/add",adminAuth.checksession,adminController.addcategory)
router.get("/addcategory",adminAuth.checksession,adminController.loadaddcategory)
router.post("/category/list/:id", adminAuth.checksession,adminController.listcategory)
router.post("/category/unlist/:id", adminAuth.checksession,adminController.unlistcategory)
router.post("/addcategory", adminAuth.checksession,adminController.addcategory);

//Products Management
router.get("/products",adminAuth.checksession,adminController.loadproducts)
router.post("/editproducts",adminController.upload, adminController.editproducts)
router.post("/products/:id",adminAuth.checksession,adminController.loadeditproducts)
router.get("/addproduct",adminAuth.checksession,adminController.loadaddproduct);
router.post('/addproducts', adminController.upload, adminController.addproduct); 
router.post("/products/unlist/:id", adminAuth.checksession, adminController.unlistproducts);
router.post("/products/list/:id", adminAuth.checksession, adminController.listproducts);

//Coupon Management
router.get("/coupon",adminAuth.checksession,adminController.loadcoupon)
router.get("/addcoupon",adminAuth.checksession,adminController.loadaddcoupon)
router.get("/addcoupons",adminAuth.checksession,adminController.loadaddcoupons)
router.post("/addingcoupon",adminAuth.checksession,adminController.addcoupon)
 router.post("/deletecoupon/:couponId", adminAuth.checksession,  adminController.deleteCoupon);
router.post("/coupon/unlist/:id", adminAuth.checksession, adminController.unlistCoupon);
router.post("/coupon/list/:id", adminAuth.checksession, adminController.listCoupon);

//Offer Management
router.get("/offer",adminAuth.checksession,adminController.loadoffers)
router.get("/addoffer",adminAuth.checksession,adminController.loadaddoffer)
router.get("/addoffers",adminAuth.checksession,adminController.loadaddoffers)
router.post("/addingOffer",adminAuth.checksession,adminController.addoffer)
router.post("/addingOffers",adminAuth.checksession,adminController.addoffers)
router.post("/deleteoffer/:id",adminAuth.checksession,adminController.deleteOffer)
router.post("/editOffer/:id",adminAuth.checksession,adminController.loadeditOffer)
router.post("/editingoffer/:id",adminAuth.checksession,adminController.editOffer)
router.post("/offer/unlist/:id", adminAuth.checksession, adminController.unlistOffer);
router.post("/offer/list/:id", adminAuth.checksession, adminController.listOffer);

//sales report
router.get("/salesreport", adminAuth.checksession,adminController.getSalesReport);
router.post('/salesreport/pdf', adminAuth.checksession,adminController.exportPDF);
router.post('/salesreport/excel', adminAuth.checksession,adminController.exportExcel);
router.get("/sales-data?",adminAuth.checksession,adminController.getSalesData)

// Export the router to use it in server.js
module.exports = router;