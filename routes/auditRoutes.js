const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

router.get('/submissions', auditController.getSubmissions);

module.exports = router;