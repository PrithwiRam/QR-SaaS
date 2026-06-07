import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireTenant } from '../middleware/auth'
import { generateQrForTable, generateQrForSingleTable, generateQrBulk } from '../services/qrService'

const router = Router({ mergeParams: true })

// ─── GET /restaurants/:restaurantId/tables ───────────────────────
router.get('/', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  try {
    const tables = await prisma.table.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: 'asc' },
    })
    res.json(tables)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load tables' })
  }
})

// ─── POST /restaurants/:restaurantId/tables/single — single table with explicit number ──
router.post('/single', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const schema = z.object({
    tableNumber: z.coerce.number().int().min(1).max(9999),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input — tableNumber must be an integer between 1 and 9999', details: parsed.error.flatten() })
    return
  }

  const { tableNumber } = parsed.data

  // Check if this table number already exists for this restaurant
  const existing = await prisma.table.findFirst({
    where: { restaurantId, tableNumber },
  })
  if (existing) {
    res.status(409).json({ error: `Table ${tableNumber} already exists for this restaurant` })
    return
  }

  try {
    const table = await generateQrForSingleTable(restaurantId, tableNumber)
    res.status(201).json(table)
  } catch (e: any) {
    console.error('[Tables] Create single error:', e)
    res.status(500).json({ error: e.message || 'Failed to create table' })
  }
})

// ─── POST /restaurants/:restaurantId/tables — bulk create ────────
router.post('/', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const schema = z.object({
    count: z.coerce.number().int().min(1).max(100),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input — count must be 1-100', details: parsed.error.flatten() })
    return
  }

  try {
    // Find the current max table number for this restaurant
    const maxTable = await prisma.table.findFirst({
      where: { restaurantId },
      orderBy: { tableNumber: 'desc' },
      select: { tableNumber: true },
    })
    const startNumber = (maxTable?.tableNumber ?? 0) + 1
    const tables = await generateQrBulk(restaurantId, startNumber, parsed.data.count)
    res.status(201).json(tables)
  } catch (e: any) {
    console.error('[Tables] Create error:', e)
    res.status(500).json({ error: e.message || 'Failed to create tables' })
  }
})

// ─── POST /restaurants/:restaurantId/tables/:id/regenerate ───────
router.post('/:id/regenerate', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  try {
    const table = await prisma.table.findFirst({ where: { id, restaurantId } })
    if (!table) {
      res.status(404).json({ error: 'Table not found' })
      return
    }
    const updated = await generateQrForTable(id)
    res.json(updated)
  } catch (e: any) {
    console.error('[Tables] Regenerate error:', e)
    res.status(500).json({ error: e.message || 'Failed to regenerate QR code' })
  }
})

// ─── DELETE /restaurants/:restaurantId/tables/:id — hard delete ──
// Safety: Blocks deletion if the table has active (PENDING or PREPARING) orders.
// Historical completed orders (SERVED/CANCELLED) are cleaned up automatically
// inside a transaction because Order.tableId is a non-nullable FK.
router.delete('/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  try {
    const table = await prisma.table.findFirst({ where: { id, restaurantId } })
    if (!table) {
      res.status(404).json({ error: 'Table not found' })
      return
    }

    // Block deletion if table has any ACTIVE orders still in progress
    const activeOrders = await prisma.order.count({
      where: {
        tableId: id,
        status: { in: ['PENDING', 'PREPARING'] },
      },
    })
    if (activeOrders > 0) {
      res.status(409).json({
        error: `Cannot delete Table ${table.tableNumber} — it has ${activeOrders} active order(s). Mark them as Served or Cancelled first.`,
      })
      return
    }

    // Atomically clean up completed historical orders referencing this table,
    // then delete the table. Order.tableId is non-nullable so we must remove
    // the child rows before the parent row to satisfy the FK constraint.
    await prisma.$transaction(async (tx) => {
      // Find all completed/cancelled orders for this table
      const completedOrders = await tx.order.findMany({
        where: {
          tableId: id,
          status: { in: ['SERVED', 'CANCELLED'] },
        },
        select: { id: true },
      })

      if (completedOrders.length > 0) {
        const completedOrderIds = completedOrders.map((o) => o.id)

        // Delete order line items first (FK: OrderItem.orderId)
        await tx.orderItem.deleteMany({
          where: { orderId: { in: completedOrderIds } },
        })

        // Delete the completed orders themselves
        await tx.order.deleteMany({
          where: { id: { in: completedOrderIds } },
        })
      }

      // Now safe to delete the table
      await tx.table.delete({ where: { id } })
    })

    res.json({ message: `Table ${table.tableNumber} deleted successfully` })
  } catch (e: any) {
    console.error('[Tables] Delete error:', e)
    res.status(500).json({ error: e.message || 'Failed to delete table' })
  }
})

export default router
