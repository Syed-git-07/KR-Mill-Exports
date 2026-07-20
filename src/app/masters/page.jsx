'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, Cog, Settings, Activity, Users, Hash, Target, TrendingUp, Circle } from 'lucide-react'

export default function MastersPage() {
  const masterModules = [
    {
      title: "Department Master",
      description: "Manage department information and HOK parameters",
      href: "/masters/department",
      icon: Database,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Spinning Machine Master",
      description: "Ring frame machines management with 33 machines",
      href: "/masters/spinning-machine",
      icon: Cog,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Autoconer Machine Master",
      description: "Auto winding machines management",
      href: "/masters/autoconer",
      icon: Settings,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Stoppage Head Master",
      description: "Downtime category management with 10 categories",
      href: "/masters/stoppage-head",
      icon: Activity,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Supervisor Master",
      description: "Supervisor information and shift management",
      href: "/masters/supervisor",
      icon: Users,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Spinning Count Master",
      description: "Yarn count specifications (21 counts)",
      href: "/masters/spinning-count",
      icon: Hash,
      status: "Ready",
      color: "blue"
    },
    {
      title: "TPI Entry Master",
      description: "Twist Per Inch data entry and tracking",
      href: "/masters/tpi-entry",
      icon: TrendingUp,
      status: "Ready",
      color: "blue"
    },
    {
      title: "TWC Entry Master",
      description: "Twist Weight Count data management",
      href: "/masters/twc-entry",
      icon: Circle,
      status: "Ready",
      color: "blue"
    },
    {
      title: "HOK Strength Master",
      description: "Quality tracking by department and shift",
      href: "/masters/hok-strength",
      icon: Target,
      status: "Ready",
      color: "blue"
    }
  ]

  const readyModules = masterModules.filter(m => m.status === "Ready")
  const comingSoonModules = masterModules.filter(m => m.status === "Coming Soon")

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Master Data Management</h1>
        <p className="text-muted-foreground">
          Manage all master data for the production system
        </p>
      </div>

      {/* Ready Modules */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Available Modules</h2>
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
            {readyModules.length} Ready
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {readyModules.map((module) => {
            const Icon = module.icon
            return (
              <Card key={module.title} className="hover:shadow-lg transition-shadow border-2 border-blue-100">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      Ready
                    </span>
                  </div>
                  <CardTitle className="text-lg mt-4">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={module.href}>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                      Open Module
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-blue-900">Module Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{masterModules.length}</div>
            <div className="text-sm text-gray-600">Total Modules</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-3xl font-bold text-green-600">{readyModules.length}</div>
            <div className="text-sm text-gray-600">Ready to Use</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-3xl font-bold text-gray-600">{comingSoonModules.length}</div>
            <div className="text-sm text-gray-600">In Development</div>
          </div>
        </div>
      </div>
    </div>
  )
}
