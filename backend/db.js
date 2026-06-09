const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB
});

// Initialize hashtag_metrics table and sync it with existing posts
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS hashtag_metrics (
                hashtag VARCHAR(100) PRIMARY KEY,
                post_count INT NOT NULL DEFAULT 0
            )
        `);
        // Recalculate metrics from existing posts to ensure it's sync'd
        await pool.query(`
            INSERT INTO hashtag_metrics (hashtag, post_count)
            SELECT hashtag, COUNT(*)
            FROM (
                SELECT unnest(regexp_matches(content, '#[A-Za-z0-9_]+', 'g')) AS hashtag
                FROM posts
                WHERE content IS NOT NULL
            ) t
            GROUP BY hashtag
            ON CONFLICT (hashtag) DO UPDATE SET post_count = EXCLUDED.post_count
        `);
        // Clean up any hashtags that might have been removed or have count = 0
        await pool.query(`
            DELETE FROM hashtag_metrics WHERE post_count = 0;
        `);
        console.log("Hashtag metrics table initialized and synchronized successfully.");
    } catch (err) {
        console.error("Error initializing hashtag metrics:", err);
    }
})();

module.exports = pool;