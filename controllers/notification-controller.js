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
      return res.status(400).json({
        status: "FAIL",
        message: "can't delete this notification cause it's interactive one.",
      });
    else {
      await NotificationModel.findByIdAndDelete(notificationId);
      return res.status(200).json({
        status: "SUCCESS",
        message: "The notification was deleted successfully.",
      });
    }
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const notificationSSE = async (req, res) => {
  // Set the headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send an initial message to confirm the connection
  res.write(
    `data: ${JSON.stringify({
      message: "Connected to notification SSE changes",
    })}\n\n`
  );
  //Watch for changes in the Notifications
  const notificationStream = NotificationModel.watch([
    {
      $match: {
        $or: [
          {
            "fullDocument.recipient": new mongoose.Types.ObjectId(req.user._id),
          }, // For new notifications
          { "documentKey._id": { $exists: true } }, // For updates or deletes
        ],
      },
    },
  ]);

  notificationStream.on("error", (error) => {
    // Send the error event to the client
    res.write(
      `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`
    );
  });

  //handling the changes in the collection
  notificationStream.on("change", async (change) => {
    const { operationType, documentKey } = change;
    try {
      if (operationType === "insert") {
        if (
          change.fullDocument.recipient.toString() === req.user._id.toString()
        ) {
          res.write(
            `event: insert\ndata:${JSON.stringify({
              collName: change.ns.coll,
              collData: {
                message: change.fullDocument.message,
                isRead: change.fullDocument.isRead,
                isInteractive: change.fullDocument.isInteractive,
                interactionInfo: change.fullDocument.interactionInfo,
              },
            })}\n\n`
          );
        }
      } else if (operationType === "update") {
        //search for the updated record inside database to check if it's belongs to the logged-in user or not
        let updatedNotification = await NotificationModel.findById(documentKey._id);
        if (
          updatedNotification &&
          updatedNotification.recipient.toString() === req.user._id.toString()
        ) {
          res.write(
            `event: update\ndata: ${JSON.stringify({
              collName: change.ns.coll,
              collData: {
                message: updatedNotification.message,
                isRead: updatedNotification.isRead,
                isInteractive: updatedNotification.isInteractive,
                interactionInfo: updatedNotification.interactionInfo,
              },
            })}\n\n`
          );
        }
      } else if (operationType === "delete") {
        res.write(
          `event: delete\ndata: ${JSON.stringify({
            collName: change.ns.coll,
            collData: documentKey._id,
          })}\n\n`
        );
      }
    } catch (error) {
      console.error(error.message);
      res.write(`event: error\ndata: "${error.message}"\n\n`);
    }
  });

  // Handle client disconnect
  req.on("close", () => {
    notificationStream.close();
    res.end();
  });
};

module.exports = {
  showAllUserNotifications,
  deleteNotification,
  notificationSSE,
};
