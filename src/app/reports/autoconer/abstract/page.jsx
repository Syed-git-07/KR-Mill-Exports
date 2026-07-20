'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Download, ArrowLeft, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fetchAutoconerAbstractReport } from './actions'

export default function AutoconerAbstractReport() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [reportData, setReportData]     = useState(null)
  const [loading, setLoading]           = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────
  const formatDateForQuery = (date) => {
    const year  = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day   = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fmt2 = (val) =>
    typeof val === 'number' ? val.toFixed(2) : '0.00'

  const fmtProd = (val) =>
    typeof val === 'number'
      ? val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00'

  // ── Generate ───────────────────────────────────────────────────────────
  const generateReport = async () => {
    if (!selectedDate) {
      toast.error('Please select a date')
      return
    }
    setLoading(true)
    try {
      const result = await fetchAutoconerAbstractReport(formatDateForQuery(selectedDate))
      if (!result?.success) {
        toast.error(result?.message || 'Failed to generate report')
        return
      }
      setReportData(result)
      toast.success('Report generated successfully')
    } catch (err) {
      console.error(err)
      toast.error('Error generating report')
    } finally {
      setLoading(false)
    }
  }

  // ── PDF Download ───────────────────────────────────────────────────────
  const downloadPDF = () => {
    if (!reportData) return

    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw   = doc.internal.pageSize.getWidth()
    const ph   = doc.internal.pageSize.getHeight()
    const date = reportData.displayDate

    const addFooter = () => {
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        const footerY = ph - 8
        doc.text('AM(P)', 25,   footerY)
        doc.text('GM',    pw / 2, footerY, { align: 'center' })
        doc.text('M.D',   pw - 25, footerY, { align: 'right' })
        doc.text(`Page ${i} of ${pageCount}`, pw - 10, footerY, { align: 'right' })
      }
    }

    // Title
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Kayaar Exports Private Limited', pw / 2, 15, { align: 'center' })

    // ── Section 1: Shift-wise ──────────────────────────────────────────
    // Dual header row
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Autoconer Abstract Report as on   ${date}`, 14, 24)
    doc.text(`Autoconer Abstract Upto   ${date}`, pw / 2 + 4, 24)

    const shiftTableBody = reportData.shiftData.map(r => [
      r.shift,
      fmtProd(r.prod_kgs), fmt2(r.effi), fmt2(r.red_light), fmt2(r.utti),
      fmtProd(reportData.uptoShiftData.find(u => u.shift === r.shift)?.prod_kgs ?? 0),
      fmt2(reportData.uptoShiftData.find(u => u.shift === r.shift)?.effi       ?? 0),
      fmt2(reportData.uptoShiftData.find(u => u.shift === r.shift)?.red_light  ?? 0),
      fmt2(reportData.uptoShiftData.find(u => u.shift === r.shift)?.utti       ?? 0),
    ])

    const t = reportData.total
    const u = reportData.uptoTotal
    shiftTableBody.push([
      'TOTAL :',
      fmtProd(t.prod_kgs), fmt2(t.effi), fmt2(t.red_light), fmt2(t.utti),
      fmtProd(u.prod_kgs), fmt2(u.effi),  fmt2(u.red_light), fmt2(u.utti),
    ])

    autoTable(doc, {
      startY: 28,
      head: [[
        'SHIFT', 'PROD(KGS)', 'EFFI', 'RED Light', 'UTTI',
        'PROD(KGS)', 'EFFI', 'RED Light', 'UTTI',
      ]],
      body: shiftTableBody,
      theme: 'grid',
      styles:     { fontSize: 8, halign: 'center', cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 16 },
        1: { cellWidth: 22 }, 2: { cellWidth: 16 }, 3: { cellWidth: 18 }, 4: { cellWidth: 18 },
        5: { cellWidth: 22 }, 6: { cellWidth: 16 }, 7: { cellWidth: 18 }, 8: { cellWidth: 18 },
      },
      didParseCell: ({ row, cell }) => {
        if (row.index === shiftTableBody.length - 1) {
          cell.styles.fontStyle = 'bold'
          cell.styles.fillColor = [243, 244, 246]
        }
      },
    })

    // ── Section 2: Count Abstract ─────────────────────────────────────
    const afterShift = doc.lastAutoTable.finalY + 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Autoconer Count Abstract Upto   ${date}`, 14, afterShift + 4)

    // Left table — ON DATE
    const onDateBody = reportData.countOnDate.rows.map(r => [
      r.count_name, fmtProd(r.prod_kgs), fmt2(r.effi),
    ])
    onDateBody.push([
      reportData.countOnDate.total.count_name,
      fmtProd(reportData.countOnDate.total.prod_kgs),
      fmt2(reportData.countOnDate.total.effi),
    ])

    autoTable(doc, {
      startY:  afterShift + 7,
      tableWidth: 78,
      margin: { left: 14 },
      head: [['CountName', 'Prodnkgs', 'Effi']],
      body: onDateBody,
      theme: 'grid',
      styles:     { fontSize: 8, halign: 'right', cellPadding: 2 },
      headStyles: {
        fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8,
        halign: 'center',
      },
      columnStyles: { 0: { halign: 'left' } },
      didParseCell: ({ row, cell }) => {
        if (row.index === onDateBody.length - 1) {
          cell.styles.fontStyle = 'bold'
          cell.styles.fillColor = [243, 244, 246]
        }
      },
    })

    // Right table — UP TO DATE
    const uptoDateBody = reportData.countUptoDate.rows.map(r => [
      r.count_name, fmtProd(r.prod_kgs), fmt2(r.effi),
    ])
    uptoDateBody.push([
      reportData.countUptoDate.total.count_name,
      fmtProd(reportData.countUptoDate.total.prod_kgs),
      fmt2(reportData.countUptoDate.total.effi),
    ])

    autoTable(doc, {
      startY:  afterShift + 7,
      tableWidth: 78,
      margin: { left: pw / 2 + 2 },
      head: [['CountName', 'UProdnkgs', 'UEffi']],
      body: uptoDateBody,
      theme: 'grid',
      styles:     { fontSize: 8, halign: 'right', cellPadding: 2 },
      headStyles: {
        fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8,
        halign: 'center',
      },
      columnStyles: { 0: { halign: 'left' } },
      didParseCell: ({ row, cell }) => {
        if (row.index === uptoDateBody.length - 1) {
          cell.styles.fontStyle = 'bold'
          cell.styles.fillColor = [243, 244, 246]
        }
      },
    })

    addFooter()
    doc.save(`Autoconer_Abstract_Report_${date}.pdf`)
    toast.success('PDF downloaded')
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* ── Page Header ── */}
      <div className="print:hidden">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Autoconer Abstract Report</CardTitle>
                <p className="text-blue-100 mt-1 text-sm">
                  Shift-wise &amp; count-wise production abstract — As on date + Upto date
                </p>
              </div>
              <Link href="/reports">
                <Button variant="secondary" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Reports
                </Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* ── Controls + Report ── */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-6">

          {/* Controls */}
          <div className="flex flex-wrap gap-4 mb-6 print:hidden">

            {/* Date picker */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">As on Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <Button
                onClick={generateReport}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>

              {reportData && (
                <Button
                  onClick={downloadPDF}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              )}
            </div>
          </div>

          {/* ── Report Tables ── */}
          {reportData && (
            <div className="overflow-x-auto space-y-8">

              {/* Printable heading */}
              <div className="hidden print:block text-center mb-4">
                <p className="text-lg font-bold">Kayaar Exports Private Limited</p>
                <p className="text-base font-semibold">Autoconer Abstract Report</p>
                <p className="text-sm">Date: {reportData.displayDate}</p>
              </div>

              {/* ── Section 1: Shift-wise ─────────────────────────────── */}
              <div>
                <div className="flex text-sm font-medium text-gray-700 mb-1 gap-4">
                  <span>Autoconer Abstract Report as on &nbsp;<span className="font-bold">{reportData.displayDate}</span></span>
                  <span className="ml-auto">Autoconer Abstract Upto &nbsp;<span className="font-bold">{reportData.displayDate}</span></span>
                </div>
                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-blue-600 text-white text-xs">
                      <th className="border border-gray-300 px-3 py-2 text-left" rowSpan={2}>SHIFT</th>
                      <th className="border border-gray-300 px-3 py-2 text-center" colSpan={4}>As on Date</th>
                      <th className="border border-gray-300 px-3 py-2 text-center" colSpan={4}>Upto Date</th>
                    </tr>
                    <tr className="bg-blue-500 text-white text-xs">
                      {['PROD(KGS)', 'EFFI', 'RED Light', 'UTTI',
                        'PROD(KGS)', 'EFFI', 'RED Light', 'UTTI'].map((h, i) => (
                        <th key={i} className="border border-gray-300 px-3 py-2 text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.shiftData.map((row, idx) => {
                      const up = reportData.uptoShiftData.find(u => u.shift === row.shift) || {}
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-3 py-2 font-medium">{row.shift}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtProd(row.prod_kgs)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(row.effi)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(row.red_light)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(row.utti)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtProd(up.prod_kgs ?? 0)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(up.effi       ?? 0)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(up.red_light  ?? 0)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(up.utti       ?? 0)}</td>
                        </tr>
                      )
                    })}
                    <tr className="font-bold bg-gray-100">
                      <td className="border border-gray-300 px-3 py-2">TOTAL :</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{fmtProd(reportData.total.prod_kgs)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(reportData.total.effi)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(reportData.total.red_light)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(reportData.total.utti)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{fmtProd(reportData.uptoTotal.prod_kgs)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(reportData.uptoTotal.effi)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(reportData.uptoTotal.red_light)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(reportData.uptoTotal.utti)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── Section 2: Count-wise ─────────────────────────────── */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Autoconer Count Abstract Upto &nbsp;<span className="font-bold">{reportData.displayDate}</span>
                </p>
                <div className="grid grid-cols-2 gap-6">

                  {/* ON DATE */}
                  <div>
                    <div className="text-xs font-semibold text-center bg-blue-50 border border-gray-300 px-2 py-1">
                      ON DATE
                    </div>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-blue-600 text-white">
                          <th className="border border-gray-300 px-3 py-2 text-left">CountName</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Prodnkgs</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">Effi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.countOnDate.rows.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2">{r.count_name}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right">{fmtProd(r.prod_kgs)}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(r.effi)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-gray-100">
                          <td className="border border-gray-300 px-3 py-2">{reportData.countOnDate.total.count_name}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtProd(reportData.countOnDate.total.prod_kgs)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(reportData.countOnDate.total.effi)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* UP TO DATE */}
                  <div>
                    <div className="text-xs font-semibold text-center bg-blue-50 border border-gray-300 px-2 py-1">
                      UP TO DATE
                    </div>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-blue-600 text-white">
                          <th className="border border-gray-300 px-3 py-2 text-left">CountName</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">UProdnkgs</th>
                          <th className="border border-gray-300 px-3 py-2 text-right">UEffi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.countUptoDate.rows.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2">{r.count_name}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right">{fmtProd(r.prod_kgs)}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(r.effi)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-gray-100">
                          <td className="border border-gray-300 px-3 py-2">{reportData.countUptoDate.total.count_name}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtProd(reportData.countUptoDate.total.prod_kgs)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmt2(reportData.countUptoDate.total.effi)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>

              {/* Signatories — order: AM(P) · GM · M.D */}
              <div className="mt-10 pt-4 border-t flex justify-around text-sm font-semibold print:border-black">
                <span>AM(P)</span>
                <span>GM</span>
                <span>M.D</span>
              </div>

            </div>
          )}

          {/* Empty state */}
          {!reportData && !loading && (
            <div className="text-center text-gray-500 py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Select a date and click "Generate Report" to view the abstract</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center text-gray-500 py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p>Generating report...</p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
