const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');

router.get('/dashboard-stats', voteController.getDashboardStats);

module.exports = router;