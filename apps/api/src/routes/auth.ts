import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { requireAuth } from '../middleware/auth'

const router = Router()

const ACCESS_EXPIRY = '15m'
const REFRESH_EXPIRY = '30d'
const REFRESH_EXPIRY_SECONDS = 60 * 60 * 24 * 30

// ─── POST /auth/login ────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({
    where: { email },
    include: { restaurant: { select: { slug: true } } },
  })

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)

  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const accessToken = jwt.sign(
    { userId: user.id, role: user.role, restaurantId: user.restaurantId },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_EXPIRY }
  )

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: REFRESH_EXPIRY }
  )

  try {
    await redis.set(`refresh:${user.id}`, refreshToken, 'EX', REFRESH_EXPIRY_SECONDS)
  } catch {
    // Redis unavailable — continue without refresh token storage
  }

  // Update last login timestamp (non-blocking)
  prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {})

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_EXPIRY_SECONDS * 1000,
  })

  res.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      restaurantSlug: user.restaurant?.slug || null,
    },
  })
})

// ─── POST /auth/refresh ──────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken
  if (!token) {
    res.status(401).json({ error: 'No refresh token' })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    // Verify stored token matches
    try {
      const stored = await redis.get(`refresh:${user.id}`)
      if (stored && stored !== token) {
        res.status(401).json({ error: 'Refresh token reused or invalid' })
        return
      }
    } catch {
      // Redis unavailable — skip check
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, restaurantId: user.restaurantId },
      process.env.JWT_SECRET!,
      { expiresIn: ACCESS_EXPIRY }
    )

    res.json({ accessToken })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// ─── POST /auth/logout ───────────────────────────────────────────
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.slice(7)
  if (token) {
    try {
      // Revoke for remaining TTL (~15 min)
      await redis.set(`revoked:${token}`, '1', 'EX', 900)
      await redis.del(`refresh:${req.user!.userId}`)
    } catch {
      // Redis unavailable
    }
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  })
  res.json({ message: 'Logged out' })
})

// ─── GET /auth/me ────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { restaurant: { select: { slug: true } } },
  })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurantId,
    restaurantSlug: user.restaurant?.slug || null,
    createdAt: user.createdAt,
  })
})

export default router
