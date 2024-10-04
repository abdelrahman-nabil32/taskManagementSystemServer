const mongoose = require("mongoose");
const TeamSchema = mongoose.Schema(
  {
    name: {
      type: String,
      require: true,
    },
    description: {
      type: String,
      require: true,
    },
    members: [
      {
        ID: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["admin", "member"],
        },
      },
    ],
  },
  { timestamps: true }
);
let TeamModel = mongoose.model("Team", TeamSchema);
module.exports = TeamModel;
