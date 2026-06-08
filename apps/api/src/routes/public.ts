import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { redis } from '../lib/redis'
import { getIo } from '../socket/orderEvents'

const router = Router()

// ─── GET /menu/lookup/:slug ─────────────────────────────────────
router.get('/lookup/:slug', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, isActive: true },
    })

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }

    res.json(restaurant)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Lookup failed' })
  }
})

// ─── GET /menu/:slug/resolve ────────────────────────────────────
router.get('/:slug/resolve', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params
  const { token } = req.query as { token?: string }

  if (!token) {
    res.status(400).json({ error: 'Missing token parameter' })
    return
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    })

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }

    const table = await prisma.table.findFirst({
      where: { qrToken: token, restaurantId: restaurant.id, isActive: true },
      select: { id: true, tableNumber: true, restaurantId: true },
    })

    if (!table) {
      res.status(404).json({ error: 'Invalid or expired QR code' })
      return
    }

    res.json({
      tableId: table.id,
      tableNumber: table.tableNumber,
      restaurantId: table.restaurantId,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to resolve QR' })
  }
})

// ─── GET /menu/:slug ────────────────────────────────────────────
// Optimized with Redis caching (5 minutes TTL) to prevent DB overload.
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params
  const cacheKey = `menu:slug:${slug}`

  try {
    // Check Redis cache first
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        res.setHeader('Cache-Control', 'public, max-age=60')
        res.json(JSON.parse(cached))
        return
      }
    } catch (err) {
      console.warn('[Redis Cache] error fetching:', err)
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        phone: true,
        themeColor: true,
        menuTheme: true,
      },
    })

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            sortOrder: true,
          },
        },
      },
    })

    const populated = categories.filter(c => c.items.length > 0)
    const payload = { restaurant, categories: populated }

    // Save to Redis cache
    try {
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', 300)
    } catch (err) {
      console.warn('[Redis Cache] error setting:', err)
    }

    res.setHeader('Cache-Control', 'public, max-age=60')
    res.json(payload)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load menu' })
  }
})

// ─── POST /menu/:slug/customers ────────────────────────────────
router.post('/:slug/customers', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params

  const schema = z.object({
    name: z.string().min(1).max(100),
    phone: z.string().min(8).max(15),
    consentMarketing: z.boolean().default(false),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { name, phone, consentMarketing } = parsed.data

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    })

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }

    const existing = await prisma.customer.findUnique({
      where: {
        restaurantId_phone: {
          restaurantId: restaurant.id,
          phone,
        },
      },
    })

    let customer

    if (existing) {
      customer = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name,
          visitCount: { increment: 1 },
          ...(consentMarketing ? { consentMarketing: true } : {}),
        },
      })
    } else {
      customer = await prisma.customer.create({
        data: {
          restaurantId: restaurant.id,
          name,
          phone,
          visitCount: 1,
          loyaltyPoints: 50,
          consentMarketing,
        },
      })
    }

    res.json(customer)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to check in customer' })
  }
})

// ─── GET /menu/:slug/customers/:phone ───────────────────────────
router.get('/:slug/customers/:phone', async (req: Request, res: Response): Promise<void> => {
  const { slug, phone } = req.params

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    })

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }

    const customer = await prisma.customer.findUnique({
      where: {
        restaurantId_phone: {
          restaurantId: restaurant.id,
          phone,
        },
      },
    })

    if (!customer) {
      res.status(404).json({ error: 'Customer not found with this phone number' })
      return
    }

    res.json(customer)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to lookup customer' })
  }
})

// ─── GET /menu/:slug/offers ─────────────────────────────────────
router.get('/:slug/offers', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    })

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }

    const offers = await prisma.offer.findMany({
      where: {
        restaurantId: restaurant.id,
        isActive: true,
      },
      orderBy: { pointsRequired: 'asc' },
    })

    res.json(offers)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch offers' })
  }
})

// ─── GET /menu/:slug/profile/:phone — customer profile ──────────────
router.get('/:slug/profile/:phone', async (req: Request, res: Response): Promise<void> => {
  const { slug, phone } = req.params

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    })
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }

    const customer = await prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId: restaurant.id, phone } },
      include: { claims: { include: { offer: true }, orderBy: { createdAt: 'desc' } } },
    })
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' })
      return
    }

    const orders = await prisma.order.findMany({
      where: { customerId: customer.id, status: { not: 'CANCELLED' } },
      orderBy: { placedAt: 'desc' },
      take: 20,
      include: { items: { select: { nameSnapshot: true, quantity: true, subtotal: true } } },
    })

    const totalSpend = orders.reduce((s: number, o: any) => s + Number(o.totalAmount), 0)

    res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyPoints,
      visitCount: customer.visitCount,
      memberSince: customer.createdAt,
      totalOrders: orders.length,
      totalSpend,
      claims: customer.claims.map((c: any) => ({
        id: c.id,
        status: c.status,
        claimCode: c.claimCode,
        createdAt: c.createdAt,
        offerTitle: c.offer.title,
        pointsRequired: c.offer.pointsRequired,
      })),
      orders: orders.map((o: any) => ({
        id: o.id,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        placedAt: o.placedAt,
        tableNumber: o.tableNumber,
        items: o.items,
      })),
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch profile' })
  }
})

// ─── POST /menu/:slug/claims — generate reward claim request ─────────
router.post('/:slug/claims', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params
  const schema = z.object({
    phone: z.string().min(8).max(15),
    offerId: z.string().uuid(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { phone, offerId } = parsed.data

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    })
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }

    // Load customer
    const customer = await prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId: restaurant.id, phone } },
    })
    if (!customer) {
      res.status(404).json({ error: 'Customer not registered' })
      return
    }

    // Load offer
    const offer = await prisma.offer.findFirst({
      where: { id: offerId, restaurantId: restaurant.id, isActive: true },
    })
    if (!offer) {
      res.status(404).json({ error: 'Offer not found or inactive' })
      return
    }

    // Check points
    if (customer.loyaltyPoints < offer.pointsRequired) {
      res.status(400).json({ error: `Insufficient points. Required: ${offer.pointsRequired}, Available: ${customer.loyaltyPoints}` })
      return
    }

    // Generate unique random claim code (e.g. CLAIM-8492)
    const codeSuffix = Math.floor(1000 + Math.random() * 9000).toString()
    const claimCode = `CLAIM-${codeSuffix}`

    // Deduct points and save claim atomically
    const claim = await prisma.$transaction(async (tx) => {
      // Deduct points
      await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { decrement: offer.pointsRequired } },
      })

      // Create claim
      return tx.rewardClaim.create({
        data: {
          restaurantId: restaurant.id,
          customerId: customer.id,
          offerId: offer.id,
          claimCode,
          status: 'PENDING',
        },
        include: {
          offer: true,
          customer: { select: { name: true, phone: true } },
        },
      })
    })

    // Emit live socket event to notify vendor dashboard/kitchen
    try {
      const io = getIo()
      io.to(`restaurant:${restaurant.id}`).emit('new_claim', claim)
    } catch {}

    res.status(201).json(claim)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to submit reward claim' })
  }
})

export default router
