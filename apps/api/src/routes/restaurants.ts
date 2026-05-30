import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireSuperAdmin } from '../middleware/auth'

const router = Router()

const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only')

// ─── GET /restaurants — paginated list ──────────────────────────
router.get('/', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, orders: true } } },
    }),
    prisma.restaurant.count(),
  ])

  res.json({ restaurants, total, page, limit })
})

// ─── POST /restaurants — create tenant ──────────────────────────
router.post('/', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(2).max(100),
    slug: slugSchema,
    adminEmail: z.string().email(),
    adminPassword: z.string().min(6),
    address: z.string().optional(),
    phone: z.string().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { name, slug, adminEmail, adminPassword, address, phone } = parsed.data

  // Check slug uniqueness
  const existing = await prisma.restaurant.findUnique({ where: { slug } })
  if (existing) {
    res.status(409).json({ error: 'Slug already taken' })
    return
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      slug,
      address,
      phone,
      users: {
        create: {
          email: adminEmail,
          passwordHash,
          role: 'RESTAURANT_ADMIN',
        },
      },
    },
    include: { users: { select: { id: true, email: true, role: true } } },
  })

  res.status(201).json(restaurant)
})

// ─── PATCH /restaurants/:id ──────────────────────────────────────
router.patch('/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(2).max(100).optional(),
    slug: slugSchema.optional(),
    isActive: z.boolean().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: parsed.data,
  })

  res.json(restaurant)
})

// ─── PATCH /restaurants/customize/settings — Customize tenant settings (Vendor or Admin) ───
router.patch('/customize/settings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!
  let { restaurantId } = req.body

  if (user.role !== 'SUPER_ADMIN') {
    restaurantId = user.restaurantId
  }

  if (!restaurantId) {
    res.status(400).json({ error: 'Missing restaurant ID' })
    return
  }

  const schema = z.object({
    name: z.string().min(2).max(100).optional(),
    logoUrl: z.string().optional().nullable(),
    themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
    menuTheme: z.string().min(1).max(20).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const updateData = { ...parsed.data }
    if ('logoUrl' in updateData && !updateData.logoUrl) updateData.logoUrl = null

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: updateData,
    })

    res.json(restaurant)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update customization settings' })
  }
})

export default router
