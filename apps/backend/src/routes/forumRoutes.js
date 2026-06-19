const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
    getPosts,
    createPost,
} = require('../controllers/forumController');

const router = express.Router();

// Public read – anyone can view posts (no auth needed for GET)
router.get('/', getPosts);

// Creating a post requires authentication
router.post('/', authenticateToken, createPost);

module.exports = router;