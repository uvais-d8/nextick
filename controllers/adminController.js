const bcrypt = require("bcrypt");
const usermodal = require("../model/usermodal");
const admin = require("../model/adminmodal");
const productsmodal = require("../model/productsmodal");
const categorymodal = require("../model/categorymodal");
const products = require("../model/productsmodal");
const ordersSchema = require("../model/ordersmodal");
const fs = require("fs");

const multer = require("multer");
const path = require("path");
const orders = require("../model/ordersmodal");
const { default: mongoose } = require("mongoose");
const Handlebars = require("handlebars");
const couponSchema = require("../model/couponmodal");

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Append original file extension
  }
});
const upload = multer({ storage: storage }).array("images", 10);
const loadcoupon = async (req, res) => {
  try {
    const coupons = await couponSchema.find({}); // Fetching all coupons
    res.render("admin/coupon", { coupons }); // Passing the coupons array to the view
  } catch (error) {
    console.log(error);
  }
};
const loadeditproducts = async (req, res) => {
  const { id } = req.params;
  console.log("hello");
  console.log(req.params);
  const product = await productsmodal.findById(id);
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

    // Fetch all users from the database
    const users = await usermodal.find({});

    // Pass users to the dashboard view
    res.render("admin/dashboard", { users });
  } catch (error) {
    console.error(error); // Log the error
    res.render("admin/login", { message: "Failed to load dashboard" });
  }
};
const blockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`User id = ${userId}`);
    req.session.userId = null;
    await usermodal.findByIdAndUpdate(userId, { blocked: true });
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
    await usermodal.findByIdAndUpdate(userId, { blocked: false });
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
    const category = await categorymodal.find({});
    res.render("admin/category", { category });
  } catch (error) {
    console.log(`No data found : ${error}`);
  }
};
const loadproducts = async (req, res) => {
  try {
    const products = await productsmodal.find({});
    res.render("admin/products", { products });
  } catch (error) {
    console.error(error);
    res.status(500).send("server error");
  }
};
const loadUserMangment = async (req, res) => {
  try {
    const users = await usermodal.find({});
    res.render("admin/userManagement", { users });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};
const loadaddproduct = async (req, res) => {
  res.render("admin/addproduct");
};
const addproduct = async (req, res) => {
  try {
    const { name, category, stock, price, description } = req.body;
    console.log("Request body:", req.body);

    // Check if at least 3 images are uploaded
    if (!name || !category || !stock || !price || !description) {
      return res.status(400).render("admin/addproduct", {
        message: "all fields are required"
      });
    }

    // Check if at least 3 images are uploaded
    if (!req.files || req.files.length < 3) {
      return res.status(400).render("admin/addproduct", {
        message: "Please upload at least 3 images"
      });
    }

    console.log("Uploaded files:", req.files);

    // Check if product already exists

    const existingProduct = await productsmodal.findOne({ name });
    if (existingProduct) {
      console.log("Product already exists");
      const products = await productsmodal.find({});
      return res.render("admin/addproduct", {
        products,
        modalError: "Product already exists",
        message: "Product already exists"
      });
    }
    // Create new product with images
    const newProduct = new productsmodal({
      name,
      category,
      stock,
      price,
      description: description || "Default description here",
      images: req.files.map(file => file.path) // Store file paths in the database
    });

    await newProduct.save();
    console.log("New product saved:", newProduct);

    // Redirect to products page after saving
    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error adding product:", error.message);
    res.redirect("/admin/dashboard");
  }
};
const addcategory = async (req, res) => {
  try {
    const { brand, bandcolor, stock, status } = req.body;

    const existingCategory = await categorymodal.findOne({ brand });
    if (existingCategory) {
      console.log("Category already exists");
      return res.render("admin/addcategory", {
        message: "Category already exists"
      });
    }
    const newCategory = new categorymodal({
      brand,
      bandcolor,
      stock,
      status
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
    const category = await categorymodal.findById(id);
    res.render("admin/editcategory", { category }); // Make sure this is only called once
  } catch (error) {
    console.error(`Something went wrong: ${error}`);
    res.redirect("/admin/category"); // Ensure no previous response is sent before this
  }
};
const unlistcategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    console.log(`category id : ${categoryId}`);
    await categorymodal.findByIdAndUpdate(categoryId, { islisted: false });
    res.redirect("/admin/category");
  } catch (error) {
    console.error("failed to unlist category", error);
    res.redirect("/admin/dashboard");
  }
};
const listcategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    await categorymodal.findByIdAndUpdate(categoryId, { islisted: true });
    res.redirect("/admin/category");
  } catch (error) {
    console.log(error);
    console.error("failed to list category", error);
    res.redirect("/admin/dashboard");
  }
};

const editproducts = async (req, res) => {
  const productId = req.params.id;
  const {
    name,
    category,
    stock,
    price,
    deletedImages,
    croppedImageData
  } = req.body;

  try {
    // Find the product by ID
    const product = await productsmodal.findById(productId);
    if (!product) {
      console.log("Product not found");
      return res.render("admin/products", {
        modalError: "Product not found",
        message: "Product not found"
      });
    }
    const existingProduct = await productsmodal.findOne({ name });
    if (existingProduct) {
      console.log("Product already exists");
      const products = await productsmodal.find({});
      return res.render("admin/products", {
        products,
        modalError: "Product already exists",
        message: "Product already exists"
      });
    }
    // Handle deleted images
    if (deletedImages) {
      const deletedImagesArray = deletedImages.split(",");
      for (const imagePath of deletedImagesArray) {
        const index = product.images.indexOf(imagePath);
        if (index > -1) {
          product.images.splice(index, 1);
        }

        // Delete the image file from the server
        const fullImagePath = path.join(__dirname, "..", "public", imagePath);
        if (fs.existsSync(fullImagePath)) {
          fs.unlinkSync(fullImagePath);
        }
      }
    }

    // Handle cropped image
    if (croppedImageData) {
      // Save the cropped image to the server or upload it as a file
      const buffer = Buffer.from(croppedImageData.split(",")[1], "base64");
      const filePath = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        "cropped-" + Date.now() + ".png"
      );
      fs.writeFileSync(filePath, buffer);
      product.images.push("uploads/" + path.basename(filePath));
    }

    // Handle new image uploads if any
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => "uploads/" + file.filename);
      product.images.push(...newImages);
    }

    // Update the product fields
    Object.assign(product, { name, category, stock, price });

    // Save the updated product in the database
    await product.save();

    // Redirect to the products page after a successful update
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).render("admin/products", {
      modalError: "Failed to update product",
      message: "An error occurred while updating the product. Please try again."
    });
  }
};

const editcategory = async (req, res) => {
  const categoryId = req.params.id;
  const { brand, bandcolor, stock } = req.body;
  const updatedCategory = { brand, bandcolor, stock };

  try {
    // Check if a different category with the same brand already exists
    const { id } = req.params;
    const category = await categorymodal.find({});

    const existingCategory = await categorymodal.findOne({
      brand,
      _id: { $ne: categoryId }
    });

    if (existingCategory) {
      console.log("Category already exists with this brand");
      return res.render("admin/category", {

        category,
        message: "Category with this brand already exists"
      });
    }

    // Update the category if no duplicate is found
    await categorymodal.findByIdAndUpdate(categoryId, updatedCategory);
    res.redirect("/admin/category"); // Redirect to category list after updating
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).send("Error updating category");
  }
};
const unlistproducts = async (req, res) => {
  try {
    const productId = req.params.id;
    await productsmodal.findByIdAndUpdate(productId, { islisted: false });
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
    await productsmodal.findByIdAndUpdate(productId, { islisted: true });
    console.log(`Product ${productId} successfully listed`);
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Failed to list the product:", error);
    res.status(500).redirect("/admin/dashboard");
  }
};
const loadorders = async (req, res) => {
  try {
    const orders = await ordersSchema.find({});

    res.render("admin/orders", { orders });
  } catch (error) {
    console.log("Error during load orders", error);
  }
};
const loadinventory = async (req, res) => {
  try {
    const products = await productsmodal.find({});
    res.render("admin/inventory", { products });
  } catch (error) {
    console.log("failed to load inventory");
  }
};
const cancelOrderItem = async (req, res) => {
  const { orderId, itemId } = req.body;
  console.log("Request Body for Cancel:", req.body);

  try {
    // Validate orderId and itemId
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
    const order = await orders.findById(orderId);
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
    // Validate orderId and itemId
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
    const order = await orders.findById(orderId);
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    // Find the specific item within the order
    const item = order.items.id(itemId);
    if (!item) {
      console.log("Item not found for ID:", itemId);
      return res
        .status(404)
        .json({ success: false, message: "Item not found in order." });
    }

    // Update the item status only
    item.status = status;

    // Save the updated order
    await order.save();

    console.log("Item status updated successfully for item ID:", itemId);

    res.redirect("/admin/orders"); // Or send a JSON response if needed
  } catch (error) {
    console.error("Error updating item status:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update item status." });
  }
};
const editinventory = async (req, res) => {
  const productId = req.params.id; // Product ID from the URL parameter
  const { name, stock } = req.body; // Product name and stock from the request body

  try {
    // Find the product by ID
    const product = await productsmodal.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if a product with the same name already exists (excluding the current product)
    const existingProduct = await productsmodal.findOne({
      name: name,
      _id: { $ne: productId }
    });
    if (existingProduct) {
      return res.render("admin/inventory", {
        products: await productsmodal.find({}),
        message: "Product with this name already exists"
      });
    }

    // Check if the name and stock are the same as before
    if (product.name === name && product.stock === stock) {
      return res.render("admin/inventory", {
        products: await productsmodal.find({}),
        message: "No changes made to the product"
      });
    }

    // Update the product details
    product.name = name;
    product.stock = stock;

    // Save the updated product to the database
    await product.save();

    // Redirect to the inventory page with a success message
    res.redirect("/admin/inventory");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Error updating product");
  }
};
// Date formatting helper
Handlebars.registerHelper("formatDate", dateString => {
  const date = new Date(dateString);

  // Get day, month, and year
  const day = String(date.getDate()).padStart(2, "0"); // Pad day
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Pad month
  const year = date.getFullYear();

  return `${day}/${month}/${year}`; // Return in DD/MM/YYYY format
});
const loadaddcoupon = async (req, res) => {
  res.render("admin/addcoupon");
};
const addcoupon = async (req, res) => {
  try {
    const {
      CouponCode,
      DiscountType,
      DiscountValue,
      Products,
      MinimumCartValue,
      UsageLimit,
      ExpiryDate,
      Description,
      ApplicableProducts,
      ApplicableCategories
    } = req.body;
    console.log("Request body:", req.body);

    // Check if product already exists
    const existingcoupon = await couponSchema.findOne({ CouponCode });
    if (existingcoupon) {
      console.log("coupon already exists");
      return res.render("admin/coupon", {
        message: "coupon already exists"
      });
    }
    const formattedExpiryDate = new Date(ExpiryDate).toLocaleDateString(
      "en-GB"
    ); // 'dd/mm/yyyy' format

    const newCoupon = new couponSchema({
      CouponCode,
      DiscountType,
      DiscountValue,
      Products,
      MinimumCartValue,
      UsageLimit,
      ExpiryDate: formattedExpiryDate, // Use formatted date here
      Description,
      ApplicableProducts,
      ApplicableCategories
    });

    await newCoupon.save();
    console.log("New coupon saved:", newCoupon);

    // Redirect to products page after saving
    return res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error adding coupon:", error.message);
    res.redirect("/admin/dashboard");
  }
};
module.exports = {
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
