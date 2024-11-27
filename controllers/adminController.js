const bcrypt = require("bcrypt");
const fs = require("fs");
const User = require("../model/usermodal");
const admin = require("../model/adminModel");
const Products = require("../model/productsmodal");
const Category = require("../model/categoryModel");
const Orders = require("../model/ordersmodal");
const path = require("path");
const { default: mongoose } = require("mongoose");
const Coupon = require("../model/couponModel");
const multer = require("multer");
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});
const upload = multer({ storage: storage }).any("images", 10);
const loadcoupon = async (req, res) => {
  try {
    const coupons = await Coupon.find({}); 
    res.render("admin/coupon", { coupons });
  } catch (error) {
    console.log(error);
  }
};
const loadeditproducts = async (req, res) => {
  const { id } = req.params;
  console.log("hello");
  console.log(req.params);
  const product = await Products.findById(id);
  res.render(`admin/products`, { product });
  console.log(product);
};
const loadlogin = async (req, res) => {
  res.render("admin/login");
};
const login = async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    console.log("Email from req.body:", email);

    const adminData = await admin.findOne({ email });
    console.log(`Admin data found: ${adminData}`);

    if (!adminData) {
      console.log("Admin not found in DB");
      return res.render("admin/login", { message: "invalid credentials" });
    } else {
      console.log("Admin found:", adminData);

      const isMatch = await bcrypt.compare(password, adminData.password);
      if (!isMatch) {
        return res.render("admin/login", { message: "invalid credentials" });
      }
      req.session.admin = true;
      res.redirect("/admin/dashboard");
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.send(error);
  }
};
const loaddashboard = async (req, res) => {
  try {
    const admin = req.session.admin;
    if (!admin) return res.redirect("/admin/login");

    const users = await User.find({});

    res.render("admin/dashboard", { users });
  } catch (error) {
    console.error(error); 
    res.render("admin/login", { message: "Failed to load dashboard" });
  }
};
const blockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`User id = ${userId}`);
    req.session.userId = null;
    await User.findByIdAndUpdate(userId, { blocked: true });
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Failed to block user:", error);
    res.redirect("/admin/dashboard");
  }
};
const unblockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`user id ${userId}`);
    await User.findByIdAndUpdate(userId, { blocked: false });
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error(error);
    res.redirect("/admin/dashboard");
  }
};
const logout = (req, res) => {
  delete req.session.admin;
  res.render("admin/login");
};
const loadcategory = async (req, res) => {
  try {
    const category = await Category.find({});
    res.render("admin/category", { category });
  } catch (error) {
    console.log(`No data found : ${error}`);
  }
};
const loadproducts = async (req, res) => {
  try {
    const categories=await Category.find({})
    const products = await Products.find({}).populate("category", "category");  ;
    res.render("admin/products", { products ,categories});
    console.log("categoreiesss:",categories)
  } catch (error) {
    console.error(error);
    res.status(500).send("server error");
  }
};
const loadUserMangment = async (req, res) => {
  try {
    const users = await User.find({});
    res.render("admin/userManagement", { users });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};
const loadaddproduct = async (req, res) => {
  try {
    const categories = await Category.find({}); 
    res.render("admin/addproduct", { categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send("Error fetching categories");
  }
};
const addproduct = async (req, res) => {
  try {
    const { name, category, stock, price, description } = req.body;
    const { files } = req; 
    console.log("Request body:", req.body);
    console.log("Uploaded files:", files);

    // Check for required fields
    if (!name || !category || !stock || !price || !description) {
      return res.status(400).render("admin/addproduct", {
        message: "All fields are required."
      });
    }

    // Check if at least 3 images are uploaded
    if (!files || files.length < 3) {
      return res.status(400).render("admin/addproduct", {
        message: "Please upload at least 3 images."
      });
    }

    // Validate the file types (ensure they are images)
    const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validImageTypes.includes(file.mimetype)) {
        return res.status(400).render("admin/addproduct", {
          message: `Invalid image format for file: ${file.originalname}. Please upload only image files.`
        });
      }
    }

    // Check if the product already exists
    const existingProduct = await Products.findOne({ name });
    if (existingProduct) {
      const products = await Products.find({});
      return res.render("admin/addproduct", {
        products,
        modalError: "Product already exists",
        message: "Product already exists"
      });
    }

    // Check if the category exists
    const categoryObj = await Category.findOne({ category: category });
    if (!categoryObj) {
      return res.status(400).render("admin/addproduct", {
        message: "Category not found"
      });
    }

    // Create the new product
    const newProduct = new Products({
      name,
      category: categoryObj._id, // Set the category ObjectId
      stock,
      price,
      description: description || "Default description",
      images: files.map(file => file.path) // Save the file paths
    });

    // Save the new product to the database
    await newProduct.save();
    console.log("New product saved:", newProduct);

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error adding product:", error.message);
    res.redirect("/admin/dashboard");
  }
};


const addcategory = async (req, res) => {
  try {
    const { category,brand, bandcolor } = req.body;

    const existingCategory = await Category.findOne({ category });
    if (existingCategory) {
      console.log("Category already exists");
      return res.render("admin/addcategory", {
        message: "Category already exists"
      });
    }
    const newCategory = new Category({
      category,
      bandcolor,
      brand,
    });

    await newCategory.save();

    return res.redirect("/admin/category");
  } catch (error) {
    console.error(`Something went wrong: ${error}`);
    return res.redirect("/admin/addcategory");
  }
};
const loadaddcategory = async (req, res) => {
  res.render("admin/addcategory");
};
const loadeditcategory = async (req, res) => {
  try {
    console.log(req.params);
    const { id } = req.params;
    const category = await Category.findById(id);
    res.render("admin/editcategory", { category }); 
  } catch (error) {
    console.error(`Something went wrong: ${error}`);
    res.redirect("/admin/category");
  }
};
const unlistcategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    console.log(`category id : ${categoryId}`);
    await Category.findByIdAndUpdate(categoryId, { islisted: false });
    res.redirect("/admin/category");
  } catch (error) {
    console.error("failed to unlist category", error);
    res.redirect("/admin/dashboard");
  }
};
const listcategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    await Category.findByIdAndUpdate(categoryId, { islisted: true });
    res.redirect("/admin/category");
  } catch (error) {
    console.log(error);
    console.error("failed to list category", error);
    res.redirect("/admin/dashboard");
  }
};
const editproducts = async (req, res) => {
  try {
    // Retrieve form data
    const { id, name, category, stock, price, deletedImages } = req.body;
    console.log("Received Data:");
    console.log("ID:", id);
    console.log("Name:", name);
    console.log("Category:", category);
    console.log("Stock:", stock);
    console.log("Price:", price);
    console.log("Deleted Images:", deletedImages);

    const existingProduct = await Products.findOne({
      name: name.trim(),
      _id: { $ne: id }, 
    });

    if (existingProduct) {
      console.error("Product with this name already exists:", name);
      return res.render("admin/products", {
        message: "A product with this name already exists.",
      });
    }

    const product = await Products.findById(id);
    if (!product) {
      console.error("Product not found for ID:", id);
      return res.render("admin/products", { message: "Product not found" });
    }

    const categoryObj = await Category.findById(category); 
    if (!categoryObj) {
      return res.status(400).render("admin/products", { message: "Category not found" });
    }

    const stockNumber = parseInt(stock, 10);
    if (isNaN(stockNumber)) {
      return res.render("admin/products", { message: "Stock must be a valid number" });
    }

    if (stockNumber < 0) {
      return res.render("admin/products", { message: "Stock cannot be negative" });
    }

    // Handle deleted images
    if (deletedImages) {
      const deletedImagesArray = deletedImages.split(",");
      for (const imagePath of deletedImagesArray) {
        const index = product.images.indexOf(imagePath);
        if (index > -1) {
          product.images.splice(index, 1);
          const fullImagePath = path.join(__dirname, "..", "public", imagePath);
          if (fs.existsSync(fullImagePath)) {
            fs.unlinkSync(fullImagePath);
            console.log("Deleted image from server:", fullImagePath);
          }
        }
      }
    }

    // Handle newly uploaded files
    if (req.files && req.files.images) {
      const newImages = req.files.images.map((file) => "uploads/" + file.filename);
      product.images.push(...newImages);
      console.log("Added new images:", newImages);
    }

    // Handle cropped image if provided
    if (req.body.croppedImageData) {
      const croppedImages = Array.isArray(req.body.croppedImageData)
        ? req.body.croppedImageData
        : [req.body.croppedImageData];

      for (const croppedImageData of croppedImages) {
        const buffer = Buffer.from(croppedImageData.split(",")[1], "base64");
        const croppedFileName = `cropped-${Date.now()}.png`;
        const filePath = path.join(__dirname, "..", "uploads", croppedFileName);
        fs.writeFileSync(filePath, buffer);
        product.images.push("uploads/" + croppedFileName);
        console.log("Added cropped image:", croppedFileName);
      }
    }

    // Ensure at least one image
    if (product.images.length === 0) {
      console.error("No images provided for the product.");
      return res.render("admin/products", { message: "At least one image is required" });
    }

    // Update product fields
    Object.assign(product, {
      name: name.trim(),
      category: categoryObj._id, // Assign the ObjectId of the category
      stock: stockNumber,
      price: parseFloat(price).toFixed(2),
    });

    // Save the updated product
    await product.save();
    console.log("Product updated successfully:", product);

    // Redirect to the products page after successful update
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    const products = await Products.find({});
    res.status(500).render("admin/products", {
      products,
      message: "An error occurred while updating the product. Please try again.",
    });
  }
};
const editcategory = async (req, res) => {
  const categoryId = req.params.id; 
  const { category, brand, bandcolor } = req.body; 
  const updatedCategory = { category, brand, bandcolor };

  try {
    const existingCategory = await Category.findOne({
      category: category.trim(), 
      _id: { $ne: categoryId }  
    });

    if (existingCategory) {
      console.log("Category already exists");
      const category  = await Category.find({}); 
      return res.render("admin/category", {
        category,
        message: "Category with this name already exists."
      });
    }

    await Category.findByIdAndUpdate(categoryId, updatedCategory, { new: true });
    res.redirect("/admin/category"); 
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).send("Error updating category");
  }
};
const unlistproducts = async (req, res) => {
  try {
    const productId = req.params.id;
    await Products.findByIdAndUpdate(productId, { islisted: false });
    console.log(`Product ${productId} successfully unlisted`);
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Failed to unlist the product:", error);
    res.status(500).redirect("/admin/dashboard");
  }
};
const listproducts = async (req, res) => {
  try {
    const productId = req.params.id;
    await Products.findByIdAndUpdate(productId, { islisted: true });
    console.log(`Product ${productId} successfully listed`);
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Failed to list the product:", error);
    res.status(500).redirect("/admin/dashboard");
  }
};
const loadorders = async (req, res) => {
  try {
    const orders = await Orders.find({})
      .populate('items.productId', 'name') 
      .sort({ createdAt: -1 })
      .exec()



    res.render("admin/orders", { orders });
  } catch (error) {
    console.error("Error during load orders:", error);
    res.status(500).send("Failed to load orders");
  }
};
const loadinventory = async (req, res) => {
  try {
    const products = await Products.find({});
    res.render("admin/inventory", { products });
  } catch (error) {
    console.log("failed to load inventory");
  }
};
const cancelOrderItem = async (req, res) => {
  const { orderId, itemId } = req.body;
  console.log("Request Body for Cancel:", req.body);

  try {
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      console.log("Invalid order or item ID:", { orderId, itemId });
      return res
        .status(400)
        .json({ success: false, message: "Invalid order or item ID." });
    }

    console.log(
      "Attempting to cancel item with ID:",
      itemId,
      "in order ID:",
      orderId
    );

    // Find the order by ID
    const order = await Orders.findById(orderId);
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    // Find the specific item within the order items array
    const item = order.items.id(itemId);
    if (!item) {
      console.log("Item not found for ID:", itemId);
      return res
        .status(404)
        .json({ success: false, message: "Item not found in order." });
    }

    // Update the item's status to "canceled"
    item.status = "canceled";

    // Save the updated order
    await order.save();

    console.log("Item canceled successfully for item ID:", itemId);

    // Redirect or send response
    res.redirect("/admin/orders"); // Adjust this as needed
  } catch (error) {
    console.error("Error canceling item:", error);
    res.status(500).json({ success: false, message: "Failed to cancel item." });
  }
};
const updateOrderStatus = async (req, res) => {
  const { orderId, itemId, status } = req.body;
  console.log("Request Body:", req.body); // Log the request body for debugging

  try {
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      console.log("Invalid order or item ID:", { orderId, itemId });
      return res
        .status(400)
        .json({ success: false, message: "Invalid order or item ID." });
    }

    // Validate status
    const validStatuses = [
      "scheduled",
      "pending",
      "delivered",
      "shipped",
      "canceled"
    ];
    if (!validStatuses.includes(status)) {
      console.log("Invalid status:", status);
      return res
        .status(400)
        .json({ success: false, message: "Invalid status." });
    }
    console.log(
      "Attempting to update item status for order ID:",
      orderId,
      "and item ID:",
      itemId
    );
    // Find the order by ID
    const order = await Orders.findById(orderId);
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const item = order.items.id(itemId);
    if (!item) {
      console.log("Item not found for ID:", itemId);
      return res
        .status(404)
        .json({ success: false, message: "Item not found in order." });
    }

    item.status = status;

    await order.save();

    console.log("Item status updated successfully for item ID:", itemId);

    res.redirect("/admin/orders"); 
  } catch (error) {
    console.error("Error updating item status:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update item status." });
  }
};
const editinventory = async (req, res) => {
  const productId = req.params.id;
  const { name, stock } = req.body; 

  try {
    // Find the product by ID
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
if (stock.length<0){
  console.log("not minus allowed")
}
    const existingProduct = await Products.findOne({
      name: name,
      _id: { $ne: productId }
    });
    if (existingProduct) {
      return res.render("admin/inventory", {
        products: await Products.find({}),
        message: "Product with this name already exists"
      });
    }

    if (product.name === name && product.stock === stock) {
      return res.render("admin/inventory", {
        products: await Products.find({}),
        message: "No changes made to the product"
      });
    }
    // Update the product details
    product.name = name;
    product.stock = stock;

    await product.save();

    res.redirect("/admin/inventory");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Error updating product");
  }
};
const loadaddcoupon = async (req, res) => {
  try {
    const products = await Products.find({})
    const Categories = await Category.find({})
    console.log(Categories);
    
    res.render("admin/addcoupon",{products,Categories});
  } catch (error) {
    console.log("errorr")
    res.render("admin/addcoupon",{message:"errorr"});
  }
};
const addcoupon = async (req, res) => {
  try {
    const {
      CouponCode,
      DiscountType,
      DiscountValue,
      Products,   
      Categories, 
      MinimumCartValue,
      UsageLimit,
      ExpiryDate,
      Description,
    } = req.body;

    console.log("Request body:", req.body);

    if (!CouponCode || !DiscountType || !DiscountValue || !Products || !ExpiryDate) {
      console.log("Missing required fields");
      return res.render("admin/addcoupon", {
        message: "All fields are required"
      });
    }

    // Check for existing coupon code
    const existingcoupon = await Coupon.findOne({ CouponCode });
    if (existingcoupon) {
      console.log("coupon already exists");
      return res.render("admin/addcoupon", {
        message: "Coupon already exists"
      });
    }

    if (isNaN(DiscountValue) || DiscountValue <= 0) {
      console.log("Invalid DiscountValue");
      return res.render("admin/addcoupon", {
        message: "Discount value must be a positive number"
      });
    }

    if (MinimumCartValue && (isNaN(MinimumCartValue) || MinimumCartValue < 0)) {
      console.log("Invalid MinimumCartValue");
      return res.render("admin/addcoupon", {
        message: "Minimum cart value must be a positive number"
      });
    }

    if (UsageLimit && (isNaN(UsageLimit) || UsageLimit <= 0 || !Number.isInteger(Number(UsageLimit)))) {
      console.log("Invalid UsageLimit");
      return res.render("admin/addcoupon", {
        message: "Usage limit must be a positive integer"
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);
    if (isNaN(formattedExpiryDate)) {
      console.log("Invalid ExpiryDate");
      return res.render("admin/addcoupon", {
        message: "Expiry date is invalid"
      });
    }

    if (formattedExpiryDate < new Date()) {
      console.log("Expiry date is in the past");
      return res.render("admin/addcoupon", {
        message: "Expiry date cannot be in the past"
      });
    }

    if (Description && typeof Description !== 'string') {
      console.log("Invalid Description");
      return res.render("admin/addcoupon", {
        message: "Description must be a valid string"
      });
    }

    // Create a new coupon object
    const newCoupon = new Coupon({
      CouponCode,
      DiscountType,
      DiscountValue,
      Products,     // Now it correctly stores an array of selected products
      Categories,   // Now it correctly stores an array of selected categories
      MinimumCartValue,
      UsageLimit,
      ExpiryDate: formattedExpiryDate, 
      Description,
    });

    await newCoupon.save();
    console.log("New coupon saved:", newCoupon);

    return res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error adding coupon:", error.message);
    res.redirect("/admin/dashboard");
  }
};
const deleteCoupon = async (req, res) => {
  const { couponId } = req.params;  // Destructure couponId from req.params
  console.log("Coupon ID received:", couponId);

  try {
    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

    if (!deletedCoupon) {
      console.log("Coupon not found");
      return res.redirect("/admin/coupon"); // Redirect if coupon not found
    }

    console.log("Deleted coupon:", deletedCoupon);

    // Redirect to the coupon list page after deletion
    return res.redirect("/admin/coupon"); 

  } catch (error) {
    console.log("Error occurred while deleting coupon:", error);
    return res.status(500).render("admin/coupon", {
      message: "An error occurred while deleting the coupon"
    });
  }
};
module.exports = {
  deleteCoupon,
  addcoupon,
  loadaddcoupon,
  loadcoupon,
  editinventory,
  updateOrderStatus,
  cancelOrderItem,
  upload,
  loadinventory,
  loadorders,
  listproducts,
  unlistproducts,
  listcategory,
  unlistcategory,
  loadeditcategory,
  addcategory,
  editproducts,
  loadlogin,
  loadproducts,
  login,
  loadcategory,
  loadaddcategory,
  loaddashboard,
  logout,
  blockUser,
  unblockUser,
  loadUserMangment,
  addproduct,
  loadaddproduct,
  loadeditproducts,
  editcategory
};
