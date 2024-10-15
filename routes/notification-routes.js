const express = require('express');
const sessionController = require('../controllers/sessionManagement-controller');
const notificationController = require('../controllers/notification-controller');
const notificationRouter = express.Router();

notificationRouter.get("/show/allUserNotifications",sessionController.accessTokenValidation,notificationController.showAllUserNotifications);
notificationRouter.delete("/delete/oneNotification",sessionController.accessTokenValidation,notificationController.deleteNotification);
notificationRouter.get("/SSE",sessionController.accessTokenValidation,notificationController.notificationSSE);

module.exports = notificationRouter;