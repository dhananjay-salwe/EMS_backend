const express = require('express');
const router = express.Router();
const multer = require('multer');
const voteController = require('../controllers/voteController');

// Multer memory storage configuration
const upload = multer({ storage: multer.memoryStorage() });

router.get('/dashboard-stats', voteController.getDashboardStats);
router.post('/submit-votes', upload.single('tally_sheet'), voteController.submitVotes);

module.exports = router;