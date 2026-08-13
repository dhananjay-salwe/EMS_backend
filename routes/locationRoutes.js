const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

router.post('/hierarchy', locationController.addLocationHierarchy);
router.get('/all', locationController.getLocations);

module.exports = router;