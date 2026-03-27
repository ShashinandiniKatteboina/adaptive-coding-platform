const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  getCollections, 
  createCollection, 
  deleteCollection,
  addItem, 
  shareCollection,
  getNotifications,
  respondToShare
} = require('../controllers/wishlistController');

router.get('/collections', auth, getCollections);
router.post('/collections', auth, createCollection);
router.delete('/collections/:id', auth, deleteCollection);
router.post('/add', auth, addItem);
router.post('/share', auth, shareCollection);
router.get('/notifications', auth, getNotifications);
router.post('/notifications/:id/respond', auth, respondToShare);

module.exports = router;
