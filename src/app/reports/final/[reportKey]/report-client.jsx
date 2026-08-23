'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Printer, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { generateFinalReportAction, listFinalReportEmployeesAction } from '@/app/actions/final-reports'
import { createFinalReportPdf } from '@/lib/reports/pdfLayout'

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function ReportTable({ table }) {
  return (
    <section className="space-y-2 break-inside-avoid">
      {table.title && <h3 className="border-l-3 border-red-800 pl-2 text-sm font-semibold text-slate-800">{table.title}</h3>}
      <div className="overflow-x-auto rounded-md border border-slate-300">
        <table className="w-full border-collapse text-[11px] text-slate-800">
          <thead className="bg-slate-100">
            {table.headerGroups && <tr>{table.headerGroups.map((group, index) => <th key={`${group.label}-${index}`} colSpan={group.span} className="border-b border-r border-slate-400 px-2 py-1 text-center font-medium last:border-r-0">{group.label}</th>)}</tr>}
            <tr>{table.columns.map((column, index) => <th key={`${column}-${index}`} className="whitespace-nowrap border-b border-r border-slate-300 px-2 py-1.5 text-center font-semibold last:border-r-0">{column}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => <tr key={rowIndex} className="even:bg-slate-50/70">{row.map((cell, cellIndex) => <td key={cellIndex} className={`border-b border-r border-slate-200 px-2 py-1 last:border-r-0 ${cellIndex > 0 && !Number.isNaN(Number(cell)) ? 'text-right tabular-nums' : ''}`}>{cell}</td>)}</tr>)}
            {table.footer && <tr className="bg-red-50 font-semibold">{table.footer.map((cell, index) => <td key={index} className={`border-r border-slate-300 px-2 py-1.5 last:border-r-0 ${index > 0 ? 'text-right tabular-nums' : ''}`}>{cell}</td>)}</tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function FinalReportClient({ reportKey, config }) {
  const today = useMemo(localDate, [])
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [employeeName, setEmployeeName] = useState('')
  const [employees, setEmployees] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!config.requiresEmployee) return
    listFinalReportEmployeesAction().then(result => {
      if (result.success) setEmployees(result.data)
    })
  }, [config.requiresEmployee])

  async function generate() {
    setLoading(true)
    try {
      const result = await generateFinalReportAction(reportKey, fromDate, toDate, employeeName)
      if (!result.success) {
        setReport(null)
        toast.error(result.error || 'Unable to generate report')
        return
      }
      setReport(result.data)
      toast.success(result.data.tables?.length ? 'Report generated' : 'No records found for this period')
    } finally {
      setLoading(false)
    }
  }

  function downloadPdf() {
    if (!report) return
    createFinalReportPdf(report).save(report.filename)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <header className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-red-800">Final Format Report</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{config.title}</h1>
        </div>
        <Button asChild variant="outline" size="sm"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />All Reports</Link></Button>
      </header>

      <section className="print:hidden rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-600">From Date<input className="h-9 rounded-md border px-3 text-sm text-slate-900" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">To Date<input className="h-9 rounded-md border px-3 text-sm text-slate-900" type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label>
          {config.requiresEmployee && <label className="grid min-w-64 flex-1 gap-1 text-xs font-medium text-slate-600">Sider<input list="report-employees" className="h-9 rounded-md border px-3 text-sm text-slate-900" value={employeeName} onChange={event => setEmployeeName(event.target.value)} placeholder="Type or select employee" /><datalist id="report-employees">{employees.map(employee => <option key={`${employee.code}-${employee.name}`} value={employee.name}>{employee.code ? `${employee.code} - ` : ''}{employee.department}</option>)}</datalist></label>}
          <Button onClick={generate} disabled={loading || !fromDate || !toDate || (config.requiresEmployee && !employeeName.trim())} className="h-9 bg-slate-900 hover:bg-slate-800"><Search className="mr-2 h-4 w-4" />{loading ? 'Generating...' : 'Generate'}</Button>
        </div>
      </section>

      {report && <div className="print:hidden flex gap-2"><Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button variant="outline" size="sm" onClick={downloadPdf}><Download className="mr-2 h-4 w-4" />Download PDF</Button></div>}

      {report ? (
        <article className="rounded-xl border bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
          {report.template === 'preparatory-abstract' ? <div className="mb-5">
            <h2 className="text-center text-base font-bold text-slate-950">Kayaar Exports Private Limited</h2>
            <div className="mt-7 grid grid-cols-[1fr_1fr_1fr] text-xs font-bold text-slate-950"><span>Preparatory Hanks Abstract Report on</span><span className="text-center">{report.referenceDate}</span><span /></div>
          </div> : <div className="mb-4 text-center">
            <h2 className="text-lg font-bold tracking-wide text-slate-900">KAYAAR EXPORTS PRIVATE LIMITED</h2>
            <h3 className="mt-1 text-sm font-semibold uppercase text-slate-800">{report.title}</h3>
            <p className="mt-1 text-xs text-slate-600">{report.period}</p>
            <div className="mt-2 h-0.5 bg-red-800" />
          </div>}
          {report.template !== 'preparatory-abstract' && report.meta?.length > 0 && <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-xs">{report.meta.map(([label, value]) => <span key={label}><strong>{label}:</strong> {value}</span>)}</div>}
          <div className="space-y-5">{report.tables?.length ? report.tables.map((table, index) => <ReportTable key={`${table.title || 'table'}-${index}`} table={table} />) : <div className="py-12 text-center text-sm text-slate-500"><FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />No production records found.</div>}</div>
          {report.notes?.length > 0 && <div className="mt-4 space-y-1 text-[11px] italic text-slate-500">{report.notes.map((note, index) => <p key={index}>Note: {note}</p>)}</div>}
          <div className="mt-10 flex justify-between border-t pt-3 text-xs font-semibold">{report.signatures.map(signature => <span key={signature}>{signature}</span>)}</div>
        </article>
      ) : <section className="rounded-xl border border-dashed bg-white py-14 text-center text-sm text-slate-500"><FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />Set the report parameters and click Generate.</section>}
    </main>
  )
}
