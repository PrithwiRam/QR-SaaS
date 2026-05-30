import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Primary client
export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  reconnectOnError: () => true,
})

// Pub/sub clients for Socket.io Redis adapter
export const pubClient = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
})

export const subClient = pubClient.duplicate()

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message)
})

redis.on('connect', () => {
  console.log('[Redis] Connected')
})

export async function connectRedis() {
  try {
    await redis.connect()
    await pubClient.connect()
    await subClient.connect()
    return true
  } catch {
    console.warn('[Redis] Could not connect — running without Redis (single-instance mode)')
    return false
  }
}
