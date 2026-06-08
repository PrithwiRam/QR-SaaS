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
import vendorRoutes from './routes/vendors'
import analyticsRoutes from './routes/analytics'
import marketingRoutes from './routes/marketing'
import { lastGeneratedQrUrl } from './services/qrService'

const app = express()
const httpServer = http.createServer(app)

const v1 = '/v1'

/* =========================
   CORS CONFIG
========================= */

// ─── Allowed-origin validator ─────────────────────────────────────────────
//
// Vercel assigns a unique hash-based subdomain to every deployment, e.g.:
//   qr-saa-s-gktmbpnyv-harinarayananeks-projects.vercel.app
//   qr-saa-s-web.vercel.app  ← production alias
//
// A static string list breaks on every new deployment.  Instead we use a
// pattern-match so that ALL preview + production URLs for this project are
// accepted, while unrelated Vercel apps are still rejected.
//
// Allowed sources:
//   1. Any *.vercel.app subdomain whose slug starts with "qr-saa-s"
//   2. The exact FRONTEND_URL set in the Railway environment (optional extra)
//   3. http://localhost:3000 (local development)

function isAllowedOrigin(origin: string): boolean {
  // Local dev
  if (origin === 'http://localhost:3000') return true

  // Env-driven override (Railway FRONTEND_URL) – strip trailing slash
  const envUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '')
  if (envUrl && origin === envUrl) return true

  // Any Vercel preview or production URL belonging to this project.
  // Pattern: https://qr-saa-s<anything>.vercel.app
  if (/^https:\/\/qr-saa-s[^.]*\.vercel\.app$/.test(origin)) return true

  return false
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin) return callback(null, true)

    if (isAllowedOrigin(origin)) return callback(null, true)

    // Return null/false — NOT an Error — so Express does NOT route this
    // to the global 500 handler. The browser gets a proper CORS rejection.
    console.warn(`[CORS] Rejected origin: ${origin}`)
    return callback(null, false)
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
app.disable('x-powered-by')

app.use('/public', express.static(path.join(__dirname, '../public')))

// ─── Rate limiting on auth endpoints ────────────────────────────
const rateLimit: any = (() => {
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const max = 20
  const store = new Map<string, { count: number; reset: number }>()
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = (req.ip || 'unknown')
    const now = Date.now()
    let entry = store.get(key)
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + windowMs }
      store.set(key, entry)
    }
    entry.count++
    if (entry.count > max) {
      res.status(429).json({ error: 'Too many requests. Please wait before trying again.' })
      return
    }
    next()
  }
})()

/* =========================
   ROUTES
========================= */

app.use(`${v1}/auth`, rateLimit, authRoutes)
app.use(`${v1}/restaurants`, restaurantRoutes)
app.use(`${v1}/restaurants/:restaurantId`, menuRoutes)
app.use(`${v1}/restaurants/:restaurantId/tables`, tableRoutes)
app.use(`${v1}/restaurants/:restaurantId/customers`, customerRoutes)
app.use(`${v1}/restaurants/:restaurantId/marketing`, marketingRoutes)
app.use(`${v1}/orders`, orderRoutes)
app.use(`${v1}/menu`, publicRoutes)
app.use(`${v1}/vendors`, vendorRoutes)
app.use(`${v1}/analytics`, analyticsRoutes)

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
    env: {
      FRONTEND_URL: process.env.FRONTEND_URL || 'not-set',
      PUBLIC_URL: process.env.PUBLIC_URL || 'not-set',
      SITE_URL: process.env.SITE_URL || 'not-set',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not-set',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'not-set',
    }
  })
})

app.get('/last-qr-url', (_req, res) => {
  res.json({ lastGeneratedQrUrl })
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