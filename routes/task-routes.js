const express = require('express');
const sessionController = require('../controllers/sessionManagement-controller');
const taskController = require('../controllers/task-controller');
const taskRouter = express.Router();

taskRouter.post("/add/newTask",sessionController.accessTokenValidation,taskController.addNewTask);
taskRouter.get("/show/allUserTasks",sessionController.accessTokenValidation,taskController.showAllUserTasks);
taskRouter.delete("/delete/oneTask",sessionController.accessTokenValidation,taskController.deleteTask);
taskRouter.patch("/update/oneTask",sessionController.accessTokenValidation,taskController.updateTask);

module.exports = taskRouter;