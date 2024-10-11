const express = require("express");
const cors = require("cors");
const teamRouter = require("./routes/team-routes");
const taskRouter = require("./routes/task-routes");
const notificationRouter = require("./routes/notification-routes");
const sessionRouter = require("./routes/sessionManagement-routes");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// connnecting to database
mongoose
  .connect(process.env.MONGO_URL)
  .then((_) => {
    console.log("connecting to database is successful");
    // server listening
    app.listen(process.env.APP_PORT, (_) => {
      console.log("server is up");
    });
  })
  .catch((error) => {
    console.log("error in database connection : ", error);
  });
// ----------------------------
app.use(cors());
app.use(express.json());
app.use("/team", teamRouter);
app.use("/task", taskRouter);
app.use("/notification", notificationRouter);
app.use("/", sessionRouter);
