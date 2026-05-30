import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireTenant } from '../middleware/auth'
import { getIo } from '../socket/orderEvents'

const router = Router({ mergeParams: true })

// All menu routes are scoped under /restaurants/:restaurantId/

// ─── CATEGORIES ──────────────────────────────────────────────────

// GET /restaurants/:restaurantId/categories
router.get('/categories', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  try {
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: {
        // Vendor sees ALL items (available and hidden) so they can toggle
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
    res.json(categories)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load categories' })
  }
})

// POST /restaurants/:restaurantId/categories
router.post('/categories', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const schema = z.object({
    name: z.string().min(1).max(100),
    sortOrder: z.number().int().default(0),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const category = await prisma.menuCategory.create({
      data: { restaurantId, ...parsed.data },
    })
    res.status(201).json(category)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: `Category "${parsed.data.name}" already exists` })
    } else {
      res.status(500).json({ error: e.message || 'Failed to create category' })
    }
  }
})

// PATCH /restaurants/:restaurantId/categories/:id
router.patch('/categories/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const category = await prisma.menuCategory.update({
    where: { id, restaurantId },
    data: parsed.data,
  })
  res.json(category)
})

// DELETE /restaurants/:restaurantId/categories/:id
router.delete('/categories/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  try {
    const itemCount = await prisma.menuItem.count({ where: { categoryId: id, restaurantId } })
    if (itemCount > 0) {
      res.status(400).json({ error: 'Category has items. Delete or move all items first.' })
      return
    }
    await prisma.menuCategory.delete({ where: { id, restaurantId } })
    res.json({ message: 'Category deleted' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete category' })
  }
})

// ─── MENU ITEMS ──────────────────────────────────────────────────

// GET /restaurants/:restaurantId/items
router.get('/items', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const items = await prisma.menuItem.findMany({
    where: { restaurantId },
    orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    include: { category: { select: { id: true, name: true } } },
  })
  res.json(items)
})

// POST /restaurants/:restaurantId/items
router.post('/items', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const schema = z.object({
    categoryId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().max(500).optional().nullable(),
    price: z.number().positive(),
    imageUrl: z.string().url().optional().or(z.literal('')).nullable(),
    isAvailable: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    // Verify category belongs to this restaurant
    const cat = await prisma.menuCategory.findFirst({
      where: { id: parsed.data.categoryId, restaurantId },
    })
    if (!cat) {
      res.status(400).json({ error: 'Category not found in this restaurant' })
      return
    }

    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        price: parsed.data.price,
        imageUrl: parsed.data.imageUrl || null,
        isAvailable: parsed.data.isAvailable,
        sortOrder: parsed.data.sortOrder,
      },
    })
    res.status(201).json(item)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create item' })
  }
})

// PATCH /restaurants/:restaurantId/items/:id
router.patch('/items/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  const schema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional().nullable(),
    price: z.number().positive().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')).nullable(),
    isAvailable: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    categoryId: z.string().uuid().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const updateData: Record<string, unknown> = { ...parsed.data }
    if ('imageUrl' in updateData && !updateData.imageUrl) updateData.imageUrl = null

    const item = await prisma.menuItem.update({
      where: { id, restaurantId },
      data: updateData,
    })

    try {
      const io = getIo()
      io.to(`restaurant:${restaurantId}`).emit('item_updated', item)
    } catch (e) {
      console.warn('[Socket.io] Failed to emit item_updated:', e)
    }

    res.json(item)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update item' })
  }
})

// DELETE /restaurants/:restaurantId/items/:id
// If the item has order history, soft-delete (hide) instead of hard-delete
router.delete('/items/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  try {
    // Check if item has any order history
    const orderCount = await prisma.orderItem.count({ where: { menuItemId: id } })
    if (orderCount > 0) {
      // Soft delete: hide from menu but preserve history
      const softItem = await prisma.menuItem.update({
        where: { id, restaurantId },
        data: { isAvailable: false },
      })
      try {
        const io = getIo()
        io.to(`restaurant:${restaurantId}`).emit('item_updated', softItem)
      } catch (e) {
        console.warn('[Socket.io] Failed to emit item_updated:', e)
      }
      res.json({ message: 'Item has order history — hidden from menu instead of deleted', softDeleted: true })
      return
    }
    // Hard delete: no order history
    await prisma.menuItem.delete({ where: { id, restaurantId } })
    res.json({ message: 'Item deleted', softDeleted: false })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete item' })
  }
})

export default router
