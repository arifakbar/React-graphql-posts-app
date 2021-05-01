const User = require("../models/user");
const Post = require("../models/post");

const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = {
  createUser: async function ({ userInput }, req) {
    const errors = [];
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: "Invalid Email!" });
    }
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: "Password is too short!" });
    }
    if (errors.length > 0) {
      const error = new Error("invalid Input");
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error("Email already in use!");
      throw error;
    }
    const hashedPassword = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPassword,
    });
    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },

  login: async function ({ email, password }, req) {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error("User not found!");
      error.code = 404;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Incorrect password!");
      error.code = 401;
      throw error;
    }
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      "secret_string",
      { expiresIn: "1h" }
    );
    return { token: token, userId: user._id.toString() };
  },

  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: "Title is too short!" });
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: "Content is too short!" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.code = 422;
      error.data = errors;
      throw error;
    }
    const user = await User.findById(req.userId);
    // const user = await User.findById("60883719ddec030f9ce319e7");
    if (!user) {
      const error = new Error("User not found!");
      error.code = 404;
      throw error;
    }
    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user,
    });
    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },

  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }
    if (!page) {
      page = 1;
    }
    const perPage = 2;
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate("creator");
    const totalPosts = await Post.find().countDocuments();
    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalPosts,
    };
  },
  post: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated");
      error.code = 401;
      throw error;
    }
    const fetchedPost = await Post.findById(id).populate("creator");
    if (!fetchedPost) {
      const error = new Error("Post not found!");
      error.code = 404;
      throw error;
    }
    return {
      ...fetchedPost._doc,
      _id: fetchedPost._id.toString(),
      createdAt: fetchedPost.createdAt.toISOString(),
      updatedAt: fetchedPost.updatedAt.toISOString(),
    };
  },
  updatePost: async function ({ id, postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (
      validator.isEmpty(postInput.title) &&
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: "Title is too short!" });
    }
    if (
      validator.isEmpty(postInput.content) &&
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: "Content is too short!" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.code = 422;
      error.data = errors;
      throw error;
    }
    const fetchedPost = await Post.findById(id).populate("creator");
    if (!fetchedPost) {
      const error = new Error("Post not found!");
      error.code = 404;
      throw error;
    }
    if (fetchedPost.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not Authorized!");
      error.code = 403;
      throw error;
    }
    fetchedPost.title = postInput.title;
    fetchedPost.content = postInput.content;
    if (postInput.imageUrl !== "undefined") {
      fetchedPost.imageUrl = postInput.imageUrl;
    }
    const updatedPost = await fetchedPost.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id);
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }
    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized!");
      error.code = 403;
      throw error;
    }
    clearImage(post.imageUrl);
    await Post.findByIdAndRemove(id);
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();
    return true;
  },
  userStatus: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found!");
      error.code = 404;
      throw error;
    }
    return { ...user._doc, _id: user._id.toString() };
  },
  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.code = 401;
      throw error;
    }
    // const user = await User.findById("6089259b2412202bd090b49c");
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found!");
      error.code = 404;
      throw error;
    }
    const errors = [];
    if (!validator.isLength(status, { min: 3 })) {
      errors.push({ message: "Status is too short!" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid Input");
      error.data = errors;
      error.code = 422;
      throw error;
    }
    user.status = status;
    await user.save();
    return { ...user._doc, id: user._id.toString() };
  },
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.log(err);
    }
  });
};
