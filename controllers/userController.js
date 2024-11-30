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
const Offer = require("../model/offermodel");
const client = new OAuth2Client(
  "458432719748-rs94fgenq571a8jfulbls7dk9i10mv2o.apps.googleusercontent.com"
);

require("dotenv").config();

const loadhome = async (req, res) => {
  console.log(req.session);
  try {
    if (req.session.passport && req.session.passport.user) {
      req.session.userId = req.session.passport.user;
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

// const loadproducts = async (req, res) => {
//   try {
//     // Fetch all categories and products
//     const categories = await Category.find({});
//     const products = await Products.find({})
//       .populate("offer") // Populating offer field
//       .populate("category"); // Populating category field
//     const activeoffer = await Offer.find({ Status: true });

//     const productsWithOfferPrice = products.map((product) => {
//       let discountValue = null;
//       let discountType = null;
//       let offerPrice = product.price; // Default to original price

//       // Find the matched offer for the product
//       const matchedOffer = activeoffer.find(offer => offer.Products.includes(product._id));

//       if (matchedOffer) {
//         discountType = matchedOffer.DiscountType;
//         if (discountType === "percentage") {
//           offerPrice = product.price - (product.price * matchedOffer.DiscountValue) / 100;
//           discountValue = `${matchedOffer.DiscountValue}%`;
//         } else if (discountType === "fixed") {
//           offerPrice = product.price - matchedOffer.DiscountValue;
//           discountValue = `${matchedOffer.DiscountValue}`;
//         }
//       }

//       return {
//         _id: product._id,
//         name: product.name,
//         images:product.images,
//         category:product.category,
//         price: product.price,
//         offerPrice: offerPrice,  // New field for offer price
//         discountValue: discountValue,  // Discount value (e.g., 10% or ₹500)
//         offerType: discountType,  // Discount type (percentage or fixed)
//       };
//     });

//     // Render the page with updated products and categories
//     res.render("products", { products: productsWithOfferPrice, categories });
//   } catch (error) {
//     console.error("Error fetching and updating products:", error);
//     res.status(500).send("Failed to fetch or update products.");
//   }
// };


const loadproducts = async (req, res) => {
  try {
    // Fetch all categories and products
    const categories = await Category.find({});
    const products = await Products.find({})
      .populate("offer") // Populating offer field
      .populate("category"); // Populating category field
    const activeoffer = await Offer.find({ Status: true });

    const productsWithOfferPrice = products.map((product) => {
      let discountValue = null;
      let discountType = null;
      let offerPrice = product.price; // Default to original price

      // Find the matched offer for the product
      const matchedOffer = activeoffer.find(offer => offer.Products.some(productId => productId.equals(product._id)));

      if (matchedOffer) {
        discountType = matchedOffer.DiscountType;
        if (discountType === "percentage") {
          offerPrice = product.price - (product.price * matchedOffer.DiscountValue) / 100;
          discountValue = `${matchedOffer.DiscountValue}%`;
        } else if (discountType === "fixed") {
          offerPrice = product.price - matchedOffer.DiscountValue;
          discountValue = `₹${matchedOffer.DiscountValue}`;
        }
      }

      return {
        _id: product._id,
        name: product.name,
        images: product.images,
        category: product.category,
        price: product.price,
        offerPrice: offerPrice, // New field for offer price
        discountValue: discountValue, // Discount value (e.g., 10% or ₹500)
        offerType: discountType, // Discount type (percentage or fixed)
        stock:product.stock,
      };
    });

    // Render the page with updated products and categories
    res.render("products", { products: productsWithOfferPrice, categories });
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
      limit = 10
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
      if (!isNaN(parseFloat(minPrice)))
        filter.price.$gte = parseFloat(minPrice);
      if (!isNaN(parseFloat(maxPrice)))
        filter.price.$lte = parseFloat(maxPrice);
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
      zToA: { name: -1 }
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
        totalPages: Math.ceil(totalProducts / limit)
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
  singleproduct
};
