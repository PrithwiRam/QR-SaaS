import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import dns from 'dns/promises'
import { z } from 'zod'
import { getIo } from '../socket/orderEvents'
import { prisma } from '../lib/prisma'
import { requireAuth, requireSuperAdmin } from '../middleware/auth'

const router = Router()

const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only')

// ─── Helper: verify email domain via MX records ──────────────────
async function verifyEmailDomain(email: string): Promise<{ valid: boolean; reason?: string }> {
  const domain = email.split('@')[1]
  if (!domain) return { valid: false, reason: 'Invalid email format' }

  try {
    const mxRecords = await dns.resolveMx(domain)
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: `Domain "${domain}" has no mail server configured. Please provide a real email address.` }
    }
    return { valid: true }
  } catch (err: any) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return { valid: false, reason: `Domain "${domain}" does not exist. Please provide a valid email address.` }
    }
    // DNS lookup failed for other reasons — fail open to avoid blocking valid emails
    return { valid: true }
  }
}

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

  // ── Verify the email domain is real (MX record check) ──
  const emailCheck = await verifyEmailDomain(adminEmail)
  if (!emailCheck.valid) {
    res.status(422).json({
      error: 'Email verification failed',
      details: emailCheck.reason || 'The provided email domain could not be verified. Please use a real email address.',
    })
    return
  }

  // Check slug uniqueness
  const existing = await prisma.restaurant.findUnique({ where: { slug } })
  if (existing) {
    res.status(409).json({ error: 'Slug already taken' })
    return
  }

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existingUser) {
    res.status(409).json({ error: 'A user with this email already exists' })
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

// ─── PATCH /restaurants/customize/settings ───────────────────────
// IMPORTANT: Must be registered BEFORE PATCH /:id so Express does not
// match the literal string 'customize' as an :id param (which would
// cause a Prisma crash → 500).
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

    // Broadcast so customer menus update theme in real-time
    try {
      const io = getIo()
      io.to(`restaurant:${restaurantId}`).emit('restaurant_updated', {
        themeColor: restaurant.themeColor,
        menuTheme: restaurant.menuTheme,
        logoUrl: restaurant.logoUrl,
        name: restaurant.name,
      })
    } catch (e) {
      console.warn('[Socket.io] Failed to emit restaurant_updated:', e)
    }

    res.json(restaurant)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update customization settings' })
  }
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

// ─── DELETE /restaurants/:id ─────────────────────────────────────
router.delete('/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.restaurant.delete({ where: { id: req.params.id } })
    res.json({ message: 'Restaurant deleted successfully' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete restaurant' })
  }
})

// ─── GET /restaurants/:restaurantId/staff ─────────────────────────
router.get('/:restaurantId/staff', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const user = req.user!

  if (user.role !== 'SUPER_ADMIN' && user.restaurantId !== restaurantId) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    const staff = await prisma.user.findMany({
      where: { restaurantId, role: 'KITCHEN_STAFF' },
      select: { id: true, email: true, isActive: true, createdAt: true }
    })
    res.json(staff)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list staff' })
  }
})

// ─── POST /restaurants/:restaurantId/staff ────────────────────────
router.post('/:restaurantId/staff', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const user = req.user!

  if (user.role !== 'SUPER_ADMIN' && user.restaurantId !== restaurantId) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists' })
      return
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12)
    const newStaff = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: 'KITCHEN_STAFF',
        restaurantId
      },
      select: { id: true, email: true, isActive: true, createdAt: true }
    })
    res.status(201).json(newStaff)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create staff' })
  }
})

// ─── PATCH /restaurants/:restaurantId/staff/:staffId ──────────────
router.patch('/:restaurantId/staff/:staffId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, staffId } = req.params
  const user = req.user!

  if (user.role !== 'SUPER_ADMIN' && user.restaurantId !== restaurantId) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const schema = z.object({
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const data: any = {}
    if (parsed.data.isActive !== undefined) {
      data.isActive = parsed.data.isActive
    }
    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12)
    }

    const updated = await prisma.user.update({
      where: { id: staffId, restaurantId },
      data,
      select: { id: true, email: true, isActive: true, createdAt: true }
    })
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update staff' })
  }
})

// ─── DELETE /restaurants/:restaurantId/staff/:staffId ─────────────
router.delete('/:restaurantId/staff/:staffId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, staffId } = req.params
  const user = req.user!

  if (user.role !== 'SUPER_ADMIN' && user.restaurantId !== restaurantId) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    await prisma.user.delete({
      where: { id: staffId, restaurantId }
    })
    res.json({ message: 'Staff member deleted' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete staff' })
  }
})

export default router
