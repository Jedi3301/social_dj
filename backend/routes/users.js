const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../db");

const router = express.Router();

// ─── GET /api/users/who-to-follow ─────────────────────────────────────────
router.get("/who-to-follow", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;

        // Get 3 random users that the current user doesn't follow (assuming we don't have a follows table yet, we just get random users excluding self)
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, pr.display_name, pr.profile_picture, pr.bio
             FROM users u
             LEFT JOIN profiles pr ON u.user_id = pr.user_id
             WHERE u.user_id != $1
             ORDER BY RANDOM()
             LIMIT 3`,
            [userId]
        );

        res.json({ users: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load suggestions" });
    }
});

// ─── GET /api/users/profile/:username ─────────────────────────────────────
router.get("/profile/:username", authMiddleware, async (req, res) => {
    try {
        const { username } = req.params;

        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, u.email, pr.display_name, pr.profile_picture, pr.bio
             FROM users u
             LEFT JOIN profiles pr ON u.user_id = pr.user_id
             WHERE LOWER(u.username) = LOWER($1)`,
            [username]
        );

        if (!rows.length) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ profile: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load profile" });
    }
});

// ─── GET /api/users/profile/:username/posts ───────────────────────────────
router.get("/profile/:username/posts", authMiddleware, async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.user_id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const { rows } = await pool.query(
            `SELECT
                p.post_id, p.content, p.post_type, p.media_urls, p.created_at,
                u.user_id, u.username,
                pr.display_name, pr.profile_picture,
                COUNT(DISTINCT pl.like_id)::int  AS like_count,
                COUNT(DISTINCT c.comment_id)::int AS comment_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.post_id AND user_id = $4) AS liked_by_me
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN profiles pr ON u.user_id = pr.user_id
            LEFT JOIN post_likes pl ON p.post_id = pl.post_id
            LEFT JOIN comments c ON p.post_id = c.post_id AND c.parent_comment_id IS NULL
            WHERE LOWER(u.username) = LOWER($1)
            GROUP BY p.post_id, u.user_id, u.username, pr.display_name, pr.profile_picture
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3`,
            [username, limit, offset, currentUserId]
        );

        res.json({ posts: rows, page: Number(page), hasMore: rows.length === Number(limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load user posts" });
    }
});

module.exports = router;
