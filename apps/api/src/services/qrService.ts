import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'
import { uploadBuffer } from './storageService'
import { prisma } from '../lib/prisma'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

async function generateQrBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 800,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  }) as unknown as Buffer
}

// ─── Regenerate QR for an existing table ─────────────────────────
export async function generateQrForTable(tableId: string) {
  const table = await prisma.table.findUniqueOrThrow({
    where: { id: tableId },
    include: { restaurant: { select: { slug: true } } },
  })

  const newToken = uuidv4()
  const qrUrl = `${FRONTEND_URL}/menu/${table.restaurant.slug}?table=${newToken}`
  const buf = await generateQrBuffer(qrUrl)

  const storageKey = `qr/${table.restaurantId}/table-${table.tableNumber}.png`
  const imageUrl = await uploadBuffer(buf, storageKey, 'image/png')

  return prisma.table.update({
    where: { id: tableId },
    data: {
      qrToken: newToken,
      qrImageUrl: imageUrl,
      tokenUpdatedAt: new Date(),
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

  const tables = []
  for (let i = 0; i < count; i++) {
    const tableNumber = startNumber + i
    const token = uuidv4()
    const qrUrl = `${FRONTEND_URL}/menu/${restaurant.slug}?table=${token}`

    const buf = await generateQrBuffer(qrUrl)
    const storageKey = `qr/${restaurantId}/table-${tableNumber}.png`
    const imageUrl = await uploadBuffer(buf, storageKey, 'image/png')

    const table = await prisma.table.create({
      data: {
        restaurantId,
        tableNumber,
        qrToken: token,
        qrImageUrl: imageUrl,
      },
    })
    tables.push(table)
  }

  return tables
}
