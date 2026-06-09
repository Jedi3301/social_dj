const { Pool } = require("pg");

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Neon cloud connection
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB
      };

const pool = new Pool(poolConfig);

// Initialize all database tables and sync metrics
(async () => {
    try {
        // Ensure pgcrypto extension for gen_random_uuid() is active
        await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

        // Create Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Create Profiles table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS profiles (
                user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                display_name VARCHAR(200),
                profile_picture VARCHAR(500),
                bio TEXT
            )
        `);

        // Create Posts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                content TEXT,
                post_type VARCHAR(10) NOT NULL DEFAULT 'text' CHECK (post_type IN ('text','image','video','mixed')),
                media_urls TEXT[] NOT NULL DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // Create Post Likes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_likes (
                like_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
                user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(post_id, user_id)
            )
        `);

        // Create Comments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS comments (
                comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
                user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                parent_comment_id UUID REFERENCES comments(comment_id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // Create Comment Likes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS comment_likes (
                like_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                comment_id UUID NOT NULL REFERENCES comments(comment_id) ON DELETE CASCADE,
                user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(comment_id, user_id)
            )
        `);

        // Create Hashtag Metrics table
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

        console.log("Database initialized and synchronized successfully.");
    } catch (err) {
        console.error("Error initializing database:", err);
    }
})();

module.exports = pool;