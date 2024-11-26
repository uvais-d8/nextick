const bcrypt = require("bcrypt");
const User = require("../model/usermodal");
const Products = require("../model/productsmodal");
const saltround = 10;
const path = require("path");
const userotpverification = require("../model/otpverification");
const nodemailer = require("nodemailer");
const googlemodal = require("../model/googleModel");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersmodal");
const { OAuth2Client } = require("google-auth-library");
const { Console, profile, log, error } = require("console");
const Category = require("../model/categoryModel");
const client = new OAuth2Client(
  "458432719748-rs94fgenq571a8jfulbls7dk9i10mv2o.apps.googleusercontent.com"
);

require("dotenv").config();

const loadhome = async (req, res) => {
  console.log(req.session)
  try {
    
    if(req.session.passport && req.session.passport.user){
      req.session.userId=req.session.passport.user;
    }
    // Fetch products and populate their category data
    const products = await Products.find({ islisted: true }) // Fetch only listed products
      .populate({
        path: "category", // Reference the category field
        match: { islisted: true }, // Only include listed categories
        select: "category islisted" // Only include necessary fields from the category
      });

    // Filter out products where the category is not listed
    const filteredProducts = products.filter(product => product.category);

    // Render the home page with filtered products
    res.render("home", { products: filteredProducts });
  } catch (err) {
    console.error("Error loading home page:", err);
    res.status(500).send("Failed to load home page");
  }
};
const loadproducts = async (req, res) => {
  try {
    // Step 1: Fetch all categories and products
    const categories = await Category.find({});
    const products = await Products.find({});

    // Step 2: Update product categories with ObjectId if necessary
    for (const product of products) {
      const category = categories.find(
        cat => cat.category === product.category
      );

      if (category) {
        product.category = category._id; // Update product with category's ObjectId
        await product.save();
        console.log(
          `Updated product ${product.name} with category ${category.category}`
        );
      } else {
        // console.warn(`No matching category found for product ${product.name}`);
      }
    }

    // Step 3: Fetch listed products with their populated category data
    const listedProducts = await Products.find({ islisted: true }) // Only fetch listed products
      .populate({
        path: "category", // Populate the 'category' field
        match: { islisted: true }, // Only include listed categories
        select: "category brand islisted" // Select relevant fields
      });

    // Step 4: Filter products that have a valid category (category exists)
    const filteredProducts = listedProducts.filter(product => product.category);

    if (filteredProducts.length === 0) {
      console.warn("No products with valid listed categories found.");
      return res.render("products", { message: "No products available." });
    }

    // Step 5: Render the products page with filtered products
    res.render("products", { products: filteredProducts, categories });
  } catch (error) {
    console.error("Error fetching and updating products:", error);
    res.status(500).send("Failed to fetch or update products.");
  }
};
const singleproduct = async (req, res) => {
  const productId = req.params.id;
  // console.log(productId);
  try {
    const product = await Products.findById(productId);
    const products = await Products.find({ islisted: true });
    // console.log(product);
    if (!product) {
      return res.status(404).send("Product not found");
    }
    res.render("singleproduct", { product, products });
  } catch (error) {
    console.error(error);
  }
};
const loadshop = (req, res) => {
  try {
    res.redirect("/shop");
  } catch (error) {
    console.error(error);
  }
};
const loadaboutpage = (req, res) => {
  res.render("about");
};
const loadcontactpage = (req, res) => {
  res.render("contact");
};

const advancedSearch = async (req, res) => {
  try {
    const {
      query = "",
      sort,
      showOutOfStock,
      minPrice,
      maxPrice,
      category,
      rating,
      page = 1,
      limit = 10,
    } = req.query;

    let filter = { islisted: true };

    if (query) {
      filter.name = { $regex: query.trim(), $options: "i" };
    }

    if (showOutOfStock === "exclude") {
      filter.stock = { $gt: 0 };
    }

    if (!isNaN(parseFloat(minPrice)) || !isNaN(parseFloat(maxPrice))) {
      filter.price = {};
      if (!isNaN(parseFloat(minPrice))) filter.price.$gte = parseFloat(minPrice);
      if (!isNaN(parseFloat(maxPrice))) filter.price.$lte = parseFloat(maxPrice);
    }

    if (category && category !== "all") {
      const categoryDoc = await Category.findOne({ category: category.trim() });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      } else {
        console.warn(`Category not found: ${category}`);
      }
    }

    // Sorting options
    const sortOptions = {
      popularity: { popularity: -1 },
      priceLowToHigh: { price: 1 },
      priceHighToLow: { price: -1 },
      averageRatings: { averageRating: -1 },
      featured: { featured: -1 },
      newArrivals: { createdAt: -1 },
      aToZ: { name: 1 },
      zToA: { name: -1 },
    };
    const sortOption = sortOptions[sort] || {};

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Products.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("category", "category brand");

    const totalProducts = await Products.countDocuments(filter);

    if (req.xhr) {
      return res.json({ products, totalProducts, currentPage: parseInt(page) });
    } else {
      res.render("products", {
        products,
        query,
        sort,
        showOutOfStock,
        minPrice,
        maxPrice,
        category,
        rating,
        totalProducts,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProducts / limit),
      });
    }
  } catch (error) {
    console.log("Error during advanced search:", error);
    res.status(500).json({ message: "Error fetching products." });
  }
};

module.exports = {
  advancedSearch,
  loadcontactpage,
  loadshop,
  loadaboutpage,
  loadhome,
  loadproducts,
  singleproduct,
};
