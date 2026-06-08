import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireSuperAdmin } from '../middleware/auth'

const router = Router()

// ─── GET /vendors — list all RESTAURANT_ADMIN users ─────────────
router.get('/', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const vendors = await prisma.user.findMany({
      where: { role: 'RESTAURANT_ADMIN' },
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            createdAt: true,
            _count: { select: { orders: true, customers: true } },
          },
        },
      },
    })

    const result = vendors.map((v: any) => ({
      id: v.id,
      email: v.email,
      isActive: v.isActive,
      lastLoginAt: v.lastLoginAt,
      createdAt: v.createdAt,
      restaurant: v.restaurant,
    }))

    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch vendors' })
  }
})

// ─── GET /vendors/:id — vendor profile ──────────────────────────
router.get('/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const vendor = await prisma.user.findUnique({
      where: { id: req.params.id, role: 'RESTAURANT_ADMIN' },
      include: {
        restaurant: {
          include: {
            _count: { select: { orders: true, customers: true, menuItems: true, tables: true } },
          },
        },
      },
    })

    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' })
      return
    }

    // Recent orders for activity timeline
    const recentOrders = vendor.restaurant
      ? await prisma.order.findMany({
          where: { restaurantId: vendor.restaurant.id },
          orderBy: { placedAt: 'desc' },
          take: 10,
          select: { id: true, totalAmount: true, status: true, placedAt: true, tableNumber: true },
        })
      : []

    res.json({
      id: vendor.id,
      email: vendor.email,
      isActive: vendor.isActive,
      lastLoginAt: vendor.lastLoginAt,
      createdAt: vendor.createdAt,
      restaurant: vendor.restaurant,
      recentActivity: recentOrders,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch vendor' })
  }
})

// ─── PATCH /vendors/:id — update vendor (isActive, etc.) ────────
router.patch('/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    isActive: z.boolean().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const vendor = await prisma.user.findUnique({ where: { id: req.params.id, role: 'RESTAURANT_ADMIN' } })
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' })
      return
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed.data,
    })

    res.json({ id: updated.id, email: updated.email, isActive: updated.isActive })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update vendor' })
  }
})

// ─── PATCH /vendors/:id/reset-password ──────────────────────────
router.patch('/:id/reset-password', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const vendor = await prisma.user.findUnique({ where: { id: req.params.id, role: 'RESTAURANT_ADMIN' } })
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' })
      return
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
    })

    res.json({ message: 'Password reset successfully' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to reset password' })
  }
})

// ─── DELETE /vendors/:id — permanent delete ──────────────────────
router.delete('/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const vendor = await prisma.user.findUnique({
      where: { id: req.params.id, role: 'RESTAURANT_ADMIN' },
      include: { restaurant: { select: { id: true } } },
    })

    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' })
      return
    }

    // If they're the only user for their restaurant, cascade-delete the restaurant too
    if (vendor.restaurantId) {
      const siblingCount = await prisma.user.count({
        where: { restaurantId: vendor.restaurantId, id: { not: vendor.id } },
      })

      if (siblingCount === 0) {
        // Safe to delete restaurant — all children cascade via Prisma schema
        await prisma.restaurant.delete({ where: { id: vendor.restaurantId } })
        res.json({ message: 'Vendor and associated restaurant deleted permanently' })
        return
      }
    }

    // Otherwise just delete the user
    await prisma.user.delete({ where: { id: req.params.id } })
    res.json({ message: 'Vendor deleted permanently' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete vendor' })
  }
})

export default router
