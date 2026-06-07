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

/* =========================
   CORS CONFIG
========================= */

const allowedOrigins = [
  'https://qr-saa-s-web.vercel.app',
  'http://localhost:3000',
]

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true)
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error(`Origin not allowed: ${origin}`))
  },

  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

app.use('/public', express.static(path.join(__dirname, '../public')))

/* =========================
   ROUTES
========================= */

app.use(`${v1}/auth`, authRoutes)
app.use(`${v1}/restaurants`, restaurantRoutes)
app.use(`${v1}/restaurants/:restaurantId`, menuRoutes)
app.use(`${v1}/restaurants/:restaurantId/tables`, tableRoutes)
app.use(`${v1}/restaurants/:restaurantId/customers`, customerRoutes)
app.use(`${v1}/orders`, orderRoutes)
app.use(`${v1}/menu`, publicRoutes)

/* =========================
   HEALTH
========================= */

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

/* =========================
   404
========================= */

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

/* =========================
   ERROR HANDLER
========================= */

app.use((
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  console.error('[Error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

/* =========================
   START SERVER
========================= */

async function start() {
  const PORT = parseInt(process.env.PORT || '4000')

  // ─── Startup validation ───────────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL || ''
  if (process.env.NODE_ENV === 'production' && frontendUrl.includes('localhost')) {
    console.warn('⚠️  [CONFIG WARNING] FRONTEND_URL is set to a localhost address in production!')
    console.warn('⚠️  QR codes will encode localhost URLs which will not work for customers.')
    console.warn('⚠️  Set FRONTEND_URL=https://qr-saa-s-web.vercel.app in your Railway environment variables.')
  }
  if (!frontendUrl) {
    console.warn('⚠️  [CONFIG WARNING] FRONTEND_URL is not set. QR codes will fallback to http://localhost:3000.')
    console.warn('⚠️  Set FRONTEND_URL in your environment variables.')
  }

  const redisConnected = await connectRedis()

  initSocket(httpServer, redisConnected)

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API running on port ${PORT}`)
  })
}

start().catch(console.error)