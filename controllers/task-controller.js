const mongoose = require("mongoose");
const schedule = require("node-schedule");
const moment = require("moment-timezone");
const TaskModel = require("../models/Task-model");
const UserModel = require("../models/User-model");
const TeamModel = require("../models/Team-model");
const NotificationModel = require("../models/Notification-model");
const agendaController = require("./agenda-controller");

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
    agendaController.agenda.schedule(
      reminderDate.toDate(),
      "send reminder notification",
      {
        taskId,
        recipientId: arrayOfUsersIDs[i],
        isTeam,
      }
    );
    // Schedule notification for missing deadline if the task is not completed
    agendaController.agenda.schedule(
      moment.tz(taskDeadline, taskTimeZone).toDate(),
      "send deadline notification",
      {
        taskId,
        recipientId: arrayOfUsersIDs[i],
        isTeam,
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

    // readyToBeSendTask
    return res.status(201).json({
      status: "SUCCESS",
      message: "The new Task was created successfully.",
      data: {
        createdTask: {
          _id: readyToBeSendTask._id,
          title: readyToBeSendTask.title,
          description: readyToBeSendTask.description,
          category: readyToBeSendTask.category,
          priority: readyToBeSendTask.priority,
          dueDate: readyToBeSendTask.dueDate,
          status: readyToBeSendTask.status,
          reminderTimes: readyToBeSendTask.reminderTimes,
          reminderUnit: readyToBeSendTask.reminderUnit,
          remindersTimeZone: readyToBeSendTask.remindersTimeZone,
          createdAt: readyToBeSendTask.createdAt,
          updatedAt: readyToBeSendTask.updatedAt,
        },
      },
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const showTasks = async (req, res) => {
  let { teamId } = req.body;
  let { tasksOwner } = req.query;
  //validation of the sent values
  if (tasksOwner) tasksOwner = tasksOwner.trim();
  if (teamId) teamId = teamId.trim();
  if (!tasksOwner)
    return res
      .status(400)
      .json({ status: "FAIL", message: "tasksOwner is required!" });
  if (tasksOwner !== "team" && tasksOwner !== "user")
    return res.status(400).json({
      status: "FAIL",
      message: "tasksOwner query should be only whether 'team' or 'user'.",
    });
  if (tasksOwner === "team" && !teamId)
    return res.status(400).json({
      status: "FAIL",
      message: `when tasksOwner is "team" , team ID is required`,
      id:teamId
    });
  //finding the tasks
  try {
    let AllTasksArray;
    if (tasksOwner === "user") {
      AllTasksArray = await TaskModel.find(
        {
          relatedUser: new mongoose.Types.ObjectId(req.user["_id"]),
        },
        {
          relatedUser: false,
          relatedTeam: false,
          __v: false,
        }
      );
    } else if (tasksOwner === "team") {
      AllTasksArray = await TaskModel.find(
        {
          relatedTeam: new mongoose.Types.ObjectId(teamId),
        },
        {
          relatedUser: false,
          relatedTeam: false,
          __v: false,
        }
      );
    }
    return res.status(200).json({ status: "SUCCESS", allTasks: AllTasksArray });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const deleteTask = async (req, res) => {
  let { taskId, teamId } = req.body;
  let { taskOwner } = req.query;
  //validation of the content of the request
  if (taskId && taskOwner) {
    taskId = taskId.trim();
    taskOwner = taskOwner.trim();
  }
  if (teamId) teamId = teamId.trim();
  if (!taskId || !taskOwner)
    return res.status(400).json({
      status: "FAIL",
      message: "taskId value and taskOwner query are required!",
    });
  if (taskOwner !== "team" && taskOwner !== "user")
    return res.status(400).json({
      status: "FAIL",
      message: "taskOwner query should be only whether 'team' or 'user'.",
    });
  if (taskOwner === "team" && !teamId)
    return res.status(400).json({
      status: "FAIL",
      message: `when taskOwner is "team" , team ID is required`,
    });

  try {
    //check if the task is exitent or not
    let wantedTask = await TaskModel.findById(taskId);
    if (!wantedTask)
      return res.status(404).json({
        status: "FAIL",
        message: "The task wanted to be deleted doesn't already exist!",
      });

    let cancelingTaskScheduledNotificationsResult;
    if (taskOwner === "user") {
      //delete all scheduled notifications related to this task
      cancelingTaskScheduledNotificationsResult =
        await agendaController.cancelScheduledJob(null, taskId, req.user._id);
    } else if (taskOwner === "team") {
      //searching for the team before delete the task from the team
      const checkedTeam = await TeamModel.findById(teamId);
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
      //delete all scheduled notifications related to this team task
      cancelingTaskScheduledNotificationsResult =
        await agendaController.cancelScheduledJob(null, taskId, null);
    }
    //check the return value of the scheduled job cancel function
    if (cancelingTaskScheduledNotificationsResult.status === "ERROR") {
      return res.status(400).json({
        status: "ERROR",
        message: cancelingTaskScheduledNotificationsResult.message,
      });
    }
    //deleting the task itself
    await TaskModel.findByIdAndDelete(taskId);
    return res.status(200).json({
      status: "SUCCESS",
      message: "The wanted task was deleted successfully.",
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const updateTask = async (req, res) => {
  let {
    taskId,
    teamId,
    newTitle,
    newDescription,
    newCategory,
    newPriority,
    newDueDate,
    newStatus,
    newReminderTimes,
    newReminderUnit,
    newRemindersTimeZone,
  } = req.body;
  let { taskOwner } = req.query;
  //validation of client-side sent data
  if (taskId && taskOwner) {
    taskId = taskId.trim();
    taskOwner = taskOwner.trim();
  }
  if (teamId) {
    teamId = teamId.trim();
  }
  if (!taskId || !taskOwner) {
    return res.status(400).json({
      status: "FAIL",
      message: "taskId and taskOwner shouldn't be empty",
    });
  }
  //check if taskOwner is team or user
  if (taskOwner !== "team" && taskOwner !== "user")
    return res.status(400).json({
      status: "FAIL",
      message: "taskOwner query should be only whether 'team' or 'user'.",
    });
  if (taskOwner === "team" && !teamId)
    return res.status(400).json({
      status: "FAIL",
      message: `when taskOwner is "team" , team ID is required`,
    });
  //preparing the new task field which are wanted to be updated
  if (newTitle) newTitle = newTitle.trim;
  if (newDescription) newDescription = newDescription.trim;
  if (newCategory) newCategory = newCategory.trim;
  if (newPriority) newPriority = newPriority.trim;
  if (newDueDate) newDueDate = newDueDate.trim;
  if (newStatus) newStatus = newStatus.trim;
  if (newReminderTimes) newReminderTimes = newReminderTimes.trim;
  if (newReminderTimes) newReminderTimes = parseInt(newReminderTimes);
  if (newReminderUnit) newReminderUnit = newReminderUnit.trim;
  if (newRemindersTimeZone) newRemindersTimeZone = newRemindersTimeZone.trim;

  try {
    let wantedTask = await TaskModel.findById(taskId);
    if (!wantedTask)
      return res.status(404).json({
        status: "FAIL",
        message: "The wanted-to-be-updated task doesn't exist!",
      });

    //updating the task fields
    if (newTitle) wantedTask.title = newTitle;
    if (newDescription) wantedTask.description = newDescription;
    if (newCategory) wantedTask.category = newCategory;
    if (newPriority) wantedTask.priority = newPriority;
    if (newStatus) wantedTask.status = newStatus;

    //handling the updating of the scheduled notifications
    if (
      (newDueDate && newDueDate !== wantedTask.dueDate) ||
      (newReminderTimes && newReminderTimes != wantedTask.reminderTimes) ||
      (newReminderUnit && newReminderUnit !== wantedTask.reminderUnit) ||
      (newRemindersTimeZone &&
        newRemindersTimeZone !== wantedTask.remindersTimeZone)
    ) {
      if (taskOwner === "user") {
        //delete all scheduled notifications related to this task
        let cancelingTaskScheduledNotificationsResult =
          await agendaController.cancelScheduledJob(null, taskId, req.user._id);
        //check the return value of the scheduled job cancel function
        if (cancelingTaskScheduledNotificationsResult.status === "ERROR") {
          return res.status(400).json({
            status: "ERROR",
            message: cancelingTaskScheduledNotificationsResult.message,
          });
        }

        //updating the new data of time in task
        if (newDueDate && newDueDate !== wantedTask.dueDate)
          wantedTask.dueDate = newDueDate;
        if (newReminderTimes && newReminderTimes != wantedTask.reminderTimes)
          wantedTask.reminderTimes = newReminderTimes;
        if (newReminderUnit && newReminderUnit !== wantedTask.reminderUnit)
          wantedTask.reminderUnit = newReminderUnit;
        if (
          newRemindersTimeZone &&
          newRemindersTimeZone !== wantedTask.remindersTimeZone
        )
          wantedTask.remindersTimeZone = newRemindersTimeZone;

        // creating new scheduled notifications
        scheduleTaskReminderNotifications(
          taskId,
          wantedTask.dueDate,
          [req.user["_id"]],
          wantedTask.reminderTimes,
          wantedTask.reminderUnit,
          wantedTask.remindersTimeZone,
          false
        );
      } else if (taskOwner === "team") {
        //searching for the team before assigning the task to it
        const checkedTeam = await TeamModel.findById(teamId);
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
        //delete all scheduled notifications related to this task
        let cancelingTaskScheduledNotificationsResult =
          await agendaController.cancelScheduledJob(null, taskId, null);
        //check the return value of the scheduled job cancel function
        if (cancelingTaskScheduledNotificationsResult.status === "ERROR") {
          return res.status(400).json({
            status: "ERROR",
            message: cancelingTaskScheduledNotificationsResult.message,
          });
        }

        //updating the new data of time in task
        if (newDueDate && newDueDate !== wantedTask.dueDate)
          wantedTask.dueDate = newDueDate;
        if (newReminderTimes && newReminderTimes != wantedTask.reminderTimes)
          wantedTask.reminderTimes = newReminderTimes;
        if (newReminderUnit && newReminderUnit !== wantedTask.reminderUnit)
          wantedTask.reminderUnit = newReminderUnit;
        if (
          newRemindersTimeZone &&
          newRemindersTimeZone !== wantedTask.remindersTimeZone
        )
          wantedTask.remindersTimeZone = newRemindersTimeZone;

        //create the notifications related to this new task for all team members
        let teamMembersIDsArray = checkedTeam.members.map((ele) => ele.ID);
        scheduleTaskReminderNotifications(
          taskId,
          wantedTask.dueDate,
          teamMembersIDsArray,
          wantedTask.reminderTimes,
          wantedTask.reminderUnit,
          wantedTask.remindersTimeZone,
          true
        );
      }
    }
    let savedTask = await wantedTask.save();
    return res.status(201).json({
      status: "SUCCESS",
      message: "The task updating was created successfully.",
      data: {
        updatedTask: {
          _id: savedTask._id,
          title: savedTask.title,
          description: savedTask.description,
          category: savedTask.category,
          priority: savedTask.priority,
          dueDate: savedTask.dueDate,
          status: savedTask.status,
          reminderTimes: savedTask.reminderTimes,
          reminderUnit: savedTask.reminderUnit,
          remindersTimeZone: savedTask.remindersTimeZone,
          createdAt: savedTask.createdAt,
          updatedAt: savedTask.updatedAt,
        },
      },
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};

module.exports = {
  addNewTask,
  scheduleTaskReminderNotifications,
  checkIfSpecificTimeIsInFutureByReminderTimes,
  checkIfSpecificTimeIsInFutureByActualTime,
  showTasks,
  deleteTask,
  updateTask,
};
