const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

router.get('/all', locationController.getAllLocations);
router.post('/add', locationController.addLocationHierarchy);
router.delete('/booth/:id', locationController.deleteBooth);

module.exports = router;