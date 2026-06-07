import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../lib/prisma'

export let lastGeneratedQrUrl = 'none'

// Read FRONTEND_URL at call-time (not module-load-time) so Railway env vars
// are always picked up even if the module is cached before env is ready.
function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL || ''
  if (!url) {
    console.warn('[QR] FRONTEND_URL is not set — QR codes will use http://localhost:3000')
    return 'http://localhost:3000'
  }
  return url.replace(/\/+$/, '') // strip trailing slash
}

/**
 * Generate a QR code as a base64 PNG data URL.
 * Storing data URLs in the DB means:
 *  - No filesystem dependency (Railway's FS is ephemeral)
 *  - No PUBLIC_URL configuration needed
 *  - Works in production immediately, no extra hosting required
 */
async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    type: 'image/png',
    width: 600,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  })
}

// ─── Regenerate QR for an existing table ─────────────────────────
export async function generateQrForTable(tableId: string) {
  const table = await prisma.table.findUniqueOrThrow({
    where: { id: tableId },
    include: { restaurant: { select: { slug: true } } },
  })

  const newToken = uuidv4()
  const qrUrl = `${getFrontendUrl()}/menu/${table.restaurant.slug}?table=${newToken}`
  lastGeneratedQrUrl = qrUrl
  console.log("QR URL GENERATED:", qrUrl)
  const dataUrl = await generateQrDataUrl(qrUrl)

  return prisma.table.update({
    where: { id: tableId },
    data: {
      qrToken: newToken,
      qrImageUrl: dataUrl,
      tokenUpdatedAt: new Date(),
    },
  })
}

// ─── Create a single table with an explicit table number ─────────
export async function generateQrForSingleTable(
  restaurantId: string,
  tableNumber: number
) {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { slug: true },
  })

  const token = uuidv4()
  const qrUrl = `${getFrontendUrl()}/menu/${restaurant.slug}?table=${token}`
  lastGeneratedQrUrl = qrUrl
  console.log("QR URL GENERATED:", qrUrl)
  const dataUrl = await generateQrDataUrl(qrUrl)

  return prisma.table.create({
    data: {
      restaurantId,
      tableNumber,
      qrToken: token,
      qrImageUrl: dataUrl,
    },
  })
}

// ─── Bulk create tables + QR codes ───────────────────────────────
export async function generateQrBulk(
  restaurantId: string,
  startNumber: number,
  count: number
) {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { slug: true },
  })

  const frontendUrl = getFrontendUrl()
  const tables = []

  for (let i = 0; i < count; i++) {
    const tableNumber = startNumber + i
    const token = uuidv4()
    const qrUrl = `${frontendUrl}/menu/${restaurant.slug}?table=${token}`
    lastGeneratedQrUrl = qrUrl
    console.log("QR URL GENERATED:", qrUrl)
    const dataUrl = await generateQrDataUrl(qrUrl)

    const table = await prisma.table.create({
      data: {
        restaurantId,
        tableNumber,
        qrToken: token,
        qrImageUrl: dataUrl,
      },
    })
    tables.push(table)
  }

  return tables
}
