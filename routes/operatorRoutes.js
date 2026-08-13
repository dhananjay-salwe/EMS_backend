const express = require('express');
const router = express.Router();
const operatorController = require('../controllers/operatorController');

router.post('/add', operatorController.addOperator);
router.get('/all', operatorController.getOperators);

module.exports = router;