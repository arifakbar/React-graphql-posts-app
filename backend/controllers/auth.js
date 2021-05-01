const User = require("../models/user");

const bcrypt = require("bcryptjs");
const { validationResult, Result } = require("express-validator");
const jwt = require("jsonwebtoken");
const user = require("../models/user");

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed!");
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }
  const email = req.body.email;
  const password = req.body.password;
  const name = req.body.name;
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      email: email,
      name: name,
      password: hashedPassword,
    });
    const result = await user.save();
    res.status(201).json({
      message: "User created successfully",
      userId: result._id,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  try {
    const loadedUser = await User.findOne({ email: email });
    await bcrypt.compare(password, loadedUser.password);
    const token = jwt.sign(
      {
        email: loadedUser.email,
        userId: loadedUser._id.toString(),
      },
      "secret_string",
      { expiresIn: "1h" }
    );
    res.status(200).json({
      message: "Logged-in successfully",
      token: token,
      userId: loadedUser._id.toString(),
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getStatus = async (req, res, next) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId);
    res.status(200).json({
      status: user.status,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  const userId = req.userId;
  const status = req.body.status;
  try {
    const user = await User.findById(userId);
    user.status = status;
    await user.save();
    res.status(200).json({
      message: "Status updated!",
      status: status,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
