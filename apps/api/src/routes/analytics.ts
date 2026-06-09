import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { requireAuth, requireSuperAdmin, requireTenant } from '../middleware/auth'

const router = Router()

// ─── Cache helpers ────────────────────────────────────────────────
const ANALYTICS_TTL = 120 // 2 min cache for analytics
async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const v = await redis.get(key)
    return v ? (JSON.parse(v) as T) : null
  } catch { return null }
}
async function cacheSet(key: string, value: unknown, ttl = ANALYTICS_TTL) {
  try { await redis.set(key, JSON.stringify(value), 'EX', ttl) } catch {}
}

// ─── Date helpers ─────────────────────────────────────────────────
function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r
}
function startOfWeek() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); return startOfDay(d)
}
function startOfMonth() {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return startOfDay(d)
}

// ─── Build revenue-by-day from Prisma orders ──────────────────────
// We use Prisma's ORM (no raw SQL) to avoid column-name mapping issues.
// Orders are fetched for last 30 days, then grouped in JS by date string.
async function buildDailyRevenue(
  restaurantId: string | null,
  thirtyDaysAgo: Date
): Promise<{ date: string; revenue: number; orders: number }[]> {
  const where: any = {
    status: { not: 'CANCELLED' as const },
    placedAt: { gte: thirtyDaysAgo },
  }
  if (restaurantId) where.restaurantId = restaurantId

  const orders = await prisma.order.findMany({
    where,
    select: { placedAt: true, totalAmount: true },
  })

  // Group by YYYY-MM-DD
  const map: Record<string, { revenue: number; orders: number }> = {}
  for (const o of orders) {
    const date = o.placedAt.toISOString().slice(0, 10)
    if (!map[date]) map[date] = { revenue: 0, orders: 0 }
    map[date].revenue += Number(o.totalAmount)
    map[date].orders += 1
  }

  return Object.entries(map)
    .map(([date, v]) => ({ date, revenue: parseFloat(v.revenue.toFixed(2)), orders: v.orders }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ─── GET /analytics/global — SUPER_ADMIN ────────────────────────
router.get('/global', requireAuth, requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'analytics:global'
  const cached = await cacheGet<any>(cacheKey)
  if (cached) { res.json(cached); return }

  try {
    const now = new Date()
    const thirtyDaysAgo = daysAgo(30)

    const [
      totalStats,
      todayStats,
      weekStats,
      monthStats,
      totalRestaurants,
      totalCustomers,
      topRestaurantsRaw,
      dailyRevenue,
      adsSum,
      postersDeliveredCount,
      campaignsSentCount,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
        _count: { id: true },
        _avg: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' }, placedAt: { gte: startOfDay(now) } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' }, placedAt: { gte: startOfWeek() } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' }, placedAt: { gte: startOfMonth() } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.restaurant.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.restaurant.findMany({
        take: 20,
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          _count: { select: { orders: true } },
          orders: {
            where: { status: { not: 'CANCELLED' } },
            select: { totalAmount: true },
          },
        },
      }),
      buildDailyRevenue(null, thirtyDaysAgo),
      prisma.adCampaignRequest.aggregate({
        where: { status: { in: ['APPROVED', 'COMPLETED'] } },
        _sum: { budget: true }
      }),
      prisma.posterDesignRequest.count({ where: { status: 'DELIVERED' } }),
      prisma.marketingCampaign.count({ where: { status: 'SENT' } }),
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

    const adsRevenue = Number(adsSum._sum.budget || 0) * 0.10
    const postersRevenue = postersDeliveredCount * 1500
    const campaignsRevenue = campaignsSentCount * 49
    const marketingRevenue = adsRevenue + postersRevenue + campaignsRevenue

    const payload = {
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
      marketingRevenue,
    }

    await cacheSet(cacheKey, payload)
    res.json(payload)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch global analytics' })
  }
})

// ─── GET /analytics/restaurant/:restaurantId — vendor analytics ──
router.get('/restaurant/:restaurantId', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  if (req.user?.role === 'KITCHEN_STAFF') {
    res.status(403).json({ error: 'Forbidden: Kitchen staff cannot access analytics' })
    return
  }
  const { restaurantId } = req.params
  const cacheKey = `analytics:restaurant:${restaurantId}`
  const cached = await cacheGet<any>(cacheKey)
  if (cached) { res.json(cached); return }

  try {
    const now = new Date()
    const thirtyDaysAgo = daysAgo(30)

    const [
      totalStats,
      todayStats,
      weekStats,
      monthStats,
      topItems,
      recentOrders,
      cancelledOrders,
      totalCustomers,
      dailyRevenue,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { restaurantId, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
        _count: { id: true },
        _avg: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { restaurantId, status: { not: 'CANCELLED' }, placedAt: { gte: startOfDay(now) } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { restaurantId, status: { not: 'CANCELLED' }, placedAt: { gte: startOfWeek() } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { restaurantId, status: { not: 'CANCELLED' }, placedAt: { gte: startOfMonth() } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Top menu items by quantity sold
      prisma.orderItem.groupBy({
        by: ['nameSnapshot'],
        where: { order: { restaurantId, status: { not: 'CANCELLED' } } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      // Recent orders (last 100, most recent first)
      prisma.order.findMany({
        where: { restaurantId },
        orderBy: { placedAt: 'desc' },
        take: 100,
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
      prisma.order.count({ where: { restaurantId, status: 'CANCELLED' } }),
      prisma.customer.count({ where: { restaurantId } }),
      buildDailyRevenue(restaurantId, thirtyDaysAgo),
    ])

    const payload = {
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
    }

    await cacheSet(cacheKey, payload)
    res.json(payload)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch analytics' })
  }
})

// ─── GET /analytics/export/csv ────────────────────────────────────
router.get('/export/csv', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user?.role === 'KITCHEN_STAFF') {
    res.status(403).json({ error: 'Forbidden: Kitchen staff cannot access analytics' })
    return
  }
  const { restaurantId, from, to } = req.query as Record<string, string>

  const user = req.user!
  const isSuperAdmin = user.role === 'SUPER_ADMIN'
  const targetId = isSuperAdmin ? restaurantId : (user.restaurantId || '')

  if (!isSuperAdmin && !targetId) {
    res.status(400).json({ error: 'Missing restaurantId' })
    return
  }

  try {
    const where: any = {}
    if (targetId) where.restaurantId = targetId
    if (from) where.placedAt = { ...where.placedAt, gte: new Date(from) }
    if (to)   where.placedAt = { ...where.placedAt, lte: new Date(to) }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      include: {
        items: { select: { nameSnapshot: true, quantity: true, subtotal: true } },
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

    const csv = rows
      .map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`)
    res.send('\uFEFF' + csv) // BOM for Excel UTF-8 compatibility
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to export' })
  }
})

// ─── GET /analytics/export/customers/csv ──────────────────────────
router.get('/export/customers/csv', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user?.role === 'KITCHEN_STAFF') {
    res.status(403).json({ error: 'Forbidden: Kitchen staff cannot access analytics' })
    return
  }
  const { restaurantId } = req.query as Record<string, string>
  const user = req.user!
  const targetId = user.role === 'SUPER_ADMIN' ? restaurantId : (user.restaurantId || '')

  try {
    const where = targetId ? { restaurantId: targetId } : {}
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { restaurant: { select: { name: true } } }
    })

    const rows = [
      ['Customer ID', 'Restaurant Name', 'Name', 'Phone', 'Loyalty Points', 'Visit Count', 'Marketing Consent', 'Created At'],
      ...customers.map((c: any) => [
        c.id,
        c.restaurant?.name || '',
        c.name,
        c.phone,
        c.loyaltyPoints,
        c.visitCount,
        c.consentMarketing ? 'Yes' : 'No',
        new Date(c.createdAt).toLocaleString('en-IN')
      ])
    ]

    const csv = rows
      .map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="customers-${Date.now()}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to export customers' })
  }
})

// ─── GET /analytics/export/restaurants/csv ────────────────────────
router.get('/export/restaurants/csv', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            categories: true,
            menuItems: true,
            tables: true,
            orders: true,
            customers: true,
          }
        }
      }
    })

    const rows = [
      ['Restaurant ID', 'Name', 'Slug', 'Address', 'Phone', 'Active Status', 'Categories', 'Menu Items', 'Tables', 'Orders', 'Customers', 'Created At'],
      ...restaurants.map((r: any) => [
        r.id,
        r.name,
        r.slug,
        r.address || '',
        r.phone || '',
        r.isActive ? 'Active' : 'Inactive',
        r._count.categories,
        r._count.menuItems,
        r._count.tables,
        r._count.orders,
        r._count.customers,
        new Date(r.createdAt).toLocaleString('en-IN')
      ])
    ]

    const csv = rows
      .map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="restaurants-${Date.now()}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to export restaurants' })
  }
})

// ─── GET /analytics/export/platform/csv ───────────────────────────
router.get('/export/platform/csv', requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [totalRestaurants, activeRestaurants, totalOrders, totalCustomers, totalRevenueSum] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true }
      })
    ])

    const totalRevenue = Number(totalRevenueSum._sum.totalAmount || 0)
    const totalCampaigns = await prisma.marketingCampaign.count({ where: { status: 'SENT' } })
    const marketingRevenue = totalCampaigns * 49.00

    const rows = [
      ['KPI Metric', 'Value'],
      ['Total Restaurants', totalRestaurants],
      ['Active Restaurants', activeRestaurants],
      ['Total Orders', totalOrders],
      ['Total Customers', totalCustomers],
      ['Platform Revenue', `₹${totalRevenue.toFixed(2)}`],
      ['Marketing Revenue', `₹${marketingRevenue.toFixed(2)}`],
    ]

    const csv = rows
      .map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="platform-analytics-${Date.now()}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to export platform analytics' })
  }
})

export default router
