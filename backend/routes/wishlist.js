const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  getCollections, 
  getCollectionItems,
  createCollection, 
  deleteCollection,
  addItem, 
  shareCollection,
  getNotifications,
  respondToShare,
  getCollectionItems,
  removeItem,
  unfollowCollection
} = require('../controllers/wishlistController');

router.get('/collections', auth, getCollections);
router.get('/collections/:id/items', auth, getCollectionItems);
router.post('/collections', auth, createCollection);
router.delete('/collections/:id', auth, deleteCollection);
router.post('/add', auth, addItem);
router.post('/share', auth, shareCollection);
router.get('/notifications', auth, getNotifications);
router.post('/notifications/:id/respond', auth, respondToShare);
router.delete('/remove', auth, removeItem);
router.delete('/unfollow/:id', auth, unfollowCollection);

module.exports = router;
