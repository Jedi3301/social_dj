const { Queue, Worker } = require("bullmq");
const { redisConfig, isRedisEnabled } = require("../config/redis");
const pool = require("../db");

let feedQueue = null;
let feedWorker = null;

if (isRedisEnabled()) {
    // 1. Establish BullMQ Queue
    feedQueue = new Queue("feed-jobs", {
        connection: { url: redisConfig }
    });

    // 2. Setup Background Worker
    feedWorker = new Worker(
        "feed-jobs",
        async (job) => {
            const { userId, postId, content } = job.data;
            console.log(`👷 Worker processing background job [${job.id}] for post ${postId}`);

            try {
                if (job.name === "process-post-hashtags") {
                    // Update hashtag metrics in PostgreSQL asynchronously
                    const postContent = content?.trim();
                    const hashtags = postContent ? [...new Set(postContent.match(/#[A-Za-z0-9_]+/g))] : [];
                    
                    if (hashtags.length > 0) {
                        for (const tag of hashtags) {
                            await pool.query(
                                `INSERT INTO hashtag_metrics (hashtag, post_count)
                                 VALUES ($1, 1)
                                 ON CONFLICT (hashtag) DO UPDATE SET post_count = hashtag_metrics.post_count + 1`,
                                [tag]
                            );
                        }
                    }

                    const { invalidateFeedCache } = require("../config/redis");
                    await invalidateFeedCache();
                }
            } catch (err) {
                console.error(`🚨 Background worker failed on job ${job.id}:`, err);
                throw err; // Signal failure to BullMQ for retrying
            }
        },
        {
            connection: { url: redisConfig },
            concurrency: 2 // Handle up to 2 concurrent jobs locally
        }
    );

    feedWorker.on("completed", (job) => {
        console.log(`🎉 Job ${job.id} ("${job.name}") completed successfully.`);
    });

    feedWorker.on("failed", (job, err) => {
        console.error(`🚨 Job ${job.id} ("${job.name}") failed:`, err.message);
    });
}

/**
 * Interface to queue post processing tasks asynchronously.
 * Falls back to inline execution if Redis is not configured.
 */
async function queuePostProcessing(userId, postId, content) {
    if (isRedisEnabled() && feedQueue) {
        try {
            await feedQueue.add(
                "process-post-hashtags",
                { userId, postId, content },
                {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 1000 },
                    removeOnComplete: true,
                    removeOnFail: 50
                }
            );
            console.log(`📥 Job queued for post ${postId} in background.`);
        } catch (queueErr) {
            console.error("⚠️ Failed to queue job, processing inline instead:", queueErr.message);
            await processPostInline(userId, postId, content);
        }
    } else {
        await processPostInline(userId, postId, content);
    }
}

/**
 * Fallback helper to run the processing inline synchronously.
 */
async function processPostInline(userId, postId, content) {
    console.log(`⚡ Running fallback inline processing for post ${postId}`);
    const postContent = content?.trim();
    const hashtags = postContent ? [...new Set(postContent.match(/#[A-Za-z0-9_]+/g))] : [];
    if (hashtags.length > 0) {
        for (const tag of hashtags) {
            await pool.query(
                `INSERT INTO hashtag_metrics (hashtag, post_count)
                 VALUES ($1, 1)
                 ON CONFLICT (hashtag) DO UPDATE SET post_count = hashtag_metrics.post_count + 1`,
                [tag]
            );
        }
    }
}

module.exports = {
    queuePostProcessing
};
