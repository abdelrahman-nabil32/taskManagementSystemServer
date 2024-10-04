const mongoose = require("mongoose");
const TeamModel = require("../models/Team-model");
const UserModel = require("../models/User-model");
const TaskModel = require("../models/Task-model");
const NotificationModel = require("../models/Notification-model");
const taskController = require("./task-controller");
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

    return res.status(201).json({
      status: "SUCCESS",
      message: "The new Team was created successfully",
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
    let wantedAddRequestNotification =
      await NotificationModel.findByIdAndDelete(addRequestNotificationID);
    if (!wantedAddRequestNotification) {
      return res.status(404).json({
        status: "FAIL",
        message:
          "the add request notification that we want to create a response to does not exist!",
      });
    }
    if (decidedResponse === "confirm") {
      //search for the wanted-to-be-added-to-team user
      let wantedToBeAddedUser = await UserModel.findById(req.user._id);
      if (!wantedToBeAddedUser) {
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
          new Date(teamTasksArray[i].dueDate),
          [wantedToBeAddedUser._id],
          teamTasksArray[i].reminderTimes,
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
    return res.status(200).json({status:"SUCCESS",message:"The Add Request Response was handled successfully"});
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};

module.exports = {
  createNewTeam,
  teamAddRequestSending,
  teamAddRequestResponse
};
