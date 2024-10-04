const validator = require("validator");
const mongoose = require("mongoose");
const UserSchema = mongoose.Schema(
  {
    fullName: {
      type: String,
      require: true,
    },
    username: {
      type: String,
      require: true,
      unique: true,
    },
    email: {
      type: String,
      require: true,
      unique: true,
      validate: [
        validator.isEmail,
        "email field must be valid which follows the construction of emails",
      ],
    },
    password: {
      type: String,
      require: true,
    },
    refreshToken: {
      type: String,
    },
    userTeamsArray: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        default: [],
      },
    ],
  },
  { timestamps: true }
);
let UserModel = mongoose.model("User", UserSchema);
module.exports = UserModel;
