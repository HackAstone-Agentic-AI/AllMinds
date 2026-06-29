const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
    getPosts,
    createPost,
    getComments,
    createComment,
} = require('../controllers/forumController');

const router = express.Router();

// Public read – anyone can view posts (no auth needed for GET)
router.get('/', getPosts);

// Creating a post requires authentication
router.post('/', authenticateToken, createPost);

// Comments: GET is public, POST requires auth (Group 5 TC-COM-004)
router.get('/:postId/comments', getComments);
router.post('/:postId/comments', authenticateToken, createComment);

module.exports = router;