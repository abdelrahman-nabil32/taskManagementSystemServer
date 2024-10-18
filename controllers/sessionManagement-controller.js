const mongoose = require("mongoose");
const UserModel = require("../models/User-model");
const passwordValidator = require("password-validator");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const registration = async (req, res) => {
  //preparing password schema to follow it
  let passwordschema = new passwordValidator();
  passwordschema
    .is()
    .min(8)
    .is()
    .max(100)
    .has()
    .uppercase()
    .has()
    .lowercase()
    .has()
    .digits(2)
    .has()
    .not()
    .spaces();
  //--------------------------------------
  let { fullName, username, email, password } = req.body;

  if (fullName && username && email && password) {
    fullName = fullName.trim();
    username = username.trim();
    email = email.trim();
    password = password.trim();
  }
  // validate the new data of the user before store it
  if (!fullName || !username || !email || !password) {
    return res.status(400).json({
      status: "FAIL",
      message: "All user fields shouldn't be empty",
    });
  } else if (/\s/.test(username)) {
    return res
      .status(400)
      .json({ status: "FAIL", message: "username shouldn't have spaces" });
  } else if (!validator.isEmail(email)) {
    return res.status(400).json({
      status: "FAIL",
      message: "email should follow the format of emails",
    });
  } else if (!passwordschema.validate(password)) {
    let temp = passwordschema.validate(password, { details: true });
    temp = temp.map((ele) => ele.message);
    return res.status(400).json({ status: "FAIL", message: temp });
  }
  //--------------------------------------
  try {
    //checking whether the email is already existent or not
    const checkedUser = await UserModel.findOne(
      { email: email },
      { password: false, refreshToken: false }
    );
    if (checkedUser) {
      return res
        .status(400)
        .json({ status: "FAIL", message: "this email is already existent" });
    }
    //hashing the password before storing it in db
    const salt = await bcrypt.genSalt(10);
    let hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new UserModel({
      fullName,
      username,
      email,
      password: hashedPassword,
    });
    let savedUser = await newUser.save();
    //generating access token and refresh token;
    const refreshToken = jwt.sign(
      { tokenUserID: savedUser["_id"] },
      process.env.REFRESH_TOKEN_SECRET_KEY,
      { expiresIn: "1d" }
    );
    const accessToken = jwt.sign(
      {
        // may be changes here and may be there a changes in the field which may encripted when user change his profile data
        tokenUserID: savedUser["_id"], //user can't change email or username so far
        username: savedUser.username,
        fullName: savedUser.fullName,
        email,
      },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      { expiresIn: "1h" }
    ); // may be changes here
    //storing the refresh token in db
    savedUser.refreshToken = refreshToken;
    await savedUser.save();
    //sending the tokens to client
    return res.status(200).json({
      status: "SUCCESS",
      message: "User registered successfully",
      data: {
        tokens: { accessToken, refreshToken },
        userInfo: {
          _id: savedUser._id,
          fullName,
          username: savedUser.username,
          email: savedUser.email,
        },
      },
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const login = async (req, res) => {
  let { email, password } = req.body;
  if (password && email) {
    email = email.trim();
    password = password.trim();
  }
  if (!email || !password) {
    return res.status(400).json({
      status: "FAIL",
      message: "email and password shouldn't be empty",
    });
  }
  try {
    //email checking
    const checkedUser = await UserModel.findOne({ email: email });
    if (!checkedUser) {
      return res
        .status(404)
        .json({ status: "FAIL", message: "Invalid email or password" });
    }
    //password checking
    let isMatch = await bcrypt.compare(password, checkedUser.password);
    if (!isMatch) {
      return res
        .status(404)
        .json({ status: "FAIL", message: "Invalid email or password" });
    }
    //generating access token and refresh token;
    const refreshToken = jwt.sign(
      { tokenUserID: checkedUser["_id"] },
      process.env.REFRESH_TOKEN_SECRET_KEY,
      { expiresIn: "1d" }
    );
    const accessToken = jwt.sign(
      {
        // may be changes here and may be there a changes in the field which may encripted when user change his profile data
        tokenUserID: checkedUser["_id"], //user can't change email or username so far
        username: checkedUser.username,
        fullName: checkedUser.fullName,
        email,
      },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      { expiresIn: "1h" }
    ); // may be changes here
    //storing the refresh token in db
    checkedUser.refreshToken = refreshToken;
    const fullName = checkedUser.fullName;
    await checkedUser.save();
    //sending the tokens to client
    res.status(200).json({
      status: "SUCCESS",
      data: {
        tokens: { accessToken, refreshToken },
        userInfo: {
          _id: checkedUser["_id"],
          fullName,
          username: checkedUser.username,
          email: checkedUser.email,
        },
      },
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const logout = async (req, res) => {
  let { refreshToken } = req.body;

  if (refreshToken) refreshToken = refreshToken.trim();
  if (!refreshToken) {
    return res
      .status(400)
      .json({ status: "FAIL", message: "refresh token is required" });
  }

  try {
    let user = await UserModel.findOne({ refreshToken: refreshToken });
    if (!user) {
      return res
        .status(404)
        .json({ status: "FAIL", message: "Invalid refresh token" });
    }
    user.refreshToken = "";
    await user.save();
    return res
      .status(200)
      .json({ status: "SUCCESS", message: "Logged out successfully" });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const accessTokenValidation = (req, res, next) => {
  let accessToken = req.headers["authorization"];
  if (accessToken) {
    accessToken = accessToken.trim();
    accessToken = accessToken.split(" ")[1];
  }
  if (!accessToken)
    return res
      .status(401)
      .json({ status: "FAIL", message: "access token is required" });

  try {
    const verifiedAccessToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET_KEY
    );
    req.user = {
      _id: verifiedAccessToken.tokenUserID,
      fullName: verifiedAccessToken.fullName,
      username: verifiedAccessToken.username,
      email: verifiedAccessToken.email,
    };
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ status: "ERROR", message: "Invalid access token" });
  }
};
const getNewAccessTokenByRefreshToken = async (req, res) => {
  let { refreshToken } = req.body;
  if (refreshToken) {
    refreshToken = refreshToken.trim();
  }
  if (!refreshToken) {
    return res
      .status(403)
      .json({ status: "FAIL", message: "refresh token is required" });
  }

  try {
    const verifiedRefreshToken = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET_KEY
    );
    const checkedUser = await UserModel.findById(
      verifiedRefreshToken.tokenUserID
    );

    if (!checkedUser || checkedUser.refreshToken !== refreshToken) {
      return res
        .status(403)
        .json({ status: "ERROR", message: "invalid refresh token" });
    }
    const newAccessToken = jwt.sign(
      {
        // may be changes here
        tokenUserID: checkedUser["_id"],
        fullName: checkedUser.fullName,
        username: checkedUser.username,
        email: checkedUser.email,
      },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      { expiresIn: "1h" }
    ); // may be changes here

    return res
      .status(201)
      .json({ status: "SUCCESS", data: { accessToken: newAccessToken } });
  } catch (error) {
    return res.status(403).json({
      status: "ERROR",
      message: `invalid refresh token or ${error.message}`,
    });
  }
};
const accessTokenValidationForSSE = (req, res, next) => {
  let { accessToken } = req.query;
  if (accessToken) {
    accessToken = accessToken.trim();
  }
  if (!accessToken) {
    return res.write(
      `event: error\ndata: ${JSON.stringify({
        error: "Access token is required",
      })}\n\n`
    );
  }
  try {
    const verifiedAccessToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET_KEY
    );
    req.user = {
      _id: verifiedAccessToken.tokenUserID,
      fullName: verifiedAccessToken.fullName,
      username: verifiedAccessToken.username,
      email: verifiedAccessToken.email,
    };
    next();
  } catch (error) {
    return res.write(
      `event: error\ndata: ${JSON.stringify({
        error: "Access token is required",
      })}\n\n`
    );
  }
};

module.exports = {
  registration,
  login,
  logout,
  accessTokenValidation,
  getNewAccessTokenByRefreshToken,
  accessTokenValidationForSSE,
};
