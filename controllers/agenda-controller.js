const Agenda = require("agenda");
const mongoose = require("mongoose");
const TaskModel = require("../models/Task-model");
const UserModel = require("../models/User-model");
const TeamModel = require("../models/Team-model");
const NotificationModel = require("../models/Notification-model");
require("dotenv").config();
const mongoConnectionString = process.env.MONGO_URL;

//creating an instance of agenda and config it to tell him which db it will store its scheduled jobs and what is the name of the collection which it will store in the database
const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: "scheduledJobs" },
});

// Define agenda job for reminder notifications
agenda.define("send reminder notification", async (job) => {
  const { taskId, recipientId, isTeam } = job.attrs.data;
  try {
    let tempReminderMessage, checkedTask;
    if (isTeam) {
      checkedTask = await TaskModel.findById(taskId).populate("relatedTeam");
      if (!checkedTask) return;
      tempReminderMessage = `Reminder: you have a "${checkedTask.title}" task related to Your "${checkedTask.relatedTeam.name}" team, this task is due in ${checkedTask.reminderTimes} ${checkedTask.reminderUnit}.`;
    } else {
      checkedTask = await TaskModel.findById(taskId);
      if (!checkedTask) return;
      tempReminderMessage = `Reminder: Your "${checkedTask.title}" task is due in ${checkedTask.reminderTimes} ${checkedTask.reminderUnit}.`;
    }
    if (checkedTask && checkedTask.status !== "completed") {
      const newNotification = new NotificationModel({
        recipient: recipientId,
        message: tempReminderMessage,
        type: "informative",
        relatedTask: taskId,
      });
      await newNotification.save();
    }
  } catch (error) {
    console.error(
      `Error executing scheduled "send reminder notification" job of taskID "${taskId}" and userID "${userId}" : ${error.message}`
    );
  }
});

// Define agenda job for deadline notifications
agenda.define("send deadline notification", async (job) => {
  const { taskId, recipientId, isTeam } = job.attrs.data;
  try {
    let tempDeadlineReminderMessage, checkedTask;
    if (isTeam) {
      checkedTask = await TaskModel.findById(taskId).populate("relatedTeam");
      if (!checkedTask) return;
      tempDeadlineReminderMessage = `You have missed the deadline for your "${checkedTask.title}" task which related to your "${checkedTask.relatedTeam.name}" team.`;
    } else {
      checkedTask = await TaskModel.findById(taskId);
      if (!checkedTask) return;
      tempDeadlineReminderMessage = `You have missed the deadline for your "${checkedTask.title}" task.`;
    }
    if (checkedTask && checkedTask.status !== "completed") {
      const newNotification = new NotificationModel({
        recipient: recipientId,
        message: tempDeadlineReminderMessage,
        type: "informative",
        relatedTask: taskId,
      });
      await newNotification.save();
    }
  } catch (error) {
    console.error(
      `Error executing scheduled "send deadline notification" job of taskID "${taskId}" and userID "${userId}" : ${error.message}`
    );
  }
});
//start the agenda instance
agenda.start();

const cancelScheduledJob = async (jobName, taskId, recipientId) => {
  try {
    if (jobName && !taskId && !recipientId)
      await agenda.cancel({ name: jobName });
    else if (!jobName && taskId && !recipientId)
      await agenda.cancel({ "data.taskId": taskId });
    else if (!jobName && !taskId && recipientId)
      await agenda.cancel({ "data.recipientId": recipientId });
    else if (jobName && taskId && !recipientId)
      await agenda.cancel({ name: jobName, "data.taskId": taskId });
    else if (jobName && !taskId && recipientId)
      await agenda.cancel({ name: jobName, "data.recipientId": recipientId });
    else if (!jobName && taskId && recipientId)
      await agenda.cancel({
        "data.taskId": taskId,
        "data.recipientId": recipientId,
      });
    return { status: "SUCCESS" };
  } catch (error) {
    return {
      status: "ERROR",
      message: `Failed to cancel jobs ${
        jobName ? `for job whose name is : ${jobName}` : ""
      }, ${taskId ? `for Task whose ID is : ${taskId}` : ""}, ${
        recipientId ? `for user whose ID is : ${recipientId}` : ""
      } : ${error.message}`,
    };
  }
};

module.exports = {
  agenda,
  cancelScheduledJob,
};
