const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_HOST;

let redisClient = null;
let redisConfig = null;

if (REDIS_URL) {
    try {
        redisConfig = REDIS_URL;
        redisClient = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null, // Required by BullMQ for blocking commands
        });
        
        redisClient.on("connect", () => {
            console.log("🚀 Redis connected successfully.");
        });
        redisClient.on("error", (err) => {
            console.error("❌ Redis connection error:", err.message);
        });
    } catch (err) {
        console.error("⚠️ Failed to initialize Redis client:", err.message);
        redisClient = null;
    }
} else {
    console.log("ℹ️ No REDIS_URL or REDIS_HOST env var found. Caching & background queues are disabled.");
}

async function invalidateFeedCache() {
    if (redisClient) {
        try {
            const pipeline = redisClient.pipeline();
            for (let p = 1; p <= 5; p++) {
                pipeline.del(`global:feed:page:${p}:limit:20`);
                pipeline.del(`global:feed:page:${p}:limit:15`);
            }
            await pipeline.exec();
            console.log("⚡ Invalidated Redis feed cache pages.");
        } catch (err) {
            console.error("Failed to invalidate feed cache:", err.message);
        }
    }
}

module.exports = {
    redisClient,
    redisConfig,
    isRedisEnabled: () => !!redisClient,
    invalidateFeedCache
};
