import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import path from 'path'

import { prisma } from './lib/prisma'
import { connectRedis, redis } from './lib/redis'
import { initSocket } from './socket/orderEvents'

import authRoutes from './routes/auth'
import restaurantRoutes from './routes/restaurants'
import menuRoutes from './routes/menu'
import tableRoutes from './routes/tables'
import orderRoutes from './routes/orders'
import publicRoutes from './routes/public'
import customerRoutes from './routes/customers'

const app = express()
const httpServer = http.createServer(app)

// ─── Middleware ──────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

// Serve static QR images
app.use('/public', express.static(path.join(__dirname, '../public')))

// ─── Routes ─────────────────────────────────────────────────────
const v1 = '/v1'

app.use(`${v1}/auth`, authRoutes)
app.use(`${v1}/restaurants`, restaurantRoutes)

// Menu routes nested under restaurants
app.use(`${v1}/restaurants/:restaurantId`, menuRoutes)

// Table routes nested under restaurants
app.use(`${v1}/restaurants/:restaurantId/tables`, tableRoutes)

// Customer management nested under restaurants
app.use(`${v1}/restaurants/:restaurantId/customers`, customerRoutes)

// Orders — public POST + vendor GET/PATCH
app.use(`${v1}/orders`, orderRoutes)

// Public menu (no auth)
app.use(`${v1}/menu`, publicRoutes)

// ─── Health check ────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  let dbStatus = 'ok'
  let redisStatus = 'ok'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  try {
    await redis.ping()
  } catch {
    redisStatus = 'unavailable'
  }

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    db: dbStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  })
})

// ─── 404 handler ────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ─── Error handler ───────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Startup ─────────────────────────────────────────────────────
async function start() {
  console.log('PORT ENV =', process.env.PORT)

  const PORT = parseInt(process.env.PORT || '4000')
  // Connect Redis (non-blocking — server starts even if Redis is down)
  const redisConnected = await connectRedis()

  // Initialize Socket.io
  initSocket(httpServer, redisConnected)

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 API running at http://localhost:${PORT}`)
    console.log(`📡 Socket.io ready`)
    console.log(`🗄️  DB: connected | Redis: ${redisConnected ? 'connected' : 'unavailable (degraded mode)'}`)
    console.log(`\n📖 Routes:`)
    console.log(`   POST   /v1/auth/login`)
    console.log(`   GET    /v1/restaurants`)
    console.log(`   GET    /v1/menu/:slug`)
    console.log(`   POST   /v1/orders`)
    console.log(`   GET    /health\n`)
  })
}

start().catch(console.error)
