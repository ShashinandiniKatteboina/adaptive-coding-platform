const express = require('express');
const router = express.Router();
const { submitCode, getUserSubmissions } = require('../controllers/submissionController');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, submitCode);
router.get('/', authMiddleware, getUserSubmissions);

module.exports = router;