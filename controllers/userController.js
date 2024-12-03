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


const loadproducts = async (req, res) => {
  try {
    // Fetch all categories and products
    const categories = await Category.find({});
    const products = await Products.find({islisted:true})
      .populate("offer") // Populate the offer field to get offer details
      .populate("category"); // Populate the category field for product categorization

    // Fetch active offers (Status: true)
    const activeOffers = await Offer.find({ Status: true });

    // Process products to include calculated offer price and discount details
    const productsWithOfferPrice = products.map((product) => {
      let discountValue = null;
      let discountType = null;
      let offerPrice = product.price; // Set the offer price to the base price by default
      let discountDisplay = null;

      // Find matching offer
      const matchedOffer = activeOffers.find(offer =>
        offer.Products.some(productId => productId.equals(product._id))
      );

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

      // Include the offerPrice and discount information
      return {
        _id: product._id,
        name: product.name,
        images: product.images,
        category: product.category,
        price: product.price, // Original price without discount
        offerPrice: offerPrice, // Calculated price after discount
        discountValue: discountValue, 
        discountType: discountType,
        stock: product.stock,
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

  try {
    // Fetch the product by ID and all active offers
    const product = await Products.findById(productId).populate("offer").populate("category");
    const activeOffers = await Offer.find({ Status: true });
    const products = await Products.find({ islisted: true });

    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Initialize default values
    let discountValue = null;
    let discountType = null;
    let priceWithDiscount = product.price; // Default to original price

    // Match the product with an active offer
    const matchedOffer = activeOffers.find((offer) =>
      offer.Products.some((productId) => productId.equals(product._id))
    );

    // If a matched offer is found, calculate the discounted price
    if (matchedOffer) {
      discountType = matchedOffer.DiscountType;

      if (discountType === "percentage") {
        priceWithDiscount = product.price - (product.price * matchedOffer.DiscountValue) / 100;
        discountValue = `${matchedOffer.DiscountValue}%`;
      } else if (discountType === "fixed") {
        priceWithDiscount = product.price - matchedOffer.DiscountValue;
        discountValue = `₹${matchedOffer.DiscountValue}`;
      }
    }

    // Add offer-related details to the product object
    const productWithOffer = {
      ...product.toObject(), // Convert Mongoose document to plain object
      priceWithDiscount,
      discountValue,
      discountType,
    };

    // Render the single product page with updated details
    res.render("singleproduct", { product: productWithOffer, products });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).send("Failed to fetch product details.");
  }
};
const loadWishlist = async(req,res)=>{
  try {
    // Fetch all categories and products
    const categories = await Category.find({});
    const products = await Products.find({wishlist:true})
      .populate("offer") // Populate the offer field to get offer details
      .populate("category"); // Populate the category field for product categorization

    // Fetch active offers (Status: true)
    const activeOffers = await Offer.find({ Status: true});

    // Process products to include calculated offer price and discount details
    const productsWithOfferPrice = products.map((product) => {
      // Initialize default values
      let discountValue = null;
      let discountType = null;
      let offerPrice = product.price; // Default to the original price

      // Find the active offer applicable to the product
      const matchedOffer = activeOffers.find(offer =>
        offer.Products.some(productId => productId.equals(product._id))
      );

      // If an offer is matched, calculate offer price and discount details
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

      // Return the product object with all necessary fields
      return {
        _id: product._id,
        name: product.name,
        images: product.images,
        category: product.category,
        price: product.price,
        ...(matchedOffer && { // Only include offer-related fields if an offer exists
          offerPrice: offerPrice,
          discountValue: discountValue,
          offerType: discountType,
        }),
        stock: product.stock,
      };
    });

    // Render the page with updated products and categories
    res.render("wishlist", { products: productsWithOfferPrice, categories });
  } catch (error) {
    
  }
}
// Toggle Wishlist
const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.userId;
    const product = await Products.findById(productId);
    const isInWishlist = product.wishlist;
    product.wishlist = !isInWishlist;
    await product.save();
    res.json({ success: true, wishlist: product.wishlist });
  } catch (error) {
    console.error("Error toggling wishlist:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
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
  singleproduct,
  loadWishlist,
  toggleWishlist,
};
