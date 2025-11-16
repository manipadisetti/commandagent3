const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  password: process.env.REDIS_PASSWORD,
});

redisClient.on('error', (err) => {
  console.warn('⚠️  Redis error (non-critical):', err.message);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis ready');
});

// Connect to Redis (but don't fail if it's unavailable)
redisClient.connect().catch((err) => {
  console.warn('⚠️  Redis unavailable (caching disabled):', err.message);
});

// Helper functions with fallback
async function cacheGet(key) {
  try {
    if (!redisClient.isReady) return null;
    return await redisClient.get(key);
  } catch (error) {
    console.warn('Redis GET error:', error.message);
    return null;
  }
}

async function cacheSet(key, value, expirationSeconds = 3600) {
  try {
    if (!redisClient.isReady) return false;
    await redisClient.setEx(key, expirationSeconds, value);
    return true;
  } catch (error) {
    console.warn('Redis SET error:', error.message);
    return false;
  }
}

async function cacheDel(key) {
  try {
    if (!redisClient.isReady) return false;
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.warn('Redis DEL error:', error.message);
    return false;
  }
}

module.exports = {
  redisClient,
  cacheGet,
  cacheSet,
  cacheDel,
};
