const mongoose = require("mongoose");
const TeamModel = require("../models/Team-model");
const UserModel = require("../models/User-model");
const TaskModel = require("../models/Task-model");
const NotificationModel = require("../models/Notification-model");
const taskController = require("./task-controller");
const agendaController = require("./agenda-controller");
const passwordValidator = require("password-validator");
const validator = require("validator");
const bcrypt = require("bcryptjs");

const updateUserProfile = async (req, res) => {
  let { newFullName, newUsername, oldPassword, newPassword } = req.body;
  //preparing the data if it does exist
  if (newFullName) newFullName = newFullName.trim();
  if (newUsername) newUsername = newUsername.trim();
  if (oldPassword) oldPassword = oldPassword.trim();
  if (newPassword) newPassword = newPassword.trim();
  //validation of the sent data
  if (/\s/.test(newUsername)) {
    return res
      .status(400)
      .json({ status: "FAIL", message: "username shouldn't have spaces" });
  }
  if (newPassword && !oldPassword) {
    return res.status(400).json({
      status: "FAIL",
      message:
        "if you want to change your Password , please enter your old one and the new password.",
    });
  }

  try {
    let profileUser = await UserModel.findById(req.user._id);
    if (!profileUser)
      return res
        .status(404)
        .json({ status: "FAIL", message: "This user doesn't exist!" });
    //updating the user profile
    if (newFullName) profileUser.fullName = newFullName;
    if (newUsername) profileUser.username = newUsername;
    if (oldPassword && newPassword) {
      //password checking
      let isMatch = await bcrypt.compare(oldPassword, profileUser.password);
      if (!isMatch) {
        return res
          .status(404)
          .json({ status: "FAIL", message: "your old password isn't vaild." });
      }
      //preparing password schema to follow it
      let passwordschema = new passwordValidator();
      passwordschema
        .is()
        .min(8)
        .is()
        .max(100)
        .has()
        .uppercase()
        .has()
        .lowercase()
        .has()
        .digits(2)
        .has()
        .not()
        .spaces();
      //--------------------------------------
      if (!passwordschema.validate(newPassword)) {
        let temp = passwordschema.validate(newPassword, { details: true });
        temp = temp.map((ele) => ele.message);
        return res.status(400).json({ status: "FAIL", message: temp });
      }
      //hashing the password before storing it in db
      const salt = await bcrypt.genSalt(10);
      let hashedPassword = await bcrypt.hash(newPassword, salt);
      profileUser.password = hashedPassword;
    }
    await profileUser.save();
    return res.status(201).json({
      status: "SUCCESS",
      message: "new Profile updates were handled successfully.",
    });
  } catch (error) {
    return res.status(400).json({ status: "ERROR", message: error.message });
  }
};

module.exports = {
  updateUserProfile,
};
