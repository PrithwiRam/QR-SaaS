import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { AuthPayload } from '../middleware/auth'
import { prisma } from '../lib/prisma'

let io: Server

export function initSocket(httpServer: import('http').Server, redisConnected: boolean) {
  // Use the same pattern-based validator as the HTTP CORS config so all
  // Vercel preview deployments (qr-saa-s-*.vercel.app) are accepted.
  const envUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '')

  function isSocketOriginAllowed(origin: string): boolean {
    if (origin === 'http://localhost:3000') return true
    if (envUrl && origin === envUrl) return true
    if (/^https:\/\/qr-saa-s[^.]*\.vercel\.app$/.test(origin)) return true
    return false
  }

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || isSocketOriginAllowed(origin)) return callback(null, true)
        return callback(new Error(`Socket origin not allowed: ${origin}`))
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // Conditionally attach Redis adapter
  if (redisConnected) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter')
      const { pubClient, subClient } = require('../lib/redis')
      io.adapter(createAdapter(pubClient, subClient))
      console.log('[Socket.io] Redis adapter attached')
    } catch (e) {
      console.warn('[Socket.io] Redis adapter failed, using in-memory')
    }
  } else {
    console.log('[Socket.io] Using in-memory adapter (single instance)')
  }

  // ─── JWT auth middleware ─────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      // Allow public guest/customer connections without auth
      socket.data.isPublic = true
      return next()
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
      socket.data.user = payload
      socket.data.isPublic = false
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  // ─── Connection handler ──────────────────────────────────────
  io.on('connection', (socket) => {
    const isPublic = socket.data.isPublic
    const user = socket.data.user as AuthPayload | undefined
    const restaurantId = user?.restaurantId

    // Auto-join restaurant room for authenticated vendor users
    if (restaurantId) {
      socket.join(`restaurant:${restaurantId}`)
      console.log(`[Socket.io] Client auto-joined restaurant:${restaurantId}`)
    }

    // Allow explicit room join (used by super-admin browsing or guests/customers)
    socket.on('join-restaurant', ({ restaurantId: rid }: { restaurantId: string }) => {
      if (!rid) return

      // Guests can join any restaurant room; super-admin can join any room; vendor can only join their own
      if (isPublic || user?.role === 'SUPER_ADMIN' || user?.restaurantId === rid) {
        socket.join(`restaurant:${rid}`)
        console.log(`[Socket.io] Client joined restaurant:${rid}`)
        socket.emit('joined', { restaurantId: rid })
      } else {
        socket.emit('error', { message: 'Forbidden: cross-tenant access' })
      }
    })

    // Kitchen: update order status via socket (alternative to REST)
    socket.on('update_status', async ({ orderId, status }) => {
      if (!restaurantId) return

      const validStatuses = ['PENDING', 'PREPARING', 'SERVED', 'CANCELLED']
      if (!validStatuses.includes(status)) return

      const order = await prisma.order.findFirst({
        where: { id: orderId, restaurantId },
      })
      if (!order) return

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status },
        include: { items: true },
      })

      io.to(`restaurant:${restaurantId}`).emit('order_updated', updated)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected`)
    })
  })

  return io
}


export function getIo(): Server {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}
