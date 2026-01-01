'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Database, Settings, Cog, Users, Activity } from 'lucide-react'

export default function MasterSidebar() {
  const pathname = usePathname()

  const masterModules = [
    {
      title: "Department Master",
      href: "/masters/department",
      icon: Database
    },
    {
      title: "Spinning Machine",
      href: "/masters/spinning-machine",
      icon: Cog
    },
    {
      title: "Autoconer Machine",
      href: "/masters/autoconer",
      icon: Settings
    },
    {
      title: "Stoppage Head",
      href: "/masters/stoppage-head",
      icon: Activity
    },
    {
      title: "Stoppage Detail",
      href: "/masters/stoppage-detail",
      icon: Activity
    },
    {
      title: "Supervisor",
      href: "/masters/supervisor",
      icon: Users
    },
    {
      title: "Spinning Count",
      href: "/masters/spinning-count",
      icon: Database
    },
    {
      title: "TPI Entry",
      href: "/masters/tpi-entry",
      icon: Activity
    },
    {
      title: "TWC Entry",
      href: "/masters/twc-entry",
      icon: Activity
    },
    {
      title: "HOK Strength",
      href: "/masters/hok-strength",
      icon: Activity
    }
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full">
      <div className="p-4 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
          <Home size={20} />
          <span className="font-semibold">Home</span>
        </Link>
      </div>
      
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Master Modules
        </h2>
        <nav className="space-y-1">
          {masterModules.map((module) => {
            const Icon = module.icon
            const isActive = pathname === module.href
            
            return (
              <Link
                key={module.href}
                href={module.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm">{module.title}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
