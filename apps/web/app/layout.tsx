import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QR Saas — Digital QR Ordering for Restaurants',
  description: 'Scan. Order. Eat. A modern QR-based ordering system for restaurants.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
