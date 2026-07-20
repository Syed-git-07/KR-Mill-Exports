import Link from 'next/link'
import { Settings, Factory, ClipboardPenLine, Cable, ChartNoAxesCombined, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const modules = [
  { title: 'Masters', description: 'Manage departments, machines, supervisors, and configurations', href: '/masters', icon: Settings },
  { title: 'Preparatory Master', description: 'Carding, Drawing, Comber, Simplex and other preparatory machine masters', href: '/preparatory-master', icon: Factory },
  { title: 'Preparatory Entry', description: 'Daily production entry for all preparatory machines', href: '/preparatory-entry', icon: ClipboardPenLine },
  { title: 'Post Preparatory Entry', description: 'Daily production entry for Spinning, Autoconer, and post-preparatory machines', href: '/post-preparatory', icon: Cable },
  { title: 'Reports', description: 'Production reports and analytics', href: '/reports', icon: ChartNoAxesCombined },
  { title: 'Holiday List', description: 'Manage the global production calendar and block entries on declared holidays', href: '/holiday-list', icon: CalendarDays },
]

export default function Home() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Welcome to KR Production System</h1>
        <p className="text-muted-foreground">Select a module below to get started</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {modules.map(({ title, description, href, icon: Icon }) => (
          <Card key={title} className="hover:shadow-xl transition-all hover:scale-105 border-2">
            <CardHeader className="text-center">
              <Icon className="h-12 w-12 mx-auto mb-3 text-blue-600" strokeWidth={1.6} />
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                <Link href={href}>Open Module</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
