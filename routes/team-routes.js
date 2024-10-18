const express = require('express');
const sessionController = require('../controllers/sessionManagement-controller');
const teamController = require('../controllers/team-controllers');
const teamRouter = express.Router();

teamRouter.post("/add/newTeam",sessionController.accessTokenValidation,teamController.createNewTeam);
teamRouter.post("/send/teamAddRequest",sessionController.accessTokenValidation,teamController.teamAddRequestSending);
teamRouter.post("/response/teamAddRequest",sessionController.accessTokenValidation,teamController.teamAddRequestResponse);
teamRouter.get("/show/allUserTeams",sessionController.accessTokenValidation,teamController.showAllUserTeams);
teamRouter.delete("/delete/oneUser",sessionController.accessTokenValidation,teamController.deleteTeamUser);
teamRouter.delete("/delete/oneTeam",sessionController.accessTokenValidation,teamController.deleteTeam);
teamRouter.get("/SSE",sessionController.accessTokenValidationForSSE,teamController.teamSSE);
module.exports = teamRouter;