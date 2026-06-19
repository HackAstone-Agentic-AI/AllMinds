const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getCommunications, createCommunication } = require('../controllers/parentCommController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCommunications);
router.post('/', createCommunication);

module.exports = router;