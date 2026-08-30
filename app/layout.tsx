import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NFL Pick Em Pool',
  description: 'Season-long NFL team draft pool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
