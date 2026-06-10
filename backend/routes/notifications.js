const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../db");

const router = express.Router();

// ─── GET /api/notifications ────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { rows } = await pool.query(
            `SELECT
                n.notification_id, n.notification_type, n.is_read, n.created_at, n.updated_at,
                n.post_id, n.comment_id, n.sender_id,
                u.username AS sender_username,
                pr.display_name AS sender_display_name,
                pr.profile_picture AS sender_profile_picture,
                pr.profile_color AS sender_profile_color,
                p.content AS post_content,
                c.content AS comment_content,
                (SELECT COUNT(*)::int FROM post_likes WHERE post_id = n.post_id AND user_id != n.sender_id) AS other_likes_count,
                EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=u.user_id) AS is_following
            FROM notifications n
            JOIN users u ON n.sender_id = u.user_id
            LEFT JOIN profiles pr ON u.user_id = pr.user_id
            LEFT JOIN posts p ON n.post_id = p.post_id
            LEFT JOIN comments c ON n.comment_id = c.comment_id
            WHERE n.recipient_id = $1
            ORDER BY n.updated_at DESC
            LIMIT 50`,
            [userId]
        );
        res.json({ notifications: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load notifications" });
    }
});

// ─── POST /api/notifications/mark-read ─────────────────────────────────────
router.post("/mark-read", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        await pool.query(
            "UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1",
            [userId]
        );
        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to mark notifications as read" });
    }
});

// ─── GET /api/notifications/unread-count ────────────────────────────────────
router.get("/unread-count", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { rows } = await pool.query(
            "SELECT COUNT(*)::int FROM notifications WHERE recipient_id = $1 AND is_read = FALSE",
            [userId]
        );
        res.json({ count: rows[0].count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch unread count" });
    }
});

module.exports = router;
