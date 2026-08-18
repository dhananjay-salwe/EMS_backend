const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

router.get('/all', locationController.getAllLocations);
router.post('/add', locationController.addLocationHierarchy);
router.delete('/booth/:id', locationController.deleteBooth);

// changes for the ward creation and management
router.post('/ward/add', locationController.addWard);
router.delete('/ward/:id', locationController.deleteWard);

module.exports = router;