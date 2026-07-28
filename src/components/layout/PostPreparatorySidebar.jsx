'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Home, Disc3, CircleDot, FileText } from 'lucide-react'

export default function PostPreparatorySidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

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
    <aside
      className={`${collapsed ? 'w-16' : 'w-64'} h-full shrink-0 overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200`}
    >
      <div className={`${collapsed ? 'p-2' : 'p-4'} border-b border-gray-200`}>
        <div className="flex items-center justify-between gap-1">
          <Link
            href="/"
            title={collapsed ? 'Home' : undefined}
            aria-label="Home"
            className="flex min-w-0 items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <Home size={20} />
            {!collapsed && <span className="font-semibold">Home</span>}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
      
      <div className={collapsed ? 'p-2' : 'p-4'}>
        {!collapsed && (
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Post Preparatory Entry
          </h2>
        )}
        <nav className="space-y-1">
          {entryModules.map((module) => {
            const Icon = module.icon
            const isActive = pathname === module.href || pathname.startsWith(module.href + '/')
            
            return (
              <Link
                key={module.href}
                href={module.href}
                title={collapsed ? module.title : undefined}
                aria-label={module.title}
                className={`flex items-center rounded-lg py-2 transition-colors ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  isActive
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} className={`shrink-0 ${isActive ? 'text-green-600' : 'text-gray-500'}`} />
                {!collapsed && <span className="truncate text-sm">{module.title}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-gray-200`}>
        <Link 
          href="/post-preparatory"
          title={collapsed ? 'Entry Overview' : undefined}
          aria-label="Entry Overview"
          className={`flex items-center text-sm text-gray-600 hover:text-gray-900 ${
            collapsed ? 'justify-center' : 'gap-2'
          }`}
        >
          <FileText size={16} />
          {!collapsed && <span>Entry Overview</span>}
        </Link>
      </div>
    </aside>
  )
}
