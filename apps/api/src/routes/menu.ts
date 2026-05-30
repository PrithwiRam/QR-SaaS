import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireTenant } from '../middleware/auth'
import { getIo } from '../socket/orderEvents'

const router = Router({ mergeParams: true })

// Helper: broadcast a full menu refresh signal to all customers in the room
function broadcastMenuChange(restaurantId: string, eventType: string, payload: any) {
  try {
    const io = getIo()
    io.to(`restaurant:${restaurantId}`).emit(eventType, payload)
    io.to(`restaurant:${restaurantId}`).emit('menu_changed', { restaurantId, type: eventType })
  } catch (e) {
    console.warn('[Socket.io] broadcast failed:', e)
  }
}

// ─── CATEGORIES ──────────────────────────────────────────────────

router.get('/categories', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  try {
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    res.json(categories)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load categories' })
  }
})

router.post('/categories', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const schema = z.object({
    name: z.string().min(1).max(100),
    sortOrder: z.number().int().default(0),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  try {
    const category = await prisma.menuCategory.create({ data: { restaurantId, ...parsed.data } })
    broadcastMenuChange(restaurantId, 'category_created', category)
    res.status(201).json(category)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: `Category "${parsed.data.name}" already exists` })
    } else {
      res.status(500).json({ error: e.message || 'Failed to create category' })
    }
  }
})

router.patch('/categories/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const category = await prisma.menuCategory.update({ where: { id, restaurantId }, data: parsed.data })
  broadcastMenuChange(restaurantId, 'category_updated', category)
  res.json(category)
})

router.delete('/categories/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  try {
    const itemCount = await prisma.menuItem.count({ where: { categoryId: id, restaurantId } })
    if (itemCount > 0) { res.status(400).json({ error: 'Category has items. Delete or move all items first.' }); return }
    await prisma.menuCategory.delete({ where: { id, restaurantId } })
    broadcastMenuChange(restaurantId, 'category_deleted', { id })
    res.json({ message: 'Category deleted' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete category' })
  }
})

// ─── MENU ITEMS ──────────────────────────────────────────────────

router.get('/items', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params
  const items = await prisma.menuItem.findMany({
    where: { restaurantId },
    orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    include: { category: { select: { id: true, name: true } } },
  })
  res.json(items)
})

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
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  try {
    const cat = await prisma.menuCategory.findFirst({ where: { id: parsed.data.categoryId, restaurantId } })
    if (!cat) { res.status(400).json({ error: 'Category not found in this restaurant' }); return }

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
      include: { category: { select: { id: true, name: true } } },
    })
    // Broadcast menu_changed so customer pages refetch immediately
    broadcastMenuChange(restaurantId, 'item_created', item)
    res.status(201).json(item)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create item' })
  }
})

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
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  try {
    const updateData: Record<string, unknown> = { ...parsed.data }
    if ('imageUrl' in updateData && !updateData.imageUrl) updateData.imageUrl = null
    const item = await prisma.menuItem.update({
      where: { id, restaurantId },
      data: updateData,
      include: { category: { select: { id: true, name: true } } },
    })
    broadcastMenuChange(restaurantId, 'item_updated', item)
    res.json(item)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update item' })
  }
})

router.delete('/items/:id', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, id } = req.params
  try {
    const orderCount = await prisma.orderItem.count({ where: { menuItemId: id } })
    if (orderCount > 0) {
      const softItem = await prisma.menuItem.update({
        where: { id, restaurantId },
        data: { isAvailable: false },
      })
      broadcastMenuChange(restaurantId, 'item_updated', softItem)
      res.json({ message: 'Item has order history — hidden from menu instead of deleted', softDeleted: true })
      return
    }
    await prisma.menuItem.delete({ where: { id, restaurantId } })
    broadcastMenuChange(restaurantId, 'item_deleted', { id, restaurantId })
    res.json({ message: 'Item deleted', softDeleted: false })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete item' })
  }
})

export default router
