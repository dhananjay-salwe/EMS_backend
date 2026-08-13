const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/all', adminController.getAdmins);
router.post('/add', adminController.addAdmin);
router.delete('/:id', adminController.deleteAdmin);

module.exports = router;