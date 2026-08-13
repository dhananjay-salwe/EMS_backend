const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/admin/login', authController.adminLogin);

// ADD THIS LINE: The Mobile App Operator Login
router.post('/login', authController.operatorLogin);

module.exports = router;