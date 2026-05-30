import path from 'path'
import fs from 'fs'

const LOCAL_QR_DIR = path.join(__dirname, '../../public/qr')
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:4000'

// Ensure local QR directory exists
if (!fs.existsSync(LOCAL_QR_DIR)) {
  fs.mkdirSync(LOCAL_QR_DIR, { recursive: true })
}

/**
 * Saves a buffer to local filesystem and returns its public URL.
 * In production, swap this for R2/S3 upload.
 */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  _contentType: string
): Promise<string> {
  const mode = process.env.STORAGE_MODE || 'local'

  if (mode === 'local') {
    // Strip leading "qr/" prefix to get filename
    const filename = key.replace('qr/', '').replace(/\//g, '_')
    const filePath = path.join(LOCAL_QR_DIR, filename)
    fs.writeFileSync(filePath, buffer)
    return `${PUBLIC_URL}/public/qr/${filename}`
  }

  // ─── Cloudflare R2 (stub) ────────────────────────────────────
  // Uncomment and configure when ready for production:
  //
  // const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
  // const s3 = new S3Client({
  //   region: 'auto',
  //   endpoint: process.env.R2_ENDPOINT,
  //   credentials: {
  //     accessKeyId: process.env.R2_ACCESS_KEY!,
  //     secretAccessKey: process.env.R2_SECRET_KEY!,
  //   },
  // })
  // await s3.send(new PutObjectCommand({
  //   Bucket: process.env.R2_BUCKET!,
  //   Key: key,
  //   Body: buffer,
  //   ContentType: _contentType,
  //   ACL: 'public-read',
  // }))
  // return `${process.env.R2_PUBLIC_URL}/${key}`

  throw new Error('STORAGE_MODE not set to "local" and R2 not configured')
}
