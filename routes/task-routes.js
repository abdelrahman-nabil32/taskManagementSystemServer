const express = require('express');
const sessionController = require('../controllers/sessionManagement-controller');
const taskController = require('../controllers/task-controller');
const taskRouter = express.Router();

taskRouter.post("/add/newTask",sessionController.accessTokenValidation,taskController.addNewTask);
taskRouter.post("/show/allTasks",sessionController.accessTokenValidation,taskController.showTasks);
taskRouter.delete("/delete/oneTask",sessionController.accessTokenValidation,taskController.deleteTask);
taskRouter.patch("/update/oneTask",sessionController.accessTokenValidation,taskController.updateTask);

module.exports = taskRouter;