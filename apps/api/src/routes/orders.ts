import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireTenant } from '../middleware/auth'
import { getIo } from '../socket/orderEvents'

const router = Router({ mergeParams: true })

// ─── POST /orders — PUBLIC, place order ──────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    restaurantId: z.string().uuid(),
    tableId: z.string().uuid(),
    qrToken: z.string().uuid(),
    customerNote: z.string().max(500).optional(),
    customerId: z.string().uuid().optional(),
    offerId: z.string().uuid().optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          quantity: z.number().int().positive(),
        })
      )
      .min(1),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { restaurantId, tableId, qrToken, customerNote, customerId, offerId, items } = parsed.data

  // 1. Validate table + token + restaurant ownership
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId, qrToken, isActive: true },
  })
  if (!table) {
    res.status(400).json({ error: 'Invalid table or QR token' })
    return
  }

  // 2. Validate restaurant is active
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: restaurantId, isActive: true },
  })
  if (!restaurant) {
    res.status(400).json({ error: 'Restaurant not found or inactive' })
    return
  }

  // 3. Validate all menu items belong to this restaurant and are available
  const menuItemIds = items.map((i) => i.menuItemId)
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId, isAvailable: true },
  })
  if (menuItems.length !== menuItemIds.length) {
    res.status(400).json({ error: 'One or more items are unavailable or not found' })
    return
  }

  // 4. Build order items with price snapshots
  const orderItems = items.map((i: { menuItemId: string; quantity: number }) => {
    const mi = menuItems.find((m: any) => m.id === i.menuItemId)!
    const priceNum = Number(mi.price)
    const subtotal = priceNum * i.quantity
    return {
      menuItemId: mi.id,
      nameSnapshot: mi.name,
      priceSnapshot: mi.price,
      quantity: i.quantity,
      subtotal,
    }
  })
  const totalAmount = orderItems.reduce(
    (s: number, i: { subtotal: number }) => s + i.subtotal,
    0
  )

  // Calculate discounts & loyalty points
  let discountAmount = 0
  let discountCode: string | undefined = undefined
  let pointsToDeduct = 0
  let customerPointsEarned = 0

  if (customerId) {
    const customerObj = await prisma.customer.findFirst({
      where: { id: customerId, restaurantId },
    })
    if (!customerObj) {
      res.status(400).json({ error: 'Customer not found' })
      return
    }

    if (offerId) {
      const offerObj = await prisma.offer.findFirst({
        where: { id: offerId, restaurantId, isActive: true },
      })
      if (!offerObj) {
        res.status(400).json({ error: 'Selected offer is invalid or inactive' })
        return
      }

      if (offerObj.pointsRequired > 0) {
        if (customerObj.loyaltyPoints < offerObj.pointsRequired) {
          res.status(400).json({ error: `Insufficient loyalty points. Requires ${offerObj.pointsRequired} pts.` })
          return
        }
        pointsToDeduct = offerObj.pointsRequired
      }

      discountCode = offerObj.code
      if (offerObj.discountType === 'PERCENTAGE') {
        discountAmount = (totalAmount * Number(offerObj.discountValue)) / 100
      } else {
        discountAmount = Number(offerObj.discountValue)
      }

      if (discountAmount > totalAmount) {
        discountAmount = totalAmount
      }
    }
  }

  const finalAmount = totalAmount - discountAmount

  if (customerId) {
    // 10% cash-back in loyalty points (rounded down)
    customerPointsEarned = Math.floor(finalAmount * 0.1)
  }

  // 5. Create order atomically inside a transaction to update customer points
  const order = await prisma.$transaction(async (tx: any) => {
    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: {
            increment: customerPointsEarned - pointsToDeduct,
          },
        },
      })
    }

    return tx.order.create({
      data: {
        restaurantId,
        tableId: table.id,
        tableNumber: table.tableNumber,
        customerNote,
        totalAmount: finalAmount,
        customerId,
        discountCode,
        discountAmount,
        items: { create: orderItems },
      },
      include: { items: true },
    })
  })

  // 6. Emit real-time event to kitchen
  try {
    const io = getIo()
    io.to(`restaurant:${restaurantId}`).emit('new_order', order)
  } catch {
    // Socket.io not yet initialized (shouldn't happen in prod)
  }

  res.status(201).json(order)
})

// ─── GET /restaurants/:restaurantId/orders — vendor list ─────────
router.get('/restaurant/:restaurantId', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const { status, date, tableNumber } = req.query as {
    status?: string
    date?: string
    tableNumber?: string
  }

  const where: Record<string, unknown> = { restaurantId }

  if (status) {
    const statuses = status.split(',').filter((s) =>
      ['PENDING', 'PREPARING', 'SERVED', 'CANCELLED'].includes(s)
    )
    if (statuses.length === 1) where.status = statuses[0]
    else if (statuses.length > 1) where.status = { in: statuses }
  }

  if (date) {
    const d = new Date(date)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    where.placedAt = { gte: d, lt: next }
  }

  if (tableNumber) {
    where.tableNumber = parseInt(tableNumber)
  }

  try {
    const orders = await prisma.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      include: { items: true },
      take: 100,
    })
    res.json(orders)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load orders' })
  }
})

// ─── PATCH /restaurants/:restaurantId/orders/:id/status ──────────
router.patch('/restaurant/:restaurantId/:id/status', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  const schema = z.object({
    status: z.enum(['PENDING', 'PREPARING', 'SERVED', 'CANCELLED']).optional(),
    isPaid: z.boolean().optional(),
  }).refine(data => data.status !== undefined || data.isPaid !== undefined, {
    message: 'Either status or isPaid must be provided',
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const order = await prisma.order.findFirst({ where: { id, restaurantId } })
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    const updated = await prisma.order.update({
      where: { id },
      data: parsed.data,
      include: { items: true },
    })

    try {
      const io = getIo()
      io.to(`restaurant:${restaurantId}`).emit('order_updated', updated)
    } catch {
      // Socket unavailable — REST still succeeds
    }

    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update order' })
  }
})

export default router

