import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Menu — QR Saas',
}

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
