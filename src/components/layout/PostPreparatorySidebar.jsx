'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Disc3, CircleDot, FileText } from 'lucide-react'

export default function PostPreparatorySidebar() {
  const pathname = usePathname()

  const entryModules = [
    {
      title: "Autoconer Entry",
      href: "/post-preparatory/autoconer",
      icon: Disc3
    },
    {
      title: "Spinning Entry",
      href: "/post-preparatory/spinning",
      icon: CircleDot
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
          Post Preparatory Entry
        </h2>
        <nav className="space-y-1">
          {entryModules.map((module) => {
            const Icon = module.icon
            const isActive = pathname === module.href || pathname.startsWith(module.href + '/')
            
            return (
              <Link
                key={module.href}
                href={module.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-green-600' : 'text-gray-500'} />
                <span className="text-sm">{module.title}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-200">
        <Link 
          href="/post-preparatory"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <FileText size={16} />
          <span>Entry Overview</span>
        </Link>
      </div>
    </div>
  )
}
