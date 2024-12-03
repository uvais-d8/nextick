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
const Offer = require("../model/offermodel");
const Coupons = require("../model/couponModel");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage }).any("images", 10);

// -------------------------------------------------addmin Pages---------------------------------------------------------
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
const logout = (req, res) => {
  delete req.session.admin;
  res.render("admin/login");
};
// -------------------------------------------------User Management-------------------------------------------------------
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
// const loadUserMangment = async (req, res) => {
//   try {
//     const users = await User.find({});
//     res.render("admin/userManagement", { users });
//   } catch (error) {
//     console.log(error);
//     res.status(500).send("Server Error");
//   }
// };

const loadUserMangment = async (req, res) => {
  try {
    // Get the current page from the query parameter, default to 1 if not provided
    const page = parseInt(req.query.page) || 1;

    // Set the number of users per page, default to 4 if not provided
    const limit = parseInt(req.query.limit) || 4;

    // Calculate how many items to skip based on the current page
    const skip = (page - 1) * limit;

    // Fetch the total number of users
    const totalUsers = await User.countDocuments();

    // Fetch users with pagination
    const users = await User.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // Sort by creation date (or change if needed)
      .exec();

    // Calculate total pages
    const totalPages = Math.ceil(totalUsers / limit);

    // Get previous and next page numbers
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    // Render the user page with pagination data
    res.render("admin/userManagement", {
      users,
      currentPage: page,
      totalPages: totalPages,
      totalUsers: totalUsers,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching users: ${error}`);
    res.status(500).send("Failed to load users.");
  }
};

// -------------------------------------------------Category Management---------------------------------------------------
const addcategory = async (req, res) => {
  try {
    const { category, brand, bandcolor } = req.body;

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
      brand
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
      const category = await Category.find({});
      return res.render("admin/category", {
        category,
        message: "Category with this name already exists."
      });
    }

    await Category.findByIdAndUpdate(categoryId, updatedCategory, {
      new: true
    });
    res.redirect("/admin/category");
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).send("Error updating category");
  }
};
// const loadcategory = async (req, res) => {
//   try {
//     const category = await Category.find({});
//     res.render("admin/category", {
//       category
//     });
//   } catch (error) {
//     console.log(`No data found: ${error}`);
//     res.status(500).send("Failed to load categories.");
//   }
// };
const loadcategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;
    const skip = (page - 1) * limit;

    const totalCategories = await Category.countDocuments();
    const categories = await Category.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();
    console.log("categories", categories);
    const totalPages = Math.ceil(totalCategories / limit);
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/category", {
      categories,
      currentPage: page,
      totalPages,
      totalCategories,
      previousPage,
      nextPage
    });
  } catch (error) {
    console.log(`No data found: ${error}`);
    res.status(500).send("Failed to load categories.");
  }
};

// -------------------------------------------------Products Management---------------------------------------------------
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
      _id: { $ne: id }
    });

    if (existingProduct) {
      console.error("Product with this name already exists:", name);
      return res.render("admin/products", {
        message: "A product with this name already exists."
      });
    }

    const product = await Products.findById(id);
    if (!product) {
      console.error("Product not found for ID:", id);
      return res.render("admin/products", { message: "Product not found" });
    }

    const categoryObj = await Category.findById(category);
    if (!categoryObj) {
      return res
        .status(400)
        .render("admin/products", { message: "Category not found" });
    }

    const stockNumber = parseInt(stock, 10);
    if (isNaN(stockNumber)) {
      return res.render("admin/products", {
        message: "Stock must be a valid number"
      });
    }

    if (stockNumber < 0) {
      return res.render("admin/products", {
        message: "Stock cannot be negative"
      });
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
      const newImages = req.files.images.map(
        file => "uploads/" + file.filename
      );
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
      return res.render("admin/products", {
        message: "At least one image is required"
      });
    }

    // Update product fields
    Object.assign(product, {
      name: name.trim(),
      category: categoryObj._id, // Assign the ObjectId of the category
      stock: stockNumber,
      price: parseFloat(price).toFixed(2)
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
      message: "An error occurred while updating the product. Please try again."
    });
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
    const validImageTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/gif"
    ];
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

const loadproducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const totalProducts = await Products.countDocuments();
    const categories = await Category.find({});
    const products = await Products.find({})
      .populate("category", "category")
      .skip(skip)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalProducts / limit);
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/products", {
      products,
      categories,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching products: ${error}`);
    res.status(500).send("Failed to load products.");
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

// -------------------------------------------------Inventory Management--------------------------------------------------
const loadinventory = async (req, res) => {
  try {
    const products = await Products.find({});
    res.render("admin/inventory", { products });
  } catch (error) {
    console.log("failed to load inventory");
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
    if (stock.length < 0) {
      console.log("not minus allowed");
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

// -------------------------------------------------Orders Management------------------------------------------------------
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
const loadOrder = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;
    const totalOrders = await Orders.countDocuments();
    const orders = await Orders.find({})
      .populate("items.productId", "name")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // Sort by creation date (or change if needed)
      .exec();

    // Calculate total pages
    const totalPages = Math.ceil(totalOrders / limit);

    // Get previous and next page numbers
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    // Render the orders page with pagination data
    res.render("admin/orders", {
      orders,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching orders: ${error}`);
    res.status(500).send("Failed to load orders.");
  }
};

// -------------------------------------------------Coupon Management------------------------------------------------------

const loadaddcoupon = async (req, res) => {
  try {
    const products = await Products.find({});
    const Categories = await Category.find({});
    console.log(Categories);

    res.render("admin/addcoupon", { products, Categories });
  } catch (error) {
    console.log("errorr");
    res.render("admin/addcoupon", { message: "errorr" });
  }
};
const loadaddcoupons = async (req, res) => {
  try {
    const Categories = await Category.find({});
    console.log(Categories);

    res.render("admin/addcoupons", { Categories });
  } catch (error) {
    console.log("errorr");
    res.render("admin/addcoupons", { message: "errorr" });
  }
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
      Description
    } = req.body;

    console.log("Request body:", req.body);

    if (
      !CouponCode ||
      !DiscountType ||
      !DiscountValue ||
      !Products.length ||
      !ExpiryDate
    ) {
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

    if (
      UsageLimit &&
      (isNaN(UsageLimit) ||
        UsageLimit <= 0 ||
        !Number.isInteger(Number(UsageLimit)))
    ) {
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

    if (Description && typeof Description !== "string") {
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
      Products, // Now it correctly stores an array of selected products
      MinimumCartValue,
      UsageLimit,
      ExpiryDate: formattedExpiryDate,
      Description
    });

    await newCoupon.save();
    console.log("New coupon saved:", newCoupon);

    return res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error adding coupon:", error.message);
    res.redirect("/admin/coupon");
  }
};
const addcoupons = async (req, res) => {
  try {
    const {
      CouponCode,
      DiscountType,
      DiscountValue,
      Categories,
      MinimumCartValue,
      UsageLimit,
      ExpiryDate,
      Description
    } = req.body;

    console.log("Request body:", req.body);

    if (!CouponCode || !DiscountType || !ExpiryDate) {
      console.log("Missing required fields");
      return res.render("admin/addcoupons", {
        message: "All fields are required"
      });
    }

    // Normalize and validate Categories
    const normalizedCategories = Categories
      ? Array.isArray(Categories)
        ? Categories
        : [Categories]
      : [];
    if (!normalizedCategories.length) {
      console.log("Invalid or missing Categories");
      return res.render("admin/addcoupons", {
        message: "At least one category must be selected"
      });
    }

    // Check for existing coupon code
    const existingcoupon = await Coupon.findOne({ CouponCode });
    if (existingcoupon) {
      console.log("Coupon already exists");
      return res.render("admin/addcoupons", {
        message: "Coupon already exists"
      });
    }

    if (isNaN(DiscountValue) || DiscountValue <= 0) {
      console.log("Invalid DiscountValue");
      return res.render("admin/addcoupons", {
        message: "Discount value must be a positive number"
      });
    }

    if (MinimumCartValue && (isNaN(MinimumCartValue) || MinimumCartValue < 0)) {
      console.log("Invalid MinimumCartValue");
      return res.render("admin/addcoupons", {
        message: "Minimum cart value must be a positive number"
      });
    }

    if (
      UsageLimit &&
      (isNaN(UsageLimit) ||
        UsageLimit <= 0 ||
        !Number.isInteger(Number(UsageLimit)))
    ) {
      console.log("Invalid UsageLimit");
      return res.render("admin/addcoupons", {
        message: "Usage limit must be a positive integer"
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);
    if (isNaN(formattedExpiryDate)) {
      console.log("Invalid ExpiryDate");
      return res.render("admin/addcoupons", {
        message: "Expiry date is invalid"
      });
    }

    if (formattedExpiryDate < new Date()) {
      console.log("Expiry date is in the past");
      return res.render("admin/addcoupons", {
        message: "Expiry date cannot be in the past"
      });
    }

    if (Description && typeof Description !== "string") {
      console.log("Invalid Description");
      return res.render("admin/addcoupons", {
        message: "Description must be a valid string"
      });
    }

    // Save the coupon
    const newCoupon = new Coupon({
      CouponCode,
      DiscountType,
      DiscountValue,
      Categories: normalizedCategories,
      MinimumCartValue,
      UsageLimit,
      ExpiryDate: formattedExpiryDate,
      Description
    });

    await newCoupon.save();
    console.log("New coupon saved:", newCoupon);
    return res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Error adding coupon:", error.message);
    res.redirect("/admin/coupons");
  }
};

const loadcoupon = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;

    const skip = (page - 1) * limit;

    const totalcoupons = await Coupon.countDocuments();

    const coupons = await Coupon.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    const totalPages = Math.ceil(totalcoupons / limit);

    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/coupon", {
      coupons,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalcoupons,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching coupons: ${error}`);
    res.status(500).send("Failed to load coupons.");
  }
};
const deleteCoupon = async (req, res) => {
  const { couponId } = req.params; // Destructure couponId from req.params
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
const unlistCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndUpdate(couponId, { Status: false });
    console.log(`Product ${couponId} successfully unlisted`);
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Failed to unlist the product:", error);
    res.status(500).redirect("/admin/coupon");
  }
};
const listCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndUpdate(couponId, { Status: true });
    console.log(`Product ${couponId} successfully listed`);
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Failed to list the product:", error);
    res.status(500).redirect("/admin/coupon");
  }
};
// -------------------------------------------------Offers Management------------------------------------------------------

const addoffer = async (req, res) => {
  const products = await Products.find({});

  try {
    const {
      DiscountType,
      DiscountValue,
      Description,
      Products: productIds,
      ExpiryDate,
      Status
    } = req.body;

    if (
      !DiscountType ||
      !DiscountValue ||
      !Description ||
      !Array.isArray(productIds) ||
      productIds.length === 0 ||
      !ExpiryDate ||
      !Status
    ) {
      console.log("All fields are required");
      return res.render("admin/addoffer", {
        message: "All fields are required",
        products
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);
    if (isNaN(formattedExpiryDate.getTime())) {
      return res.render("admin/addoffer", {
        message: "Invalid Expiry Date",
        products
      });
    }

    const newoffer = new Offer({
      DiscountType,
      DiscountValue,
      Description,
      Products: productIds,
      ExpiryDate: formattedExpiryDate,
      Status
    });

    await newoffer.save();

    // Update products with the offer
    await Products.updateMany(
      { _id: { $in: productIds } },
      {
        $set: {
          priceWithDiscount:
            DiscountType === "fixed" ? DiscountValue : undefined, // Add logic for percentage if needed
          offer: newoffer._id
        }
      }
    );

    console.log("New offer created: ", newoffer);
    res.redirect("/admin/offer");
  } catch (error) {
    console.error("Error while saving the offer:", error);
    res.status(500).render("admin/addoffer", {
      message: "Make sure you entered everything correctly.",
      products
    });
  }
};
const addoffers = async (req, res) => {
  const category = await Category.find({});
  try {
    const {
      DiscountType,
      DiscountValue,
      Description,
      Categories,
      ExpiryDate,
      Status
    } = req.body;

    if (
      !DiscountType ||
      !DiscountValue ||
      !Description ||
      !Categories ||
      !Categories.length ||
      !ExpiryDate ||
      !Status
    ) {
      console.log("All fields are required");
      return res.render("admin/addoffer", {
        message: "All fields are required",
        category
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);
    const newoffer = new Offer({
      DiscountType,
      DiscountValue,
      Description,
      Categories,
      ExpiryDate: formattedExpiryDate,
      Status
    });

    // Save the offer
    await newoffer.save();
    console.log("New offer created: ", newoffer);
    // await Products.findByIdAndUpdate(
    //   { _id: products._id },
    //   { priceWithDiscount: DiscountValue }
    // );

    // const newprice = new Products.findByIdAndUpdate({
    //   priceWithDiscount
    // });

    // Save the offer
    // await newprice.save();
    // console.log("New offer created: ", newprice);
    // Now associate the offer with the products
    await Category.updateMany(
      { _id: { $in: category } },
      { $set: { offer: newoffer._id } }
    );

    res.redirect("/admin/offer");
  } catch (error) {
    console.log("Error while saving the offer:", error);
    res.status(500).render("admin/addoffer", {
      message: "Make sure you entered everything correctly.",
      products,
      category
    });
  }
};

const loadeditOffer = async (req, res) => {
  const { id: offerId } = req.params;
  const products = await Products.find({});
  const category = await Category.find({});
  const offer = await Offer.findById(offerId);
  if (!offer) {
    console.log("Offer not found");
    return res.redirect("/admin/offer"); // Redirect if the offer is not found
  }

  try {
    res.render("admin/editoffer", { offer, products, category });
    console.log(offer);
  } catch (error) {
    console.log("error while loading edit offer page", error);
  }
};

const editOffer = async (req, res) => {
  const { id: offerId } = req.params;
  const products = await Products.find({});
  const categories = await Category.find({});

  try {
    const {
      DiscountType,
      DiscountValue,
      Description,
      Products: reqProducts,
      Categories: reqCategories,
      ExpiryDate,
      Status
    } = req.body;

    // Normalize and validate input
    const productIds = Array.isArray(reqProducts) ? reqProducts : [reqProducts];
    const categoryIds = Array.isArray(reqCategories)
      ? reqCategories
      : [reqCategories];

    if (
      !DiscountType ||
      !DiscountValue ||
      !Description ||
      !productIds.length ||
      !categoryIds.length ||
      !ExpiryDate ||
      Status == null
    ) {
      console.log("All fields are required");
      return res.render("admin/editoffer", {
        message: "All fields are required",
        products,
        categories
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);

    // Update the offer using reference IDs
    const updatedOffer = await Offer.findByIdAndUpdate(
      offerId,
      {
        DiscountType,
        DiscountValue,
        Description,
        Products: productIds, // Store product IDs as references
        Categories: categoryIds, // Store category IDs as references
        ExpiryDate: formattedExpiryDate,
        Status
      },
      { new: true } // Return the updated document
    );

    if (!updatedOffer) {
      console.log("Offer not found");
      return res.status(404).render("admin/editoffer", {
        message: "Offer not found",
        products,
        categories
      });
    }

    console.log("Updated offer:", updatedOffer);
    res.redirect("/admin/offer");
  } catch (error) {
    console.log("Error while updating the offer:", error);
    return res.status(500).render("admin/editoffer", {
      message: "An error occurred while updating the offer",
      products,
      categories
    });
  }
};
const loadaddoffers = async (req, res) => {
  const category = await Category.find({});

  try {
    res.render("admin/addoffers", { category });
  } catch (error) {
    console.log("error while loading", error);
  }
};
const loadaddoffer = async (req, res) => {
  const products = await Products.find({});

  try {
    res.render("admin/addoffer", { products });
  } catch (error) {
    console.log("error while loading", error);
  }
};
const loadoffers = async (req, res) => {
  try {
    // Get the current page from the query parameter, default to 1 if not provided
    const page = parseInt(req.query.page) || 1;

    // Set the number of products per page, default to 4 if not provided
    const limit = parseInt(req.query.limit) || 4;

    // Calculate how many items to skip based on the current page
    const skip = (page - 1) * limit;

    // Fetch the total number of products
    const totalcoupons = await Offer.countDocuments();

    // Fetch products with pagination
    const offer = await Offer.find({})
      .populate("Products")
      .populate("Categories")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // Sort by creation date (or change if needed)
      .exec();

    // Calculate total pages
    const totalPages = Math.ceil(totalcoupons / limit);

    // Get previous and next page numbers
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    // Render the product page with pagination data
    res.render("admin/offer", {
      offer,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalcoupons,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching offers: ${error}`);
    res.redirect("/admin/dashboard");
  }
};
const deleteOffer = async (req, res) => {
  const { id: offerId } = req.params; // Extract the ID from req.params
  console.log("oferId : ", offerId);
  try {
    // Validate if the ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      console.log("Invalid Offer ID");
      return res.redirect("/admin/offer");
    }
    const deleteoffer = await Offer.findByIdAndDelete(offerId);

    if (!deleteoffer) {
      console.log("Offer not found");
      return res.redirect("/admin/offer"); // Redirect if coupon not found
    }
    console.log("deleted offer : ", deleteoffer);
  } catch (error) {
    console.log("error", error);
  }
};

const unlistOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await Offer.findByIdAndUpdate(offerId, { Status: false });
    console.log(`Product ${offerId} successfully unlisted`);
    res.redirect("/admin/offer");
  } catch (error) {
    console.error("Failed to unlist the product:", error);
    res.status(500).redirect("/admin/offer");
  }
};
const listOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await Offer.findByIdAndUpdate(offerId, { Status: true });
    console.log(`Product ${offerId} successfully listed`);
    res.redirect("/admin/offer");
  } catch (error) {
    console.error("Failed to list the product:", error);
    res.status(500).redirect("/admin/offer");
  }
};
//-------------sales report-------------------------------------------------
const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, filter, page = 1, limit = 5 } = req.query;

    const filterConditions = { "items.status": "delivered" };

    // Handle date filtering
    if (startDate && endDate) {
      filterConditions.time = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Fetch and process data
    const orders = await Orders.find(filterConditions).populate("items.productId");

    // Reduce data into a grouped report by month or day based on the filter
    const groupByKey =
      filter === "daily"
        ? order => order.time.toISOString().split("T")[0]
        : filter === "monthly"
          ? order => `${order.time.getMonth() + 1}-${order.time.getFullYear()}`
          : filter === "weekly"
            ? order =>
                `Week-${Math.ceil(order.time.getDate() / 7)} ${order.time.getFullYear()}`
            : order => `${order.time.getFullYear()}`; // Default yearly grouping

    const salesData = orders.reduce((acc, order) => {
      const key = groupByKey(order);

      if (!acc[key]) {
        acc[key] = {
          key,
          totalSales: 0,
          totalDiscount: 0,
          orderCount: 0,  // Initialize order count
          netSale: 0,     // Initialize netSale for this period
          orders: []
        };
      }

      // Calculate total discount for the order
      const totalDiscount = order.items.reduce(
        (sum, item) =>
          sum + (item.price - (item.priceWithDiscount || item.price)) * item.quantity,
        0
      );

      // Calculate net sale for the order
      const netSale = order.orderTotal - totalDiscount;

      // Increment order count for this group
      acc[key].orderCount += 1;

      acc[key].totalSales += order.orderTotal;
      acc[key].totalDiscount += totalDiscount;
      acc[key].netSale += netSale; // Sum up netSale for the overall period

      acc[key].orders.push({
        orderId: order._id,
        date: order.time,
        customer: `${order.shippingAddress.firstname} ${order.shippingAddress.lastname}`,
        paymentMethod: order.paymentMethod,
        totalAmount: order.orderTotal,
        discount: totalDiscount,
        netSale, // Include netSale for each order
      });

      return acc;
    }, {});

    const salesReport = Object.values(salesData);
    console.log("salesReport", salesReport);
    console.log("salesData", salesData);

    // Calculate the overall netSale from all salesData
    const overallNetSale = salesReport.reduce((total, period) => total + period.netSale, 0);

    console.log("Overall Net Sale:", overallNetSale); // Log overall net sale

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedReports = salesReport.slice(skip, skip + limit);
    const totalPages = Math.ceil(salesReport.length / limit);

    res.render("admin/salesreport", {
      salesReport: paginatedReports,
      totalPages,
      currentPage: page,
      filter,
      startDate,
      endDate,
      salesData: JSON.stringify(paginatedReports), // Stringify salesData for hidden input
      overallNetSale // Send overallNetSale to the view for display
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    res.status(500).send("Failed to load sales report.");
  }
};



// const getSalesReport = async (req, res) => {
//   try {
//     const { startDate, endDate, filter, page = 1, limit = 5 } = req.query;

//     const filterConditions = { "items.status": "delivered" };

//     // Handle date filtering
//     if (startDate && endDate) {
//       filterConditions.time = {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate)
//       };
//     }

//     // Fetch and process data
//     const orders = await Orders.find(filterConditions).populate("items.productId");

//     // Reduce data into a grouped report by month or day based on the filter
//     const groupByKey =
//       filter === "daily"
//         ? order => order.time.toISOString().split("T")[0]
//         : filter === "monthly"
//           ? order => `${order.time.getMonth() + 1}-${order.time.getFullYear()}`
//           : filter === "weekly"
//             ? order =>
//                 `Week-${Math.ceil(
//                   order.time.getDate() / 7
//                 )} ${order.time.getFullYear()}`
//             : order => `${order.time.getFullYear()}`; // Default yearly grouping

//     const salesData = orders.reduce((acc, order) => {
//       const key = groupByKey(order);

//       if (!acc[key]) {
//         acc[key] = {
//           key,
//           totalSales: 0,
//           totalDiscount: 0,
//           orders: [],
//           orderCount: 0,
//           totalAmount: 0,
//         };
//       }

//       const totalDiscount = order.items.reduce(
//         (sum, item) =>
//           sum +
//           (item.price - (item.priceWithDiscount || item.price)) * item.quantity,
//         0
//       );

//       acc[key].totalSales += order.orderTotal;
//       acc[key].totalDiscount += totalDiscount;
//       acc[key].orderCount += 1; // Increment order count
//       acc[key].totalAmount += order.orderTotal; // Total order amount
//       acc[key].orders.push({
//         orderId: order._id,
//         date: order.time,
//         customer: `${order.shippingAddress.firstname} ${order.shippingAddress.lastname}`,
//         paymentMethod: order.paymentMethod,
//         totalAmount: order.orderTotal,
//         discount: totalDiscount,
//         netSale: order.orderTotal - totalDiscount
//       });

//       return acc;
//     }, {});

//     const salesReport = Object.values(salesData);
//     console.log("salesReport", salesReport);
//     console.log("salesData", salesData);

//     // Pagination
//     const skip = (page - 1) * limit;
//     const paginatedReports = salesReport.slice(skip, skip + limit);
//     const totalPages = Math.ceil(salesReport.length / limit);

//     // Calculate overall sales count, amount, and discount
//     const overallSalesCount = salesReport.reduce((sum, data) => sum + data.orderCount, 0);
//     const overallTotalAmount = salesReport.reduce((sum, data) => sum + data.totalAmount, 0);
//     const overallTotalDiscount = salesReport.reduce((sum, data) => sum + data.totalDiscount, 0);

//     res.render("admin/salesreport", {
//       salesReport: paginatedReports,
//       totalPages,
//       currentPage: page,
//       filter,
//       startDate,
//       endDate,
//       salesData: JSON.stringify(paginatedReports), // Stringify salesData for hidden input
//       overallSalesCount,
//       overallTotalAmount,
//       overallTotalDiscount
//     });
//   } catch (error) {
//     console.error("Error fetching sales report:", error);
//     res.status(500).send("Failed to load sales report.");
//   }
// };

const exportPDF = async (req, res) => {
  try {
    const salesData = JSON.parse(req.body.salesData); // Parse the stringified salesData

    const doc = new PDFDocument({ margin: 20 });
    const filename = `Sales_Report_${Date.now()}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    // Title
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Sales Report", { align: "center" });
    doc.moveDown(1);

    // Table header style
    const tableHeaders = [
      "Order Date",
      "Order ID",
      "User Name",
      "paying Type",
      "Amount",
      "Discount",
      "Net Sale"
    ];

    // Function to draw a horizontal line
    const drawLine = y => {
      doc.moveTo(30, y + 10).lineTo(560, y + 10).stroke(); // Line moved slightly further down
    };

    let currentY = doc.y + 100; // Increased starting position to move everything down

    salesData.forEach((report, index) => {
      // Group Title
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Group: ${report.key}`, 40, currentY);
      currentY = doc.y + 20; // More space below the group title

      drawLine(currentY);
      // Table Headers
      currentY += 25; // Add more space before table headers
      doc.fontSize(12).font("Helvetica-Bold");
      tableHeaders.forEach((header, i) => {
        const x = 40 + i * 75;
        doc.text(header, x, currentY, { width: 70, align: "left" });
      });
      currentY += 25; // Add more space after table headers

      // Table Rows
      report.orders.forEach(order => {
        doc.fontSize(10).font("Helvetica");
        const rowData = [
          new Date(order.date).toLocaleDateString(),
          order.orderId,
          order.customer,
          order.paymentMethod,
          `₹${order.totalAmount.toLocaleString()}`,
          `₹${order.discount.toLocaleString()}`,
          `₹${order.netSale.toLocaleString()}`
        ];

        rowData.forEach((data, i) => {
          const x = 40 + i * 75;
          doc.text(data, x, currentY, { width: 70, align: "left" });
        });

        currentY += 30; // Increased spacing between rows for better readability

        // Check if the page is running out of space
        if (currentY > 750) {
          doc.addPage();
          currentY = 70; // Reset position on new page with additional top margin
          drawLine(currentY);
        }
      });

      currentY += 30; // Add more space after each group
    });
    drawLine(currentY);

    // Footer
    const footerY = doc.page.height - 30;
    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Sales Report Generated Automatically", 40, footerY, {
        align: "left"
      })
      .text(`Date: ${new Date().toLocaleDateString()}`, 500, footerY, {
        align: "right"
      });

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Failed to generate PDF.");
  }
};


const exportExcel = async (req, res) => {
  try {
      const salesData = JSON.parse(req.body.salesData); // Parse the string into an object
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      worksheet.columns = [
          { header: "Order Date", key: "date" },
          { header: "Order ID", key: "orderId" },
          { header: "Customer Name", key: "customer" },
          { header: "Payment Method", key: "paymentMethod" },
          { header: "Total Amount", key: "totalAmount" },
          { header: "Discount", key: "discount" },
          { header: "Net Sale", key: "netSale" }
      ];

      // Process each report and order
      salesData.forEach(report => {
          report.orders.forEach(order => worksheet.addRow(order));
      });

      const filename = `Sales_Report_${Date.now()}.xlsx`;

      res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
      );
      res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      await workbook.xlsx.write(res);
      res.end();
  } catch (error) {
      console.error("Error exporting Excel:", error.message);
      res.redirect("/admin/salesreport");
  }
};


module.exports = {
  exportPDF,
  listOffer,
  unlistOffer,
  getSalesReport,
  editOffer,
  loadeditOffer,
  deleteOffer,
  deleteCoupon,
  addcoupon,
  loadaddcoupon,
  loadcoupon,
  editinventory,
  updateOrderStatus,
  cancelOrderItem,
  upload,
  loadinventory,
  loadOrder,
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
  editcategory,
  loadoffers,
  addoffer,
  loadaddoffer,
  exportExcel,
  addcoupons,
  loadaddcoupons,
  loadaddoffers,
  addoffers,
  unlistCoupon,
  listCoupon
};
