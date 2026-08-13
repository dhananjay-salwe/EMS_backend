const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');

router.get('/all', partyController.getParties);
router.post('/add', partyController.addParty);
router.delete('/:id', partyController.deleteParty);

module.exports = router;