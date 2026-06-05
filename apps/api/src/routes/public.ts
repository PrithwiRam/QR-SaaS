import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

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
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params

  try {
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

    // FIXED: explicit type for callback parameter
    const populated = categories.filter(c => c.items.length > 0)

    res.setHeader('Cache-Control', 'public, max-age=60')
    res.json({ restaurant, categories: populated })
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
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { name, phone } = parsed.data

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

export default router
