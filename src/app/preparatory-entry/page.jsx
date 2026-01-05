'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Cog, Layers, Settings, Wind, Factory, FileText, ArrowRight } from 'lucide-react'

export default function PreparatoryEntryPage() {
  const entryModules = [
    {
      title: "Carding Entry",
      description: "Enter production data for carding machines (CA1-CA22)",
      href: "/preparatory-entry/carding",
      icon: Cog,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Breaker Drawing Entry",
      description: "Drawing breaker production entry (BD1-BD4)",
      href: "/preparatory-entry/breaker-drawing",
      icon: Layers,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Comber Entry",
      description: "Comber machine production entry (CO1-CO13)",
      href: "/preparatory-entry/comber",
      icon: Settings,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Finisher Drawing Entry",
      description: "Drawing finisher production entry (FD1-FD5)",
      href: "/preparatory-entry/finisher-drawing",
      icon: Layers,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Lap Former Entry",
      description: "Lap former production entry (LF1-LF3)",
      href: "/preparatory-entry/lap-former",
      icon: Factory,
      status: "Ready",
      color: "blue"
    },
    {
      title: "Simplex Entry",
      description: "Simplex machine production entry (1-10)",
      href: "/preparatory-entry/simplex",
      icon: Wind,
      status: "Ready",
      color: "blue"
    }
  ]

  const readyModules = entryModules.filter(m => m.status === "Ready")
  const comingSoonModules = entryModules.filter(m => m.status === "Coming Soon")

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Preparatory Entry</h1>
        <p className="text-muted-foreground">
          Enter production data for preparatory process machines - Carding, Drawing, Comber, Simplex and more
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
                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500 h-full">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon className="h-6 w-6 text-blue-600" />
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
    </div>
  )
}
