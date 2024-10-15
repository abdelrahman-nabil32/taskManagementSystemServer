const mongoose = require("mongoose");
const TeamModel = require("../models/Team-model");
const UserModel = require("../models/User-model");
const TaskModel = require("../models/Task-model");
const NotificationModel = require("../models/Notification-model");
const taskController = require("./task-controller");
const agendaController = require("./agenda-controller");
const validator = require("validator");

const createNewTeam = async (req, res) => {
  let { name, description } = req.body;
  let { _id } = req.user;
  // team name and description validation
  if (name && description) {
    name = name.trim();
    description = description.trim();
  }
  if (!name || !description) {
    return res.status(400).json({
      status: "FAIL",
      message: "Team name and description shouldn't be empty",
    });
  }

  try {
    const newTeam = new TeamModel({
      name,
      description,
      members: [{ ID: new mongoose.Types.ObjectId(_id), role: "admin" }],
    });

    const savedTeam = await newTeam.save();

    const wantedUser = await UserModel.findOne({ _id: _id });
    if (!wantedUser) {
      return res.status(404).json({
        status: "FAIL",
        message: "this user isn't existent to be assigned the new Team",
      });
    }

    wantedUser.userTeamsArray.push(savedTeam["_id"]);
    await wantedUser.save();
    //preparing the members field of the created team before sending it to hide the mongodb _id
    let preparedMembersArray = savedTeam.members.map((ele) => {
      const { ID, role } = ele;
      return { ID, role };
    });
    return res.status(201).json({
      status: "SUCCESS",
      message: "The new Team was created successfully",
      data: {
        createdTeam: {
          _id: savedTeam._id,
          name: savedTeam.name,
          description: savedTeam.description,
          members: preparedMembersArray,
          createdAt: savedTeam.createdAt,
          updatedAt: savedTeam.updatedAt,
        },
      },
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const teamAddRequestSending = async (req, res) => {
  let { recipientEmail, recipientRole, teamID } = req.body;
  // body Content values validation
  if (recipientEmail && recipientRole && teamID) {
    recipientEmail = recipientEmail.trim();
    recipientRole = recipientRole.trim();
    teamID = teamID.trim();
  }

  if (!recipientEmail || !recipientRole || !teamID) {
    return res.status(400).json({
      status: "FAIL",
      message: "recipientEmail, recipientRole and teamID all are required!",
    });
  }
  //check if the emai has the valid form of emails or not
  if (!validator.isEmail(recipientEmail)) {
    return res.status(400).json({
      status: "FAIL",
      message: "This email is not a valid email!",
    });
  }
  try {
    //searching for the sender team
    let checkedTeam = await TeamModel.findById(teamID);
    if (!checkedTeam) {
      return res.status(404).json({
        status: "FAIL",
        message:
          "the Team that is wanted to enroll the recipient to does not exist!",
      });
    }
    //check the authorization of the team member who wants to do this action
    let isAllowedFlag = false;
    checkedTeam.members.forEach((ele) => {
      if (ele.ID == req.user._id && ele.role === "admin") isAllowedFlag = true;
    });
    if (!isAllowedFlag) {
      return res.status(400).json({
        status: "FAIL",
        message: "this Action is allowed only for admins!",
      });
    }
    //searching for the recipient email
    let checkedUser = await UserModel.findOne({ email: recipientEmail });
    if (!checkedUser) {
      return res
        .status(404)
        .json({ status: "FAIL", message: "this email does not exist!" });
    }
    //check if the recipient email is already involved in the team or not
    let isOnTheTeamFlag = false;
    checkedTeam.members.forEach((ele) => {
      if (ele.ID == `${checkedUser["_id"]}`) isOnTheTeamFlag = true;
    });
    if (isOnTheTeamFlag) {
      return res.status(400).json({
        status: "FAIL",
        message: "This User is already one of the team members!",
      });
    }
    //check if you have already sent an add request to this user or not , to prevent it from sending an add request to the same user twice
    let repeatedAddRequest = await NotificationModel.findOne({
      recipient: checkedUser._id,
      isInteractive: true,
      message: `Add Request: "${req.user.fullName}" sent you an add request to "${checkedTeam.name}" team.`,
    });
    if (repeatedAddRequest) {
      return res.status(400).json({
        status: "FAIL",
        message: "you have already sent an add request to this user!",
      });
    }
    //create informative notification for the sender to inform him ,his add request is pending
    let newSenderPendingNotification = new NotificationModel({
      recipient: new mongoose.Types.ObjectId(req.user._id),
      message: `Pending Add Request Response: you sent an add request to "${checkedUser.fullName}" who doesn't response so far.`,
      type: "informative",
    });
    let savedSenderPendingNotification =
      await newSenderPendingNotification.save();
    //create interactive notification for the recipient to get his interaction with this request
    let newRecipientNotification = new NotificationModel({
      recipient: new mongoose.Types.ObjectId(checkedUser["_id"]),
      message: `Add Request: "${req.user.fullName}" sent you an add request to "${checkedTeam.name}" team.`,
      type: "interactive",
      isInteractive: true,
      interactionInfo: {
        possibleActions: "confirm/reject",
      },
      teamAddingRequestInfo: {
        requestedRecipientRole: recipientRole,
        senderID: new mongoose.Types.ObjectId(req.user._id),
        teamID: new mongoose.Types.ObjectId(checkedTeam._id),
        pendingSenderNotificationID: new mongoose.Types.ObjectId(
          savedSenderPendingNotification["_id"]
        ),
      },
    });
    await newRecipientNotification.save();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Add Request was created successfully.",
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const teamAddRequestResponse = async (req, res) => {
  let { addRequestNotificationID, decidedResponse } = req.body;
  // body Content values validation
  if (addRequestNotificationID && decidedResponse) {
    addRequestNotificationID = addRequestNotificationID.trim();
    decidedResponse = decidedResponse.trim();
  }

  if (!addRequestNotificationID || !decidedResponse) {
    return res.status(400).json({
      status: "FAIL",
      message:
        "addRequestNotificationID and decidedResponse both are required!",
    });
  }
  if (decidedResponse !== "confirm" && decidedResponse !== "reject") {
    return res.status(400).json({
      status: "FAIL",
      message: `Decided response should be whether "confirm" or "reject".`,
    });
  }

  try {
    //search for wanted notification
    let wantedAddRequestNotification = await NotificationModel.findById(
      addRequestNotificationID
    );
    if (!wantedAddRequestNotification) {
      return res.status(404).json({
        status: "FAIL",
        message:
          "the add request notification that we want to create a response to does not exist!",
      });
    }
    //check wether the user which will interact with this request response is the wanted one
    if (req.user._id != `${wantedAddRequestNotification.recipient}`) {
      return res.status(400).json({
        status: "FAIL",
        message: "This user isn't allowed to interact with this add request!",
      });
    }
    if (decidedResponse === "confirm") {
      //search for the wanted-to-be-added-to-team user
      let wantedToBeAddedUser = await UserModel.findById(
        wantedAddRequestNotification.recipient
      );
      if (!wantedToBeAddedUser) {
        await NotificationModel.findByIdAndDelete(addRequestNotificationID);
        return res.status(404).json({
          status: "FAIL",
          message:
            "The user who is wanted to be added to the team doesn't exist!",
        });
      }
      //search for the team that sent the add request
      let addedToTeam = await TeamModel.findById(
        wantedAddRequestNotification.teamAddingRequestInfo.teamID
      );
      if (!addedToTeam) {
        await NotificationModel.findByIdAndDelete(addRequestNotificationID);
        return res.status(404).json({
          status: "FAIL",
          message: "The team you want to add the user to doesn't exist!",
        });
      }
      //adding team to the user
      wantedToBeAddedUser.userTeamsArray.push(addedToTeam["_id"]);
      //adding the user to the team
      addedToTeam.members.push({
        ID: new mongoose.Types.ObjectId(wantedToBeAddedUser._id),
        role: wantedAddRequestNotification.teamAddingRequestInfo
          .requestedRecipientRole,
      });
      //search for all the team tasks
      let teamTasksArray = await TaskModel.find({
        relatedTeam: addedToTeam._id,
      });
      //save the updated in user and team
      await wantedToBeAddedUser.save();
      await addedToTeam.save();
      //set all team task schedule for the new user
      for (let i = 0; i < teamTasksArray.length; ++i) {
        taskController.scheduleTaskReminderNotifications(
          teamTasksArray[i]._id,
          teamTasksArray[i].dueDate,
          [wantedToBeAddedUser._id],
          parseInt(teamTasksArray[i].reminderTimes),
          teamTasksArray[i].reminderUnit,
          teamTasksArray[i].remindersTimeZone,
          true
        );
      }
      //search for the (add request sender) pending notification to update it to inform him about the decided action of recipient
      let senderPendingNotification = await NotificationModel.findById(
        wantedAddRequestNotification.teamAddingRequestInfo
          .pendingSenderNotificationID
      );
      if (senderPendingNotification) {
        //if the pending NOtification exists, we will update it to inform the sender about the decided action
        let messageTemp = decidedResponse.split("");
        messageTemp[0] = messageTemp[0].toUpperCase();
        messageTemp = messageTemp.join("");

        senderPendingNotification.message = `${messageTemp}ed Add Request: "${wantedToBeAddedUser.fullName}" ${decidedResponse}ed your add request to "${addedToTeam.name}" team.`;
        senderPendingNotification.type = "informative";
        senderPendingNotification.isRead = false;
        senderPendingNotification.isInteractive = false;
        senderPendingNotification.relatedTask = null;

        await senderPendingNotification.save();
      } else {
        //if the pending notification isn't exist , we will create new one
        let messageTemp = decidedResponse.split("");
        messageTemp[0] = messageTemp[0].toUpperCase();
        messageTemp = messageTemp.join("");

        let newsenderActionInformativeNotification = new NotificationModel({
          recipient: new mongoose.Types.ObjectId(
            wantedAddRequestNotification.teamAddingRequestInfo.senderID
          ),
          message: `${messageTemp}ed Add Request: "${wantedToBeAddedUser.fullName}" ${decidedResponse}ed your add request to "${addedToTeam.name}" team.`,
          type: "informative",
        });
        await newsenderActionInformativeNotification.save();
      }
    } else if (decidedResponse === "reject") {
      //search for the team that sent the add request
      let addedToTeam = await TeamModel.findById(
        wantedAddRequestNotification.teamAddingRequestInfo.teamID
      );
      if (!addedToTeam) {
        await NotificationModel.findByIdAndDelete(addRequestNotificationID);
        return res.status(404).json({
          status: "FAIL",
          message: "The team you want to add the user to doesn't exist!",
        });
      }
      //search for the (add request sender) pending notification to update it to inform him about the decided action of recipient
      let senderPendingNotification = await NotificationModel.findById(
        wantedAddRequestNotification.teamAddingRequestInfo
          .pendingSenderNotificationID
      );
      if (senderPendingNotification) {
        //if the pending NOtification exists, we will update it to inform the sender about the decided action
        let messageTemp = decidedResponse.split("");
        messageTemp[0] = messageTemp[0].toUpperCase();
        messageTemp = messageTemp.join("");

        senderPendingNotification.message = `${messageTemp}ed Add Request: "${req.user.fullName}" ${decidedResponse}ed your add request to "${addedToTeam.name}" team.`;
        senderPendingNotification.type = "informative";
        senderPendingNotification.isRead = false;
        senderPendingNotification.isInteractive = false;
        senderPendingNotification.relatedTask = null;

        await senderPendingNotification.save();
      } else {
        //if the pending notification isn't exist , we will create new one
        let messageTemp = decidedResponse.split("");
        messageTemp[0] = messageTemp[0].toUpperCase();
        messageTemp = messageTemp.join("");

        let newsenderActionInformativeNotification = new NotificationModel({
          recipient: new mongoose.Types.ObjectId(
            wantedAddRequestNotification.teamAddingRequestInfo.senderID
          ),
          message: `${messageTemp}ed Add Request: "${req.user.fullName}" ${decidedResponse}ed your add request to "${addedToTeam.name}" team.`,
          type: "informative",
        });
        await newsenderActionInformativeNotification.save();
      }
    }
    await NotificationModel.findByIdAndDelete(addRequestNotificationID);
    return res.status(200).json({
      status: "SUCCESS",
      message: "The Add Request Response was handled successfully",
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const showAllUserTeams = async (req, res) => {
  try {
    const wantedUser = await UserModel.findById(req.user._id);
    if (!wantedUser) {
      return res
        .status(404)
        .json({ status: "FAIL", message: "This user doesn't exist!" });
    }
    let userTeamsIDsArray = wantedUser.userTeamsArray;

    let readyToBeSentUserTeamsArray = await TeamModel.find({
      _id: { $in: userTeamsIDsArray },
    })
      .populate({
        path: "members.ID",
        model: "User",
        select: "-password -__v -refreshToken -userTeamsArray",
      })
      .select("-__v -members._id");

    return res
      .status(200)
      .json({ status: "SUCCESS", data: readyToBeSentUserTeamsArray });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const deleteTeamUser = async (req, res) => {
  let { teamId, userId } = req.body;
  //validation of sent data
  if (teamId && userId) {
    teamId = teamId.trim();
    userId = userId.trim();
  }
  if (!teamId || !userId) {
    return res
      .status(400)
      .json({ status: "FAIL", message: "teamId and userId are required!" });
  }
  try {
    //searching for the team
    let checkedTeam = await TeamModel.findById(teamId);
    if (!checkedTeam) {
      return res.status(404).json({
        status: "FAIL",
        message: "This team does not exist!",
      });
    }
    //check the authorization of the team member who wants to do this action
    let isAllowedFlag = false;
    checkedTeam.members.forEach((ele) => {
      if (
        (ele.ID == req.user._id && ele.role === "admin") ||
        req.user._id == userId
      )
        isAllowedFlag = true;
    });
    if (!isAllowedFlag) {
      return res.status(400).json({
        status: "FAIL",
        message:
          "this Action is allowed only for admins to delete any team user, or for the user who wants to delete his(her)self!",
      });
    }
    //searching for the wanted-to-be-deleted user
    let wantedUser = await UserModel.findById(userId);
    if (!wantedUser) {
      return res.status(404).json({
        status: "FAIL",
        message: "this user doesn't exist in the entire system!",
      });
    }
    //check if the wanted user is already involved in the team or not
    let isOnTheTeamFlag = false;
    checkedTeam.members.forEach((ele) => {
      if (ele.ID == `${wantedUser["_id"]}`) isOnTheTeamFlag = true;
    });
    if (!isOnTheTeamFlag) {
      return res.status(400).json({
        status: "FAIL",
        message: "This User already isn't one of the team members!",
      });
    }
    //delete the team from the user array
    wantedUser.userTeamsArray = wantedUser.userTeamsArray.filter(
      (ele) => `${ele}` != `${checkedTeam["_id"]}`
    );
    //delete the user form the team
    checkedTeam.members = checkedTeam.members.filter(
      (ele) => `${ele.ID}` != `${wantedUser["_id"]}`
    );
    //saving the changes of user and team
    await wantedUser.save();
    await checkedTeam.save();

    //searching for all team tasks
    let allTeamTasks = await TaskModel.find({
      relatedTeam: checkedTeam["_id"],
    });
    //cancel all team scheduled jobs related to this deleted user
    for (let i = 0; i < allTeamTasks.length; ++i) {
      agendaController.cancelScheduledJob(
        null,
        allTeamTasks[i]._id,
        wantedUser["_id"]
      );
    }
    //if the deleted user was the last member of the team.
    if (checkedTeam.members.length <= 0) {
      //delete all task related to this team
      await TaskModel.deleteMany({ relatedTeam: teamId });
      //delete the empty team
      await TeamModel.findByIdAndDelete(teamId);
    }
    return res.status(200).json({
      status: "SUCCESS",
      message: "The user was deleted from the team successfully.",
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};
const teamSSE = async (req, res) => {
  // Set the headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send an initial message to confirm the connection
  res.write(
    `data: ${JSON.stringify({
      message: "Connected to team SSE changes",
    })}\n\n`
  );

  // Watch for changes in the team
  const teamStream = TeamModel.watch([
    {
      $match: {
        $or: [
          {
            "fullDocument.members": {
              $elemMatch: {
                ID: new mongoose.Types.ObjectId(req.user._id),
              },
            },
          },
          { "documentKey._id": { $exists: true } },
        ],
      },
    },
  ]);
  const teamTasksStream = TaskModel.watch([
    {
      $match: {
        $or: [
          {
            "fullDocument.relatedTeam": { $ne: null },
          },
          { "documentKey._id": { $exists: true } },
        ],
      },
    },
  ]);
  //handling the changes in the collection
  teamStream.on("change", async (change) => {
    const { operationType, documentKey } = change;
    try {
      if (operationType === "insert") {
        let checkedTeam = await TeamModel.findById(change.fullDocument._id)
          .populate({
            path: "members.ID",
            model: "User",
            select: "-password -__v -refreshToken -userTeamsArray",
          })
          .select("-__v -members._id");
        //check if the team does exist and the logged-in user involved in it
        let isTeamMine = false;
        if (checkedTeam) {
          checkedTeam.members.forEach((ele) => {
            if (ele.ID._id.toString() === req.user._id.toString()) {
              isTeamMine = true;
            }
          });
        }
        if (isTeamMine) {
          res.write(
            `data:${JSON.stringify({
              collName: change.ns.coll,
              collData: checkedTeam,
            })}\n\n`
          );
        }
      } else if (operationType === "update") {
        //search for the updated record inside database to check if it's belongs to the logged-in user or not
        let checkedTeam = await TeamModel.findById(documentKey._id)
          .populate({
            path: "members.ID",
            model: "User",
            select: "-password -__v -refreshToken -userTeamsArray",
          })
          .select("-__v -members._id");
        //check if the team does exist and the logged-in user involved in it
        let isTeamMine = false;
        if (checkedTeam) {
          checkedTeam.members.forEach((ele) => {
            if (ele.ID._id.toString() === req.user._id.toString()) {
              isTeamMine = true;
            }
          });
        }
        if (isTeamMine) {
          res.write(
            `data: ${JSON.stringify({
              collName: change.ns.coll,
              collData: checkedTeam,
            })}\n\n`
          );
        }
      } else if (operationType === "delete") {
        res.write(
          `data: ${JSON.stringify({
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
  teamTasksStream.on("change", async (change) => {
    const { operationType, documentKey } = change;
    try {
      if (operationType === "insert") {
        let checkedUser = await UserModel.findById(req.user._id);
        let isTaskRelatedToUserTeam = false;
        if (checkedUser) {
          checkedUser.userTeamsArray.forEach((ele) => {
            if (ele.toString() === change.fullDocument.relatedTeam.toString()) {
              isTaskRelatedToUserTeam = true;
            }
          });
        }
        if (isTaskRelatedToUserTeam) {
          res.write(
            `data:${JSON.stringify({
              collName: change.ns.coll,
              collData: {
                _id: change.fullDocument._id,
                title: change.fullDocument.title,
                description: change.fullDocument.description,
                category: change.fullDocument.category,
                priority: change.fullDocument.priority,
                dueDate: change.fullDocument.dueDate,
                status: change.fullDocument.status,
                reminderTimes: change.fullDocument.reminderTimes,
                reminderUnit: change.fullDocument.reminderUnit,
                remindersTimeZone: change.fullDocument.remindersTimeZone,
                createdAt: change.fullDocument.createdAt,
                updatedAt: change.fullDocument.updatedAt,
              },
            })}\n\n`
          );
        }
      } else if (operationType === "update") {
        let checkedTask = await TaskModel.findById(documentKey._id);
        let checkedUser = await UserModel.findById(req.user._id);

        let isTaskRelatedToUserTeam = false;
        if (checkedUser && checkedTask) {
          checkedUser.userTeamsArray.forEach((ele) => {
            if (ele.toString() === checkedTask.relatedTeam.toString()) {
              isTaskRelatedToUserTeam = true;
            }
          });
        }
        if (isTaskRelatedToUserTeam) {
          res.write(
            `data:${JSON.stringify({
              collName: change.ns.coll,
              collData: {
                _id: checkedTask._id,
                title: checkedTask.title,
                description: checkedTask.description,
                category: checkedTask.category,
                priority: checkedTask.priority,
                dueDate: checkedTask.dueDate,
                status: checkedTask.status,
                reminderTimes: checkedTask.reminderTimes,
                reminderUnit: checkedTask.reminderUnit,
                remindersTimeZone: checkedTask.remindersTimeZone,
                createdAt: checkedTask.createdAt,
                updatedAt: checkedTask.updatedAt,
              },
            })}\n\n`
          );
        }
      } else if (operationType === "delete") {
        res.write(
          `data: ${JSON.stringify({
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
    teamStream.close();
    teamTasksStream.close();
    res.end();
  });
};

module.exports = {
  createNewTeam,
  teamAddRequestSending,
  teamAddRequestResponse,
  showAllUserTeams,
  deleteTeamUser,
  teamSSE,
};
