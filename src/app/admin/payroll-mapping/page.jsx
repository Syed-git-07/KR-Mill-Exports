import Link from 'next/link'
import { Search, UserRoundCheck } from 'lucide-react'
import { requireRole } from '@/lib/security/auth'
import { getLegacyEmployeeMappingQueue } from '@/lib/payroll/legacyEmployeeMapping'
import LegacyEmployeeMappingRow from '@/components/admin/LegacyEmployeeMappingRow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export const metadata = { title: 'Payroll employee mapping | KR Production' }

function pageUrl(query, page) {
  const params = new URLSearchParams()
  if (query) params.set('query', query)
  params.set('page', String(page))
  return `/admin/payroll-mapping?${params.toString()}`
}

export default async function PayrollMappingPage({ searchParams }) {
  await requireRole('ADMIN')
  const params = await searchParams
  const queue = await getLegacyEmployeeMappingQueue({
    query: params?.query,
    page: params?.page,
    pageSize: 50
  })

  return (
    <main className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-700">
          <UserRoundCheck className="size-4" /> Administration
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Legacy payroll employee mapping</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-600">
          Map one historical production assignment at a time. The stored name remains the historical snapshot;
          this operation adds only the verified payroll employee ID and is recorded in the activity log.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>{queue.total.toLocaleString('en-IN')} unresolved assignments</CardTitle>
          <CardDescription>Search by snapshot name, module, machine, date, or shift.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-2 sm:flex-row" method="get">
            <Input name="query" defaultValue={queue.query} placeholder="Search unresolved assignments" maxLength={100} />
            <Button type="submit"><Search />Search</Button>
            {queue.query && <Button asChild type="button" variant="outline"><Link href="/admin/payroll-mapping">Clear</Link></Button>}
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 py-0">
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3">Historical snapshot</th>
                <th className="px-3 py-3">Production source</th>
                <th className="px-3 py-3">Entry</th>
                <th className="px-3 py-3">Verified payroll employee</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.assignments.map(assignment => (
                <LegacyEmployeeMappingRow key={assignment.assignment_key} assignment={assignment} />
              ))}
              {!queue.assignments.length && (
                <tr><td colSpan={5} className="px-4 py-14 text-center text-slate-500">No unresolved assignments match this search.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
        <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">Page {queue.page} of {queue.pages}</span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={queue.page <= 1}>
              <Link className={queue.page <= 1 ? 'pointer-events-none opacity-50' : ''} href={pageUrl(queue.query, Math.max(1, queue.page - 1))}>Previous</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={queue.page >= queue.pages}>
              <Link className={queue.page >= queue.pages ? 'pointer-events-none opacity-50' : ''} href={pageUrl(queue.query, Math.min(queue.pages, queue.page + 1))}>Next</Link>
            </Button>
          </div>
        </div>
      </Card>
    </main>
  )
}
