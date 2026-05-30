import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { redis } from '../lib/redis'

export interface AuthPayload {
  userId: string
  role: 'SUPER_ADMIN' | 'RESTAURANT_ADMIN'
  restaurantId: string | null
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

// ─── Verify JWT + check revocation list ─────────────────────────
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' })
    return
  }

  const token = header.slice(7)
  try {
    // Check revocation list (populated on logout)
    try {
      const revoked = await redis.get(`revoked:${token}`)
      if (revoked) {
        res.status(401).json({ error: 'Token revoked' })
        return
      }
    } catch {
      // Redis unavailable — skip revocation check
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// ─── Tenant guard — must run AFTER requireAuth ───────────────────
// Checks that the :restaurantId URL param matches the JWT's restaurantId
export const requireTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { restaurantId } = req.params
  const user = req.user!

  // Super-admin can access any tenant
  if (user.role === 'SUPER_ADMIN') {
    next()
    return
  }

  if (user.restaurantId !== restaurantId) {
    res.status(403).json({ error: 'Forbidden: cross-tenant access' })
    return
  }

  next()
}

// ─── Super-admin only guard ──────────────────────────────────────
export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: super-admin only' })
    return
  }
  next()
}
