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

const v1 = '/v1'

/* ─────────────────────────────────────────────
   ✅ SAFE CORS CONFIG (PRODUCTION READY)
───────────────────────────────────────────── */

const allowedOrigins = new Set([
  'https://qr-saa-s-web.vercel.app',
  'https://qr-saa-s-gofvc6u5b-harinarayananeks-projects.vercel.app',
  'http://localhost:3000'
])

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // allow server-to-server / postman
    if (!origin) return callback(null, true)

    if (allowedOrigins.has(origin)) {
      return callback(null, origin)
    }

    // IMPORTANT: do NOT throw error (prevents 500 preflight crash)
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))

// IMPORTANT: preflight must use SAME config
app.options('*', cors(corsOptions))

// Helps prevent caching-related CORS bugs
app.use((_req, res, next) => {
  res.header('Vary', 'Origin')
  next()
})

/* ─────────────────────────────────────────────
   Middlewares (ORDER MATTERS)
───────────────────────────────────────────── */

app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

// Static files
app.use('/public', express.static(path.join(__dirname, '../public')))

/* ─────────────────────────────────────────────
   Routes
───────────────────────────────────────────── */

app.use(`${v1}/auth`, authRoutes)
app.use(`${v1}/restaurants`, restaurantRoutes)
app.use(`${v1}/restaurants/:restaurantId`, menuRoutes)
app.use(`${v1}/restaurants/:restaurantId/tables`, tableRoutes)
app.use(`${v1}/restaurants/:restaurantId/customers`, customerRoutes)
app.use(`${v1}/orders`, orderRoutes)
app.use(`${v1}/menu`, publicRoutes)

/* ─────────────────────────────────────────────
   Health check
───────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────
   404 handler
───────────────────────────────────────────── */

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

/* ─────────────────────────────────────────────
   Error handler
───────────────────────────────────────────── */

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

/* ─────────────────────────────────────────────
   Server start
───────────────────────────────────────────── */

async function start() {
  const PORT = parseInt(process.env.PORT || '4000')

  const redisConnected = await connectRedis()
  initSocket(httpServer, redisConnected)

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API running at http://localhost:${PORT}`)
    console.log(`📖 POST /v1/auth/login`)
  })
}

start().catch(console.error)