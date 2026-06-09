import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireSuperAdmin } from '../middleware/auth'
import { z } from 'zod'

const router = Router()

// All routes here require super admin role
router.use(requireAuth, requireSuperAdmin)

// ─── GET /stats ──────────────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [adsCount, postersCount, leadsCount, adsSum, postersDeliveredCount, campaignsSentCount] = await Promise.all([
      prisma.adCampaignRequest.count(),
      prisma.posterDesignRequest.count(),
      prisma.lead.count(),
      prisma.adCampaignRequest.aggregate({
        where: { status: { in: ['APPROVED', 'COMPLETED'] } },
        _sum: { budget: true }
      }),
      prisma.posterDesignRequest.count({ where: { status: 'DELIVERED' } }),
      prisma.marketingCampaign.count({ where: { status: 'SENT' } })
    ])

    // Marketing Revenue Engine:
    // 10% management fee on ad campaigns budget + ₹1500 per delivered poster + ₹49 per whatsapp campaign sent
    const adsRevenue = Number(adsSum._sum.budget || 0) * 0.10
    const postersRevenue = postersDeliveredCount * 1500
    const campaignsRevenue = campaignsSentCount * 49
    const totalMarketingRevenue = adsRevenue + postersRevenue + campaignsRevenue

    res.json({
      totalRevenue: totalMarketingRevenue,
      adsRevenue,
      postersRevenue,
      campaignsRevenue,
      whatsappConfigured: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_ID),
      counts: {
        ads: adsCount,
        posters: postersCount,
        leads: leadsCount,
        campaigns: campaignsSentCount
      }
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load marketing stats' })
  }
})

// ─── ADS CAMPAIGNS ───────────────────────────────────────────────
router.get('/ads', async (req: Request, res: Response) => {
  try {
    const ads = await prisma.adCampaignRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { restaurant: { select: { name: true } } }
    })
    res.json(ads)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load ad requests' })
  }
})

router.post('/ads', async (req: Request, res: Response) => {
  const schema = z.object({
    restaurantId: z.string().uuid(),
    platform: z.enum(['META', 'GOOGLE']),
    budget: z.number().positive(),
    notes: z.string().optional()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const ad = await prisma.adCampaignRequest.create({
      data: parsed.data,
      include: { restaurant: { select: { name: true } } }
    })
    res.status(201).json(ad)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create ad request' })
  }
})

router.patch('/ads/:id', async (req: Request, res: Response) => {
  const schema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'COMPLETED']).optional(),
    notes: z.string().optional()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const updated = await prisma.adCampaignRequest.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { restaurant: { select: { name: true } } }
    })
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update ad request' })
  }
})

// ─── POSTER REQUESTS ─────────────────────────────────────────────
router.get('/posters', async (req: Request, res: Response) => {
  try {
    const posters = await prisma.posterDesignRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { restaurant: { select: { name: true } } }
    })
    res.json(posters)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load poster requests' })
  }
})

router.post('/posters', async (req: Request, res: Response) => {
  const schema = z.object({
    restaurantId: z.string().uuid(),
    concept: z.string().min(1),
    size: z.enum(['SQUARE', 'BANNER', 'STORY'])
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const poster = await prisma.posterDesignRequest.create({
      data: parsed.data,
      include: { restaurant: { select: { name: true } } }
    })
    res.status(201).json(poster)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create poster request' })
  }
})

router.patch('/posters/:id', async (req: Request, res: Response) => {
  const schema = z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'DELIVERED']).optional(),
    imageUrl: z.string().optional()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const updated = await prisma.posterDesignRequest.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { restaurant: { select: { name: true } } }
    })
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update poster request' })
  }
})

// ─── LEADS ───────────────────────────────────────────────────────
router.get('/leads', async (req: Request, res: Response) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { restaurant: { select: { name: true } } }
    })
    res.json(leads)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load leads' })
  }
})

router.post('/leads', async (req: Request, res: Response) => {
  const schema = z.object({
    restaurantId: z.string().uuid(),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    source: z.string(),
    status: z.enum(['NEW', 'CONTACTED', 'CONVERTED']).default('NEW')
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const lead = await prisma.lead.create({
      data: parsed.data,
      include: { restaurant: { select: { name: true } } }
    })
    res.status(201).json(lead)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create lead' })
  }
})

router.patch('/leads/:id', async (req: Request, res: Response) => {
  const schema = z.object({
    status: z.enum(['NEW', 'CONTACTED', 'CONVERTED']).optional()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { restaurant: { select: { name: true } } }
    })
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update lead' })
  }
})

export default router
