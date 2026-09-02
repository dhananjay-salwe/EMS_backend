const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/all', adminController.getAdmins);
router.post('/add', adminController.addAdmin);
router.delete('/:id', adminController.deleteAdmin);
router.put('/:id', adminController.editAdmin);
router.get('/lga', adminController.getLgas);

module.exports = router;