const pool = require('../config/db');

exports.getCollections = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Query collections owned by user, ACCEPTED shared with user, or public
    const result = await pool.query(
      `SELECT DISTINCT c.id, c.name, c.is_public, c.user_id, u.name as owner_name,
       (SELECT count(*) FROM wishlist_items WHERE collection_id = c.id) as item_count
       FROM wishlist_collections c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN wishlist_shares s ON c.id = s.collection_id
       WHERE c.user_id = $1 
          OR (s.shared_with_user_id = $1 AND s.status = 'accepted')
          OR c.is_public = true
       ORDER BY c.name ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getCollections error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.createCollection = async (req, res) => {
  try {
    const { name, is_public } = req.body;
    const userId = req.user.id;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const result = await pool.query(
      `INSERT INTO wishlist_collections (user_id, name, is_public) 
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, name, is_public || false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('createCollection error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.deleteCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      'DELETE FROM wishlist_collections WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Collection not found or unauthorized' });
    }
    
    res.json({ message: 'Collection deleted successfully' });
  } catch (err) {
    console.error('deleteCollection error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { collection_id, problem_id } = req.body;
    await pool.query(
      `INSERT INTO wishlist_items (collection_id, problem_id) 
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [collection_id, problem_id]
    );
    res.json({ message: 'Item added' });
  } catch (err) {
    console.error('addItem error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.shareCollection = async (req, res) => {
  try {
    const { collection_id, username } = req.body;
    const userResult = await pool.query('SELECT id FROM users WHERE name = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const sharedUserId = userResult.rows[0].id;
    
    // Check if already shared
    const existing = await pool.query(
      'SELECT * FROM wishlist_shares WHERE collection_id = $1 AND shared_with_user_id = $2',
      [collection_id, sharedUserId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Already shared with this user' });
    }

    await pool.query(
      `INSERT INTO wishlist_shares (collection_id, shared_with_user_id, status) 
       VALUES ($1, $2, 'pending')`,
      [collection_id, sharedUserId]
    );
    res.json({ message: 'Collection share invitation sent' });
  } catch (err) {
    console.error('shareCollection error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT s.id as share_id, c.name as collection_name, u.name as sender_name
       FROM wishlist_shares s
       JOIN wishlist_collections c ON s.collection_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE s.shared_with_user_id = $1 AND s.status = 'pending'`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.respondToShare = async (req, res) => {
  try {
    const { id } = req.params; // share_id
    const { action } = req.body; // 'accept' or 'reject'
    const userId = req.user.id;
    
    if (action === 'accept') {
      await pool.query(
        "UPDATE wishlist_shares SET status = 'accepted' WHERE id = $1 AND shared_with_user_id = $2",
        [id, userId]
      );
      res.json({ message: 'Collection accepted' });
    } else {
      await pool.query(
        "DELETE FROM wishlist_shares WHERE id = $1 AND shared_with_user_id = $2",
        [id, userId]
      );
      res.json({ message: 'Collection rejected' });
    }
  } catch (err) {
    console.error('respondToShare error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};
