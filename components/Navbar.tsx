'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'

interface NavbarProps {
  displayName: string
}

export default function Navbar({ displayName }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/dashboard', label: 'Standings' },
    { href: '/my-teams', label: 'My Teams' },
  ]

  return (
    <nav className="bg-nfl-navy shadow-md">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Left: Logo + Nav links */}
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-lg tracking-tight select-none">
            🏈 NFL Pool
          </span>
          <div className="flex gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  pathname === link.href
                    ? 'bg-white text-nfl-navy'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: User + logout */}
        <div className="flex items-center gap-3">
          <span className="text-blue-300 text-sm hidden sm:block">{displayName}</span>
          <button
            onClick={handleLogout}
            className="text-blue-200 hover:text-white text-sm px-3 py-1.5 rounded-md hover:bg-blue-800 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
