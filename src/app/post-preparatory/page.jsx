'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Disc3, CircleDot, FileText, ArrowRight } from 'lucide-react'

export default function PostPreparatoryPage() {
  const entryModules = [
    {
      title: "Autoconer Entry",
      description: "Enter production data for Autoconer winding machines (AC1-AC16)",
      href: "/post-preparatory/autoconer",
      icon: Disc3,
      status: "Ready",
      color: "green"
    },
    {
      title: "Spinning Entry",
      description: "Ring frame spinning machine production entry (Machine 1-50)",
      href: "/post-preparatory/spinning",
      icon: CircleDot,
      status: "Ready",
      color: "green"
    }
  ]

  const readyModules = entryModules.filter(m => m.status === "Ready")
  const comingSoonModules = entryModules.filter(m => m.status === "Coming Soon")

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Post Preparatory Entry</h1>
        <p className="text-muted-foreground">
          Enter production data for post preparatory process machines - Autoconer & Spinning
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
              <Link key={module.href} href={module.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-500 h-full">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Icon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center justify-between">
                        {module.title}
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </CardTitle>
                      <CardDescription className="mt-1">{module.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Coming Soon Modules */}
      {comingSoonModules.length > 0 && (
        <div className="space-y-4 mt-8">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-500">Coming Soon</h2>
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
              {comingSoonModules.length} Planned
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comingSoonModules.map((module) => {
              const Icon = module.icon
              return (
                <Card key={module.href} className="opacity-60 h-full">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="h-6 w-6 text-gray-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-500">{module.title}</CardTitle>
                      <CardDescription>{module.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

