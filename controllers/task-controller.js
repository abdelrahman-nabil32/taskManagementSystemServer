const mongoose = require("mongoose");
const schedule = require("node-schedule");
const moment = require("moment-timezone");
const TaskModel = require("../models/Task-model");
const UserModel = require("../models/User-model");
const TeamModel = require("../models/Team-model");
const NotificationModel = require("../models/Notification-model");

const checkIfSpecificTimeIsInFutureByReminderTimes = (
  taskDeadline,
  reminderTimes,
  reminderUnit,
  taskTimeZone
) => {
  reminderTimes = parseInt(reminderTimes);
  let reminderDate = moment.tz(taskDeadline, taskTimeZone);
  switch (reminderUnit) {
    case "minutes":
      reminderDate = reminderDate.subtract(reminderTimes, "minutes");
      break;
    case "hours":
      reminderDate = reminderDate.subtract(reminderTimes, "hours");
      break;
    case "days":
      reminderDate = reminderDate.subtract(reminderTimes, "days");
      break;
    default:
      // Default to one minute before if no valid unit is provided
      reminderDate = reminderDate.subtract(1, "minutes");
  }
  let currentPreparedTime = moment.tz(taskTimeZone);
  return reminderDate.isAfter(currentPreparedTime);
};
const checkIfSpecificTimeIsInFutureByActualTime = (
  checkedTime,
  taskTimeZone
) => {
  let checkedPreparedTime = moment.tz(checkedTime, taskTimeZone);
  let currentPreparedTime = moment.tz(taskTimeZone);
  return checkedPreparedTime.isAfter(currentPreparedTime);
};
const scheduleTaskReminderNotifications = (
  taskId,
  taskDeadline,
  arrayOfUsersIDs = [],
  reminderTimes,
  reminderUnit,
  taskTimeZone,
  isTeam
) => {
  reminderTimes = parseInt(reminderTimes);
  let reminderDate = moment.tz(taskDeadline, taskTimeZone);

  // Calculate the reminder date based on the unit provided by the user
  switch (reminderUnit) {
    case "minutes":
      reminderDate = reminderDate.subtract(reminderTimes, "minutes");
      break;
    case "hours":
      reminderDate = reminderDate.subtract(reminderTimes, "hours");
      break;
    case "days":
      reminderDate = reminderDate.subtract(reminderTimes, "days");
      break;
    default:
      // Default to one minute before if no valid unit is provided
      reminderDate = reminderDate.subtract(1, "minutes");
  }
  for (let i = 0; i < arrayOfUsersIDs.length; ++i) {
    // Schedule reminder notification
    schedule.scheduleJob(reminderDate.toDate(), async () => {
      console.log("reminder time required : "+reminderDate.toDate());
      console.log("reminder time real : "+ moment.tz(taskTimeZone).toDate());
      let tempReminderMessage, checkedTask;
      if (isTeam) {
        checkedTask = await TaskModel.findById(taskId).populate("relatedTeam");
        tempReminderMessage = `Reminder: you have a "${checkedTask.title}" task related to Your "${checkedTask.relatedTeam.name}" team, this task is due in ${reminderTimes} ${reminderUnit}.`;
      } else {
        checkedTask = await TaskModel.findById(taskId);
        tempReminderMessage = `Reminder: Your "${checkedTask.title}" task is due in ${reminderTimes} ${reminderUnit}.`;
      }
      if (checkedTask && checkedTask.status !== "completed") {
        const newNotification = new NotificationModel({
          recipient: arrayOfUsersIDs[i],
          message: tempReminderMessage,
          type: "informative",
          relatedTask: taskId,
        });
        await newNotification.save();
      }
    });

    // Schedule notification for missing deadline if the task is not completed
    schedule.scheduleJob(
      moment.tz(taskDeadline, taskTimeZone).toDate(),
      async () => {
      console.log("deadline "+moment.tz(taskDeadline, taskTimeZone).toDate());
      console.log("deadline real : "+ moment.tz(taskTimeZone).toDate());

        let tempDeadlineReminderMessage, checkedTask;
        if (isTeam) {
          checkedTask = await TaskModel.findById(taskId).populate(
            "relatedTeam"
          );
          tempDeadlineReminderMessage = `You have missed the deadline for your "${checkedTask.title}" task which related to your "${checkedTask.relatedTeam.name}" team.`;
        } else {
          checkedTask = await TaskModel.findById(taskId);
          // correction
          tempDeadlineReminderMessage = `You have missed the deadline for your "${checkedTask.title}" task.`;
        }
        if (checkedTask && checkedTask.status !== "completed") {
          const newNotification = new NotificationModel({
            recipient: arrayOfUsersIDs[i],
            message: tempDeadlineReminderMessage,
            type: "informative",
            relatedTask: taskId,
          });
          await newNotification.save();
        }
      }
    );
  }
};
const addNewTask = async (req, res) => {
  let {
    title,
    description,
    category,
    priority,
    dueDate,
    reminderTimes,
    reminderUnit,
    teamID,
    taskTimeZone,
  } = req.body; // focus on teamID and assigningType
  let { assigningType } = req.query;
  // task info values perpation and validation
  if (
    title &&
    description &&
    category &&
    priority &&
    dueDate &&
    reminderUnit &&
    taskTimeZone
  ) {
    title = title.trim();
    description = description.trim();
    category = category.trim();
    priority = priority.trim();
    dueDate = dueDate.trim();
    reminderUnit = reminderUnit.trim();
    taskTimeZone = taskTimeZone.trim();
  }

  if (
    !title ||
    !description ||
    !category ||
    !priority ||
    !dueDate ||
    !reminderTimes ||
    !reminderUnit ||
    !taskTimeZone
  ) {
    return res.status(400).json({
      status: "FAIL",
      message: "All Task fields shouldn't be empty",
    });
  }
  reminderTimes = parseInt(reminderTimes);
  if (!checkIfSpecificTimeIsInFutureByActualTime(dueDate, taskTimeZone))
    return res.status(400).json({
      status: "FAIL",
      message:
        "The task deadline time is in the past. Please select a future date and time.",
    });

  if (
    !checkIfSpecificTimeIsInFutureByReminderTimes(
      dueDate,
      reminderTimes,
      reminderUnit,
      taskTimeZone
    )
  )
    return res.status(400).json({
      status: "FAIL",
      message:
        "The task reminder time is in the past. Please select a future date and time.",
    });
  // assigning info validation
  if (assigningType) assigningType = assigningType.trim();
  if (teamID) teamID = teamID.trim();
  if (!assigningType || (assigningType !== "user" && assigningType !== "team"))
    return res.status(400).json({
      status: "FAIL",
      message: `Assigning Type Query is required, it is whether "user" or "team"`,
    });
  if (assigningType === "team" && !teamID)
    return res.status(400).json({
      status: "FAIL",
      message: `when assigningType is team , team ID is required`,
    });

  try {
    let readyToBeSendTask;
    if (assigningType === "user") {
      let newTask = new TaskModel({
        title,
        description,
        category,
        priority,
        dueDate,
        relatedUser: new mongoose.Types.ObjectId(req.user["_id"]),
        reminderTimes,
        reminderUnit,
        remindersTimeZone: taskTimeZone,
      });
      let createdTask = await newTask.save();
      readyToBeSendTask = createdTask;
      let createdTaskID = createdTask["_id"];
      //create the notifications related to this new task
      scheduleTaskReminderNotifications(
        createdTaskID,
        dueDate,
        [req.user["_id"]],
        reminderTimes,
        reminderUnit,
        taskTimeZone,
        false
      );
    } else if (assigningType === "team") {
      //searching for the team before assigning the task to it
      const checkedTeam = await TeamModel.findById(teamID);
      if (!checkedTeam)
        return res
          .status(404)
          .json({ status: "FAIL", message: "This team doesn't exist!" });
      //check the authorization of the team member who wants to do this action
      let isAllowedFlag = false;
      checkedTeam.members.forEach((ele) => {
        if (ele.ID == req.user._id && ele.role === "admin")
          isAllowedFlag = true;
      });
      if (!isAllowedFlag) {
        return res.status(400).json({
          status: "FAIL",
          message: "this Action is allowed only for admins!",
        });
      }
      //creating a new Task to assign to the team
      let newTask = new TaskModel({
        title,
        description,
        category,
        priority,
        dueDate,
        relatedTeam: new mongoose.Types.ObjectId(teamID),
        reminderTimes,
        reminderUnit,
        remindersTimeZone: taskTimeZone,
      });
      let createdTask = await newTask.save();
      readyToBeSendTask = createdTask;
      let createdTaskID = createdTask["_id"];
      //create the notifications related to this new task for all team members
      let teamMembersIDsArray = checkedTeam.members.map((ele) => ele.ID);
      scheduleTaskReminderNotifications(
        createdTaskID,
        dueDate,
        teamMembersIDsArray,
        reminderTimes,
        reminderUnit,
        taskTimeZone,
        true
      );
    }
    return res.status(201).json({
      status: "SUCCESS",
      message: "The new Task was created successfully.",
      data:{
        createdTask:readyToBeSendTask
      }
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const showAllUserTasks = async (req, res) => {
  try {
    const AllUserTasksArray = await TaskModel.find(
      {
        relatedUser: new mongoose.Types.ObjectId(req.user["_id"]),
      },
      {
        relatedUser: false,
        relatedTeam: false,
        __v: false,
      }
    );
    return res
      .status(200)
      .json({ status: "SUCCESS", userTasks: AllUserTasksArray });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};

module.exports = {
  addNewTask,
  scheduleTaskReminderNotifications,
  checkIfSpecificTimeIsInFutureByReminderTimes,
  checkIfSpecificTimeIsInFutureByActualTime,
  showAllUserTasks
};

//current time Zone is : Africa/Cairo

// at user case this is
// let tempReminderMessage = `Reminder: Your "${title}" task is due in ${reminderTimes} ${reminderUnit}.`;
//       let tempDeadlineReminderMessage = `You have missed the deadline for your "${title}" task.`;

// at team case this is
// let tempReminderMessage = `Reminder: you have a "${title}" task related to Your "${checkedTeam.name}" team,/n this task is due in ${reminderTimes} ${reminderUnit}.`;
// let tempDeadlineReminderMessage = `You have missed the deadline for your "${title}" task which related to your "${checkedTeam.name}" team.`;
