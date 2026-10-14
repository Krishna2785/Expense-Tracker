// server/routes/insightRoutes.js
// Express router for user financial analytics and insights.

const express = require('express');
const router = express.Router();
const { getInsights } = require('../controllers/insightController');
const { protect } = require('../middleware/authMiddleware');

// All insight endpoints require an authenticated user
router.use(protect);

router.get('/', getInsights);

module.exports = router;
