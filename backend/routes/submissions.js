const express = require('express');
const router = express.Router();
const { submitCode, getUserSubmissions, runCode, getProblemSolutions, syncSolutions } = require('../controllers/submissionController');
const authMiddleware = require('../middleware/auth');

router.post('/run', runCode); // public - no auth required to run code
router.post('/', authMiddleware, submitCode);
router.get('/', authMiddleware, getUserSubmissions);
router.get('/solutions/:problemId', authMiddleware, getProblemSolutions);
router.get('/sync-solutions', syncSolutions);

module.exports = router;