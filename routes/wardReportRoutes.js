const express = require('express');
const router = express.Router();
const wardReportController = require('../controllers/wardReportController');

router.get('/', wardReportController.getWardReports);
router.get('/candidates', wardReportController.getCandidatesByWard);
router.post('/upsert', wardReportController.upsertWardVotes);

module.exports = router;
