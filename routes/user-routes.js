const express = require('express');
const sessionController = require('../controllers/sessionManagement-controller');
const userController = require('../controllers/user-controller');
const userRouter = express.Router();

userRouter.post("/update/profile",sessionController.accessTokenValidation,userController.updateUserProfile);

module.exports = userRouter;