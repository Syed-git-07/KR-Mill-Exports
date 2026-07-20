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
import { fetchAutoconerCountWiseProductionReport } from './actions'

export default function AutoconerCountWiseProductionReport() {
  const [fromDate, setFromDate]   = useState(new Date())
  const [toDate, setToDate]       = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading]     = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────
  const formatDateForQuery = (date) => {
    const year  = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day   = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // ── Phase 1: Generate ──────────────────────────────────────────────────
  const generateReport = async () => {
    if (!fromDate || !toDate) {
      toast.error('Please select both from and to dates')
      return
    }
    if (toDate < fromDate) {
      toast.error('To date cannot be earlier than from date')
      return
    }

    setLoading(true)
    try {
      const result = await fetchAutoconerCountWiseProductionReport(
        formatDateForQuery(fromDate),
        formatDateForQuery(toDate),
      )

      if (result.success) {
        setReportData(result.data)
        toast.success('Report generated successfully')
      } else {
        toast.error(result.error || 'Failed to generate report')
        setReportData(null)
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  // ── Phase 2: PDF Download ──────────────────────────────────────────────
  const downloadPDF = () => {
    if (!reportData) return

    try {
      // Use landscape for many count columns, portrait for ≤3 counts
      const orientation = reportData.uniqueCounts.length > 3 ? 'landscape' : 'portrait'
      const doc = new jsPDF(orientation, 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPos = 15

      // ── Header ─────────────────────────────────────────────────────────
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', pageWidth / 2, yPos, { align: 'center' })
      yPos += 7

      doc.setFontSize(12)
      doc.text('Autoconer Production Report', pageWidth / 2, yPos, { align: 'center' })
      yPos += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const dateRangeText = reportData.dateRange.from === reportData.dateRange.to
        ? `Date: ${reportData.dateRange.from}`
        : `From ${reportData.dateRange.from}  To  ${reportData.dateRange.to}`
      doc.text(dateRangeText, pageWidth / 2, yPos, { align: 'center' })
      yPos += 8

      // ── Table headers ──────────────────────────────────────────────────
      const headers = [
        'Date',
        ...reportData.uniqueCounts,
        'Total',
      ]

      // ── Table rows ─────────────────────────────────────────────────────
      const tableData = reportData.reportData.map(row => [
        row.dateDisplay,
        ...reportData.uniqueCounts.map(c =>
          row.counts[c] !== undefined ? row.counts[c].toFixed(2) : '0.00'
        ),
        row.rowTotal.toFixed(2),
      ])

      // Grand total row
      tableData.push([
        'Total',
        ...reportData.uniqueCounts.map(c =>
          reportData.grandTotal.counts[c].toFixed(2)
        ),
        reportData.grandTotal.rowTotal.toFixed(2),
      ])

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: yPos,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          halign: 'center',
          valign: 'middle',
        },
        headStyles: {
          fillColor: [37, 99, 235],   // blue-600
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
        },
        didParseCell(data) {
          // Grand total row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle  = 'bold'
            data.cell.styles.fillColor  = [219, 234, 254]  // blue-100
          }
        },
      })

      // ── Footer: signatures on every page ──────────────────────────────
      const pageCount  = doc.internal.getNumberOfPages()
      const pageHeight = doc.internal.pageSize.getHeight()

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const sigY = pageHeight - 20
        doc.setLineWidth(0.3)
        doc.line(14, sigY - 4, pageWidth - 14, sigY - 4)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text('AM(P)', pageWidth * 0.2,  sigY, { align: 'center' })
        doc.text('GM',    pageWidth * 0.5,  sigY, { align: 'center' })
        doc.text('M.D',   pageWidth * 0.8,  sigY, { align: 'center' })

        doc.setFontSize(7)
        doc.setFont('helvetica', 'italic')
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
      }

      // ── Save ───────────────────────────────────────────────────────────
      const safeFrom = reportData.dateRange.from.replace(/ /g, '_')
      const safeTo   = reportData.dateRange.to.replace(/ /g, '_')
      doc.save(`Autoconer_Count_Production_${safeFrom}_to_${safeTo}.pdf`)
      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF')
    }
  }

  // ── Phase 3: Render ────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* ── Page Header ── */}
      <div className="print:hidden">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Autoconer Count-wise Production Report</CardTitle>
                <p className="text-blue-100 mt-1 text-sm">
                  Total production per count per date (all shifts combined)
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

      {/* ── Controls ── */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 mb-6 print:hidden">

            {/* From date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(fromDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(d) => d && setFromDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(toDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(d) => d && setToDate(d)}
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

          {/* ── Phase 4: Report Table ── */}
          {reportData && (
            <div className="overflow-x-auto">

              {/* Printable heading */}
              <div className="hidden print:block text-center mb-4">
                <p className="text-lg font-bold">Kayaar Exports Private Limited</p>
                <p className="text-base font-semibold">Autoconer Production Report</p>
                <p className="text-sm">
                  {reportData.dateRange.from === reportData.dateRange.to
                    ? `Date: ${reportData.dateRange.from}`
                    : `From ${reportData.dateRange.from}  To  ${reportData.dateRange.to}`}
                </p>
              </div>

              <table className="min-w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                    {reportData.uniqueCounts.map((count, i) => (
                      <th key={i} className="border border-gray-300 px-4 py-2 text-center">
                        {count}
                      </th>
                    ))}
                    <th className="border border-gray-300 px-4 py-2 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.reportData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        {row.dateDisplay}
                      </td>
                      {reportData.uniqueCounts.map((count, colIndex) => (
                        <td key={colIndex} className="border border-gray-300 px-4 py-2 text-center">
                          {row.counts[count] !== undefined ? row.counts[count].toFixed(2) : '0.00'}
                        </td>
                      ))}
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold">
                        {row.rowTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {/* Grand Total */}
                  <tr className="font-bold bg-blue-100">
                    <td className="border border-gray-300 px-4 py-2">Total</td>
                    {reportData.uniqueCounts.map((count, i) => (
                      <td key={i} className="border border-gray-300 px-4 py-2 text-center">
                        {reportData.grandTotal.counts[count].toFixed(2)}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {reportData.grandTotal.rowTotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatories */}
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
              <p>Select a date range and click "Generate Report" to view production data</p>
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
