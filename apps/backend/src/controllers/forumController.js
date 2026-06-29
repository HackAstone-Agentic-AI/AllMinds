const pool = require('../config/database');

const getPosts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT fp.*, u.full_name as author_name,
                   (SELECT COUNT(*) FROM forum_comments fc WHERE fc.post_id = fp.id)::int AS comment_count
            FROM forum_posts fp
            JOIN users u ON fp.teacher_id = u.id
            ORDER BY fp.created_at DESC
            LIMIT 20
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
};

const createPost = async (req, res) => {
    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();
    const teacherId = req.user.id;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    if (title.length > 150) return res.status(400).json({ error: 'Title must be 150 characters or fewer' });
    if (content.length > 5000) return res.status(400).json({ error: 'Content must be 5000 characters or fewer' });
    try {
        const result = await pool.query(`
            INSERT INTO forum_posts (teacher_id, title, content)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [teacherId, title, content]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create post' });
    }
};

// Group 5 (TC-COM-004): Get comments for a post
const getComments = async (req, res) => {
    const postId = Number(req.params.postId);
    if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ error: 'Invalid post ID' });
    }
    try {
        const result = await pool.query(`
            SELECT fc.id, fc.post_id, fc.content, fc.created_at, u.full_name as author_name
            FROM forum_comments fc
            JOIN users u ON fc.teacher_id = u.id
            WHERE fc.post_id = $1
            ORDER BY fc.created_at ASC
        `, [postId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
};

// Group 5 (TC-COM-004): Create a comment on a post
const createComment = async (req, res) => {
    const postId = Number(req.params.postId);
    const content = String(req.body.content || '').trim();
    const teacherId = req.user.id;

    if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ error: 'Invalid post ID' });
    }
    if (!content) return res.status(400).json({ error: 'Comment content is required' });
    if (content.length > 2000) return res.status(400).json({ error: 'Comment must be 2000 characters or fewer' });

    try {
        // Verify post exists
        const postCheck = await pool.query('SELECT id FROM forum_posts WHERE id = $1', [postId]);
        if (postCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const result = await pool.query(`
            INSERT INTO forum_comments (post_id, teacher_id, content)
            VALUES ($1, $2, $3)
            RETURNING id, post_id, content, created_at
        `, [postId, teacherId, content]);

        const comment = result.rows[0];

        // Fetch author name
        const userResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [teacherId]);
        comment.author_name = userResult.rows[0]?.full_name || 'Teacher';

        res.status(201).json(comment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create comment' });
    }
};

module.exports = { getPosts, createPost, getComments, createComment };
