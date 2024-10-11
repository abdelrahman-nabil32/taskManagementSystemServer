const mongoose = require("mongoose");
const schedule = require("node-schedule");
const moment = require("moment-timezone");
const TaskModel = require("../models/Task-model");
const UserModel = require("../models/User-model");
const TeamModel = require("../models/Team-model");
const NotificationModel = require("../models/Notification-model");
const agendaController = require("./agenda-controller");

const showAllUserNotifications = async (req, res) => {
  try {
    let allUserNotificationsArray = await NotificationModel.find(
      {
        recipient: new mongoose.Types.ObjectId(req.user["_id"]),
      },
      {
        recipient: false,
        relatedTask: false,
        teamAddingRequestInfo: false,
        __v: false,
      }
    ).sort({ updatedAt: -1 });

    return res
      .status(200)
      .json({ status: "SUCCESS", data: allUserNotificationsArray });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const deleteNotification = async (req, res) => {
  let { notificationId } = req.body;
  //validate the value of notificationId
  if (notificationId) notificationId = notificationId.trim();
  if (!notificationId)
    return res
      .status(400)
      .json({ status: "FAIL", message: "notificationId is required!" });

  try {
    //search for the wanted notification
    let wantedNotification = await NotificationModel.findById(notificationId);
    if (!wantedNotification)
      return res
        .status(404)
        .json({ status: "FAIL", message: "This notification doesn't exist!" });

    if (wantedNotification.isInteractive)
      return res
        .status(400)
        .json({
          status: "FAIL",
          message: "can't delete this notification cause it's interactive one.",
        });
    else {
      await NotificationModel.findByIdAndDelete(notificationId);
      return res
        .status(200)
        .json({
          status: "SUCCESS",
          message: "The notification was deleted successfully.",
        });
    }
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};

module.exports = {
  showAllUserNotifications,
  deleteNotification
};
