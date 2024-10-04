const express = require('express');
const sessionController = require('../controllers/sessionManagement-controller');
const sessionRouter = express.Router();

sessionRouter.post("/register",sessionController.registration);
sessionRouter.post("/login",sessionController.login);
sessionRouter.post("/logout",sessionController.logout);
sessionRouter.get("/newAccessToken",sessionController.getNewAccessTokenByRefreshToken);


module.exports = sessionRouter;