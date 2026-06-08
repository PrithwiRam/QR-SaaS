import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireSuperAdmin, requireTenant } from '../middleware/auth'

const router = Router()

// ─── Helper: date range helpers ──────────────────────────────────
function startOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}
function endOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return startOfDay(d)
}
function startOfWeek() {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return startOfDay(d)
}
function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// ─── GET /analytics/global — SUPER_ADMIN ────────────────────────
router.get('/global', requireAuth, requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = startOfWeek()
    const monthStart = startOfMonth()
    const thirtyDaysAgo = daysAgo(30)

    const [
      totalStats,
      todayStats,
      weekStats,
      monthStats,
      totalRestaurants,
      totalCustomers,
      topRestaurantsRaw,
    ] = await Promise.all([
      // All-time totals
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
        _count: { id: true },
        _avg: { totalAmount: true },
      }),
      // Today
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' }, placedAt: { gte: todayStart } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // This week
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' }, placedAt: { gte: weekStart } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // This month
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' }, placedAt: { gte: monthStart } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.restaurant.count({ where: { isActive: true } }),
      prisma.customer.count(),
      // Top restaurants by revenue
      prisma.restaurant.findMany({
        take: 10,
        include: {
          _count: { select: { orders: true } },
          orders: {
            where: { status: { not: 'CANCELLED' } },
            select: { totalAmount: true },
          },
        },
      }),
    ])

    const topRestaurants = topRestaurantsRaw
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        isActive: r.isActive,
        revenue: r.orders.reduce((s: number, o: any) => s + Number(o.totalAmount), 0),
        orders: r._count.orders,
      }))
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10)

    // Daily revenue for last 30 days using raw query
    const dailyRevenue = await prisma.$queryRaw<{ date: string; revenue: number; orders: number }[]>`
      SELECT 
        DATE(placed_at) as date,
        COALESCE(SUM(total_amount), 0)::float as revenue,
        COUNT(*)::int as orders
      FROM "Order"
      WHERE status != 'CANCELLED' 
        AND placed_at >= ${thirtyDaysAgo}
      GROUP BY DATE(placed_at)
      ORDER BY date DESC
    `

    res.json({
      totalRevenue: Number(totalStats._sum.totalAmount || 0),
      totalOrders: totalStats._count.id,
      avgOrderValue: Number(totalStats._avg.totalAmount || 0),
      totalRestaurants,
      totalCustomers,
      todayRevenue: Number(todayStats._sum.totalAmount || 0),
      todayOrders: todayStats._count.id,
      weekRevenue: Number(weekStats._sum.totalAmount || 0),
      weekOrders: weekStats._count.id,
      monthRevenue: Number(monthStats._sum.totalAmount || 0),
      monthOrders: monthStats._count.id,
      topRestaurants,
      revenueByDay: dailyRevenue,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch global analytics' })
  }
})

// ─── GET /analytics/restaurant/:restaurantId — vendor analytics ──
router.get('/restaurant/:restaurantId', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params

  try {
    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = startOfWeek()
    const monthStart = startOfMonth()
    const thirtyDaysAgo = daysAgo(30)

    const [totalStats, todayStats, weekStats, monthStats, topItems, recentOrders] = await Promise.all([
      prisma.order.aggregate({
        where: { restaurantId, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
        _count: { id: true },
        _avg: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { restaurantId, status: { not: 'CANCELLED' }, placedAt: { gte: todayStart } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { restaurantId, status: { not: 'CANCELLED' }, placedAt: { gte: weekStart } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { restaurantId, status: { not: 'CANCELLED' }, placedAt: { gte: monthStart } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Top menu items (via order items)
      prisma.orderItem.groupBy({
        by: ['nameSnapshot'],
        where: { order: { restaurantId, status: { not: 'CANCELLED' } } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      // Recent orders (paginated)
      prisma.order.findMany({
        where: { restaurantId, status: { not: 'CANCELLED' } },
        orderBy: { placedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          totalAmount: true,
          status: true,
          isPaid: true,
          tableNumber: true,
          placedAt: true,
          discountAmount: true,
          customer: { select: { name: true, phone: true } },
        },
      }),
    ])

    // Daily revenue for last 30 days
    const dailyRevenue = await prisma.$queryRaw<{ date: string; revenue: number; orders: number }[]>`
      SELECT 
        DATE(placed_at) as date,
        COALESCE(SUM(total_amount), 0)::float as revenue,
        COUNT(*)::int as orders
      FROM "Order"
      WHERE restaurant_id = ${restaurantId}
        AND status != 'CANCELLED'
        AND placed_at >= ${thirtyDaysAgo}
      GROUP BY DATE(placed_at)
      ORDER BY date ASC
    `

    const cancelledOrders = await prisma.order.count({ where: { restaurantId, status: 'CANCELLED' } })
    const totalCustomers = await prisma.customer.count({ where: { restaurantId } })

    res.json({
      totalRevenue: Number(totalStats._sum.totalAmount || 0),
      totalOrders: totalStats._count.id,
      avgOrderValue: Number(totalStats._avg.totalAmount || 0),
      cancelledOrders,
      totalCustomers,
      todayRevenue: Number(todayStats._sum.totalAmount || 0),
      todayOrders: todayStats._count.id,
      weekRevenue: Number(weekStats._sum.totalAmount || 0),
      weekOrders: weekStats._count.id,
      monthRevenue: Number(monthStats._sum.totalAmount || 0),
      monthOrders: monthStats._count.id,
      topItems: topItems.map((i: any) => ({
        name: i.nameSnapshot,
        quantity: i._sum.quantity,
        revenue: Number(i._sum.subtotal || 0),
      })),
      recentOrders,
      revenueByDay: dailyRevenue,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch analytics' })
  }
})

// ─── GET /analytics/export/csv?restaurantId= ─────────────────────
router.get('/export/csv', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, from, to } = req.query as Record<string, string>

  // Access control: non-super-admins can only export their own restaurant
  const user = req.user!
  const targetId = user.role === 'SUPER_ADMIN' ? restaurantId : (user.restaurantId || '')

  if (!targetId) {
    res.status(400).json({ error: 'Missing restaurantId' })
    return
  }

  try {
    const where: any = { restaurantId: targetId }
    if (from) where.placedAt = { ...where.placedAt, gte: new Date(from) }
    if (to) where.placedAt = { ...where.placedAt, lte: new Date(to) }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      include: {
        items: { select: { nameSnapshot: true, quantity: true, subtotal: true, priceSnapshot: true } },
        customer: { select: { name: true, phone: true } },
      },
    })

    const rows = [
      ['Order ID', 'Date', 'Table', 'Status', 'Customer', 'Phone', 'Items', 'Discount', 'Total', 'Paid'],
      ...orders.map((o: any) => [
        o.id,
        new Date(o.placedAt).toLocaleString('en-IN'),
        o.tableNumber,
        o.status,
        o.customer?.name || '',
        o.customer?.phone || '',
        o.items.map((i: any) => `${i.nameSnapshot}×${i.quantity}`).join(' | '),
        Number(o.discountAmount || 0).toFixed(2),
        Number(o.totalAmount).toFixed(2),
        o.isPaid ? 'Yes' : 'No',
      ]),
    ]

    const csv = rows.map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="orders-${targetId.slice(0, 8)}-${Date.now()}.csv"`)
    res.send(csv)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to export' })
  }
})

export default router
