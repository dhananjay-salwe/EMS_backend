const express = require('express');
const router = express.Router();
const operatorController = require('../controllers/operatorController');

router.get('/all', operatorController.getOperators);
router.post('/add', operatorController.addOperator);
router.put('/:id', operatorController.updateOperator);
router.delete('/:id', operatorController.deleteOperator);

module.exports = router;