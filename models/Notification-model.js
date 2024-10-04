const mongoose = require("mongoose");
const NotificationSchema = mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["interactive", "informative"],
      required: true,
    },
    isRead: { type: Boolean, default: false },
    isInteractive: { type: Boolean, default: false },
    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    interactionInfo: {
      possibleActions: {
        type: String,
        default: null,
      },
      tokenAction: {
        type: String,
        default: null,
      },
    },
    teamAddingRequestInfo: {
      requestedRecipientRole: {
        type: String,
        enum: ["admin", "member"],
      },
      senderID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      teamID: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
      pendingSenderNotificationID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Notification",
      },
    },
  },
  { timestamps: true }
);
let NotificationModel = mongoose.model("Notification", NotificationSchema);
module.exports = NotificationModel;
