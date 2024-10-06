const mongoose = require("mongoose");
const TaskSchema = mongoose.Schema(
  {
    title: {
      type: String,
      require: true,
    },
    description: {
      type: String,
      require: true,
    },
    category: {
      type: String,
      enum: [
        "work",
        "personal",
        "study",
        "shopping",
        "fitness",
        "chores",
        "finance",
        "social",
        "travel",
      ],
      default: "personal",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    dueDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["in-progress", "completed"],
      default: "in-progress",
    },
    relatedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    relatedTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    reminderTimes: {
      type: Number,
      default: 1,
    },
    reminderUnit: {
      type: String,
      enum: ["minutes", "hours", "days"],
      default: "minutes",
    },
    remindersTimeZone: {
      type: String,
      require: true,
    },
  },
  { timestamps: true }
);
let TaskModel = mongoose.model("Task", TaskSchema);
module.exports = TaskModel;
