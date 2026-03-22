const express = require('express');
const router = express.Router();
const { getProgress, getRecommendations } = require('../controllers/progressController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, getProgress);
router.get('/recommendations', authMiddleware, getRecommendations);

module.exports = router;
