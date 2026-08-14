const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');

router.get('/all', candidateController.getCandidates);
router.post('/add', candidateController.addCandidate);
router.put('/:id', candidateController.updateCandidate);
router.delete('/:id', candidateController.deleteCandidate);

module.exports = router;