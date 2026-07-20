'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Cog, Settings, Layers, Wind, Factory } from 'lucide-react'

export default function PreparatorySidebar() {
  const pathname = usePathname()

  const preparatoryModules = [
    {
      title: "Carding Machine",
      href: "/preparatory-master/carding-machine",
      icon: Cog
    },
    {
      title: "Breaker Drawing Machine",
      href: "/preparatory-master/drawing-breaker",
      icon: Layers
    },
    {
      title: "Comber Machine",
      href: "/preparatory-master/comber",
      icon: Settings
    },
    {
      title: "Finisher Drawing",
      href: "/preparatory-master/drawing-finisher",
      icon: Layers
    },
    {
      title: "Lap Former",
      href: "/preparatory-master/lap-former",
      icon: Factory
    },
    {
      title: "Simplex Machine",
      href: "/preparatory-master/simplex",
      icon: Wind
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
          Preparatory Modules
        </h2>
        <nav className="space-y-1">
          {preparatoryModules.map((module) => {
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
