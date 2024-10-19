const express = require("express");
const cors = require("cors");
const teamRouter = require("./routes/team-routes");
const taskRouter = require("./routes/task-routes");
const userRouter = require("./routes/user-routes");
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
//specify the allowed pages to access the backend
const corsOptions = {
  origin: 'https://ibrahimnoureldeen.github.io', // Only allow your frontend domain
  methods: 'GET,POST,PUT,DELETE,PATCH', // Specify the allowed HTTP methods
  credentials:   true, // Allow credentials like cookies or authorization headers
};

app.use(cors(corsOptions));
app.use(express.json());
app.use("/team", teamRouter);
app.use("/task", taskRouter);
app.use("/user", userRouter);
app.use("/notification", notificationRouter);
app.use("/", sessionRouter);
