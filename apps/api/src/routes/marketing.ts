import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requireTenant } from '../middleware/auth'

const router = Router({ mergeParams: true })

// ─── Helper: segment filter builders ─────────────────────────────
function buildSegmentWhere(restaurantId: string, segment: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const base = { restaurantId }

  switch (segment) {
    case 'FREQUENT':
      return { ...base, visitCount: { gte: 5 } }
    case 'INACTIVE':
      return { ...base, lastOrderAt: { lt: thirtyDaysAgo } }
    case 'NEW':
      return { ...base, createdAt: { gte: sevenDaysAgo } }
    case 'MARKETING_CONSENT':
      return { ...base, consentMarketing: true }
    default:
      return base
  }
}

// ─── GET /marketing/segments — customer counts ────────────────────
router.get('/segments', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params

  try {
    const [all, frequent, inactive, newCustomers, consentGiven] = await Promise.all([
      prisma.customer.count({ where: { restaurantId } }),
      prisma.customer.count({ where: buildSegmentWhere(restaurantId, 'FREQUENT') }),
      prisma.customer.count({ where: buildSegmentWhere(restaurantId, 'INACTIVE') }),
      prisma.customer.count({ where: buildSegmentWhere(restaurantId, 'NEW') }),
      prisma.customer.count({ where: buildSegmentWhere(restaurantId, 'MARKETING_CONSENT') }),
    ])

    res.json({
      ALL: all,
      FREQUENT: frequent,
      INACTIVE: inactive,
      NEW: newCustomers,
      MARKETING_CONSENT: consentGiven,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch segments' })
  }
})

// ─── GET /marketing/campaigns — list campaigns ────────────────────
router.get('/campaigns', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params

  try {
    const campaigns = await prisma.marketingCampaign.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(campaigns)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch campaigns' })
  }
})

// ─── POST /marketing/campaigns — create campaign ──────────────────
router.post('/campaigns', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params

  const schema = z.object({
    name: z.string().min(1).max(100),
    message: z.string().min(1).max(1000),
    segment: z.enum(['ALL', 'FREQUENT', 'INACTIVE', 'NEW', 'MARKETING_CONSENT']).default('ALL'),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    // Calculate recipient count based on segment
    const recipientCount = await prisma.customer.count({
      where: buildSegmentWhere(restaurantId, parsed.data.segment),
    })

    const campaign = await prisma.marketingCampaign.create({
      data: {
        restaurantId,
        ...parsed.data,
        recipientCount,
        status: 'DRAFT',
      },
    })

    res.status(201).json(campaign)
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create campaign' })
  }
})

// ─── POST /marketing/campaigns/:id/send — send campaign ───────────
router.post('/campaigns/:campaignId/send', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, campaignId } = req.params

  try {
    const campaign = await prisma.marketingCampaign.findFirst({
      where: { id: campaignId, restaurantId },
    })

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    if (campaign.status === 'SENT') {
      res.status(400).json({ error: 'Campaign already sent' })
      return
    }

    // Get recipients
    const recipients = await prisma.customer.findMany({
      where: buildSegmentWhere(restaurantId, campaign.segment),
      select: { id: true, name: true, phone: true },
    })

    const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
    const PHONE_ID = process.env.WHATSAPP_PHONE_ID

    if (WHATSAPP_TOKEN && PHONE_ID) {
      console.log(`[WhatsApp API] Sending WhatsApp messages using Meta API...`)
      for (const recipient of recipients) {
        try {
          const resMeta = await fetch(
            `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: recipient.phone,
                type: 'text',
                text: { body: campaign.message.replace('{name}', recipient.name) }
              })
            }
          )
          if (!resMeta.ok) {
            const errBody = await resMeta.json().catch(() => ({}))
            console.error(`[WhatsApp API] Meta request failed for ${recipient.phone}:`, errBody)
          }
        } catch (fetchErr) {
          console.error(`[WhatsApp API] Request error for ${recipient.phone}:`, fetchErr)
        }
      }
    } else {
      console.warn(`[WhatsApp API] Config missing. Logging marketing messages to server console:`)
      recipients.forEach((r: any) => {
        console.log(`  → ${r.name} (${r.phone}): ${campaign.message.replace('{name}', r.name)}`)
      })
    }

    const updated = await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        recipientCount: recipients.length,
      },
    })

    res.json({ ...updated, message: `Campaign sent to ${recipients.length} recipients` })
  } catch (e: any) {
    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    }).catch(() => {})
    res.status(500).json({ error: e.message || 'Failed to send campaign' })
  }
})

// ─── DELETE /marketing/campaigns/:id ─────────────────────────────
router.delete('/campaigns/:campaignId', requireAuth, requireTenant, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, campaignId } = req.params

  try {
    const existing = await prisma.marketingCampaign.findFirst({ where: { id: campaignId, restaurantId } })
    if (!existing) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    await prisma.marketingCampaign.delete({ where: { id: campaignId } })
    res.json({ message: 'Campaign deleted' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete campaign' })
  }
})

export default router
