import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireTenant } from '../middleware/auth'

const router = Router({ mergeParams: true })

// All routes are scoped under /restaurants/:restaurantId

// ─── GET / - List all customers (vendor view) ────────────────────
router.get('/', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const { q } = req.query as { q?: string }

  try {
    const customers = await prisma.customer.findMany({
      where: {
        restaurantId,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } }
          ]
        } : {})
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        orders: {
          select: {
            id: true,
            totalAmount: true,
            status: true
          }
        }
      }
    })

    // Process spend and order count
    const result = customers.map((c: any) => {
      const successfulOrders = c.orders.filter((o: any) => o.status !== 'CANCELLED')

      const totalSpend = successfulOrders.reduce(
        (sum: number, o: any) => sum + Number(o.totalAmount),
        0
      )

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        loyaltyPoints: c.loyaltyPoints,
        visitCount: c.visitCount,
        createdAt: c.createdAt,
        orderCount: successfulOrders.length,
        totalSpend
      }
    })

    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch customers' })
  }
})

// ─── GET /offers - List all offers for vendor ─────────────────────
router.get('/offers', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params

  try {
    const offers = await prisma.offer.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' }
    })
    res.json(offers)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch offers' })
  }
})

// ─── POST /offers - Create new offer ─────────────────────────────
router.post('/offers', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params

  const schema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(300),
    code: z.string().min(1).max(20).transform(val => val.toUpperCase()),
    discountType: z.enum(['PERCENTAGE', 'FLAT']),
    discountValue: z.number().positive(),
    pointsRequired: z.number().nonnegative().default(0),
    isActive: z.boolean().default(true)
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    // Check if offer code already exists for this restaurant
    const existing = await prisma.offer.findFirst({
      where: { restaurantId, code: parsed.data.code }
    })
    if (existing) {
      res.status(400).json({ error: `Offer with code "${parsed.data.code}" already exists` })
      return
    }

    const offer = await prisma.offer.create({
      data: {
        restaurantId,
        ...parsed.data
      }
    })
    res.status(201).json(offer)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create offer' })
  }
})

// ─── PATCH /offers/:offerId - Update offer details ──────────────
router.patch('/offers/:offerId', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, offerId } = req.params

  const schema = z.object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(300).optional(),
    code: z.string().min(1).max(20).transform(val => val.toUpperCase()).optional(),
    discountType: z.enum(['PERCENTAGE', 'FLAT']).optional(),
    discountValue: z.number().positive().optional(),
    pointsRequired: z.number().nonnegative().optional(),
    isActive: z.boolean().optional()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const existing = await prisma.offer.findFirst({
      where: { id: offerId, restaurantId }
    })
    if (!existing) {
      res.status(404).json({ error: 'Offer not found' })
      return
    }

    if (parsed.data.code && parsed.data.code !== existing.code) {
      const codeDuplicate = await prisma.offer.findFirst({
        where: { restaurantId, code: parsed.data.code, NOT: { id: offerId } }
      })
      if (codeDuplicate) {
        res.status(400).json({ error: `Offer with code "${parsed.data.code}" already exists` })
        return
      }
    }

    const offer = await prisma.offer.update({
      where: { id: offerId, restaurantId },
      data: parsed.data
    })
    res.json(offer)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update offer' })
  }
})

// ─── DELETE /offers/:offerId - Delete offer ──────────────────────
router.delete('/offers/:offerId', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, offerId } = req.params

  try {
    const existing = await prisma.offer.findFirst({
      where: { id: offerId, restaurantId }
    })
    if (!existing) {
      res.status(404).json({ error: 'Offer not found' })
      return
    }

    await prisma.offer.delete({
      where: { id: offerId, restaurantId }
    })
    res.json({ message: 'Offer deleted successfully' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete offer' })
  }
})

// ─── PATCH /:customerId/points - Adjust loyalty points manually ────
router.patch('/:customerId/points', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, customerId } = req.params

  const schema = z.object({
    points: z.number().int()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { points } = parsed.data

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, restaurantId }
    })
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' })
      return
    }

    const updated = await prisma.customer.update({
      where: { id: customerId, restaurantId },
      data: {
        loyaltyPoints: {
          increment: points
        }
      }
    })

    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to adjust points' })
  }
})

export default router
