import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireTenant } from '../middleware/auth'
import { generateQrForTable, generateQrBulk } from '../services/qrService'

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

// ─── DELETE /restaurants/:restaurantId/tables/:id — soft delete ──
router.delete('/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  try {
    const table = await prisma.table.findFirst({ where: { id, restaurantId } })
    if (!table) {
      res.status(404).json({ error: 'Table not found' })
      return
    }
    await prisma.table.update({ where: { id }, data: { isActive: false } })
    res.json({ message: 'Table deactivated' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to deactivate table' })
  }
})

export default router
