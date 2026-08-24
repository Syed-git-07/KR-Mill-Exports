'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, FileBarChart, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FINAL_REPORT_GROUPS } from '@/lib/reports/finalReportCatalog'

const accents = {
  blue: {
    border: 'border-blue-200/80 dark:border-blue-900/70',
    band: 'bg-blue-50/70 dark:bg-blue-950/35',
    icon: 'text-blue-700 dark:text-blue-300',
    count: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300',
    row: 'hover:bg-blue-50/80 dark:hover:bg-blue-950/30'
  },
  emerald: {
    border: 'border-emerald-200/80 dark:border-emerald-900/70',
    band: 'bg-emerald-50/70 dark:bg-emerald-950/35',
    icon: 'text-emerald-700 dark:text-emerald-300',
    count: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    row: 'hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30'
  },
  violet: {
    border: 'border-violet-200/80 dark:border-violet-900/70',
    band: 'bg-violet-50/70 dark:bg-violet-950/35',
    icon: 'text-violet-700 dark:text-violet-300',
    count: 'bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300',
    row: 'hover:bg-violet-50/80 dark:hover:bg-violet-950/30'
  }
}

export default function ReportsPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 text-foreground sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary p-2 text-primary-foreground">
            <FileBarChart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Production Reports</h1>
            <p className="text-sm text-muted-foreground">Choose a report, set its period, then preview or download the final PDF.</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Home</Link>
        </Button>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {FINAL_REPORT_GROUPS.map(group => {
          const accent = accents[group.accent]
          return (
            <section key={group.key} className={`overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm ${accent.border}`}>
              <div className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${accent.band}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className={`h-4 w-4 ${accent.icon}`} />
                    <h2 className="font-semibold">{group.title}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{group.subtitle}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${accent.count}`}>
                  {group.reports.length} reports
                </span>
              </div>
              <div>
                {group.reports.map((report, index) => (
                  <Link
                    key={report.key}
                    href={report.href}
                    className={`group flex min-h-11 items-center gap-3 border-b border-border/70 px-4 py-2.5 text-sm transition-colors last:border-b-0 odd:bg-muted/35 even:bg-card ${accent.row}`}
                  >
                    <span className="w-5 shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 font-medium text-foreground">{report.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
