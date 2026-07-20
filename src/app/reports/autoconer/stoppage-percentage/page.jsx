'use client'

import { useState, Fragment } from 'react'
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
import { fetchAutoconerStoppagePercentageReport } from './actions'

export default function AutoconerStoppagePercentageReport() {
  const [fromDate, setFromDate]     = useState(new Date())
  const [toDate, setToDate]         = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading]       = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────
  const formatDateForQuery = (date) => {
    const year  = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day   = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const pct = (val) =>
    typeof val === 'number' ? val.toFixed(2) : '0.00'

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
      const result = await fetchAutoconerStoppagePercentageReport(
        formatDateForQuery(fromDate),
        formatDateForQuery(toDate),
      )

      if (result.success) {
        setReportData(result)
        toast.success('Report generated successfully')
      } else {
        toast.error(result.message || result.error || 'Failed to generate report')
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
      const doc       = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPos        = 15

      // ── Header ─────────────────────────────────────────────────────────
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', pageWidth / 2, yPos, { align: 'center' })
      yPos += 7

      doc.setFontSize(11)
      doc.text('Stoppage Percentage Report For Autoconer', pageWidth / 2, yPos, { align: 'center' })
      yPos += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const { from, to } = reportData.dateRange
      const dateText = from === to
        ? `Date: ${from}`
        : `From  ${from}  To  ${to}`
      doc.text(dateText, pageWidth / 2, yPos, { align: 'center' })
      yPos += 8

      // ── Build table body ────────────────────────────────────────────────
      const tableBody = []

      reportData.reportData.forEach((head) => {
        // Category header row — spans all columns
        tableBody.push([
          {
            content: head.headName.toUpperCase(),
            colSpan: 7,
            styles: { fontStyle: 'bold', fillColor: [219, 234, 254], halign: 'left' },
          },
        ])

        // Reason rows
        head.details.forEach((detail) => {
          tableBody.push([
            detail.slNo.toString(),
            detail.code,
            detail.reasonName,
            pct(detail.shifts[1].percentage),
            pct(detail.shifts[2].percentage),
            pct(detail.shifts[3].percentage),
            pct(detail.shifts.total.percentage),
          ])
        })

        // Category "Total :" row
        tableBody.push([
          '',
          '',
          { content: 'Total :', styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: pct(head.shifts[1].percentage),     styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: pct(head.shifts[2].percentage),     styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: pct(head.shifts[3].percentage),     styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: pct(head.shifts.total.percentage),  styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
        ])
      })

      // Net Total row
      tableBody.push([
        '',
        '',
        { content: 'Net Total :', styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } },
        { content: pct(reportData.netTotal[1].percentage),     styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } },
        { content: pct(reportData.netTotal[2].percentage),     styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } },
        { content: pct(reportData.netTotal[3].percentage),     styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } },
        { content: pct(reportData.netTotal.total.percentage),  styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } },
      ])

      autoTable(doc, {
        head: [
          [
            { content: 'SL No',       rowSpan: 1, styles: { halign: 'center' } },
            { content: '',            rowSpan: 1 },
            { content: 'Reasons',     rowSpan: 1 },
            { content: 'I Shift %',   rowSpan: 1, styles: { halign: 'center' } },
            { content: 'II Shift %',  rowSpan: 1, styles: { halign: 'center' } },
            { content: 'III Shift %', rowSpan: 1, styles: { halign: 'center' } },
            { content: 'Total %',     rowSpan: 1, styles: { halign: 'center' } },
          ],
        ],
        body: tableBody,
        startY: yPos,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [37, 99, 235],   // blue-600
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 12, halign: 'center' },
          2: { cellWidth: 80 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 22, halign: 'center' },
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
        doc.text('AM(P)', pageWidth * 0.2, sigY, { align: 'center' })
        doc.text('GM',    pageWidth * 0.5, sigY, { align: 'center' })
        doc.text('M.D',   pageWidth * 0.8, sigY, { align: 'center' })

        doc.setFontSize(7)
        doc.setFont('helvetica', 'italic')
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
      }

      const safeFrom = from.replace(/ /g, '_')
      const safeTo   = to.replace(/ /g, '_')
      doc.save(`Autoconer_Stoppage_Percentage_${safeFrom}_to_${safeTo}.pdf`)
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
                <CardTitle className="text-2xl">Autoconer Stoppage Percentage Report</CardTitle>
                <p className="text-blue-100 mt-1 text-sm">
                  Stoppage % per reason per shift — grouped by category
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
                <p className="text-base font-semibold">Stoppage Percentage Report For Autoconer</p>
                <p className="text-sm">
                  {reportData.dateRange.from === reportData.dateRange.to
                    ? `Date: ${reportData.dateRange.from}`
                    : `From  ${reportData.dateRange.from}  To  ${reportData.dateRange.to}`}
                </p>
              </div>

              <table className="min-w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-gray-300 px-2 py-2 text-center w-12">SL No</th>
                    <th className="border border-gray-300 px-2 py-2 text-center w-16"></th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Reasons</th>
                    <th className="border border-gray-300 px-3 py-2 text-center w-24">I Shift %</th>
                    <th className="border border-gray-300 px-3 py-2 text-center w-24">II Shift %</th>
                    <th className="border border-gray-300 px-3 py-2 text-center w-24">III Shift %</th>
                    <th className="border border-gray-300 px-3 py-2 text-center w-24">Total %</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.reportData.map((head, headIdx) => (
                    <Fragment key={`head-${headIdx}`}>

                      {/* Category header row */}
                      <tr className="bg-blue-50 font-bold">
                        <td
                          colSpan={7}
                          className="border border-gray-300 px-3 py-2"
                        >
                          {head.headName.toUpperCase()}
                        </td>
                      </tr>

                      {/* Reason rows */}
                      {head.details.map((detail, detailIdx) => (
                        <tr key={`detail-${headIdx}-${detailIdx}`} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1 text-center">
                            {detail.slNo}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center text-xs font-medium">
                            {detail.code}
                          </td>
                          <td className="border border-gray-300 px-3 py-1">
                            {detail.reasonName}
                          </td>
                          <td className="border border-gray-300 px-3 py-1 text-center">
                            {pct(detail.shifts[1].percentage)}
                          </td>
                          <td className="border border-gray-300 px-3 py-1 text-center">
                            {pct(detail.shifts[2].percentage)}
                          </td>
                          <td className="border border-gray-300 px-3 py-1 text-center">
                            {pct(detail.shifts[3].percentage)}
                          </td>
                          <td className="border border-gray-300 px-3 py-1 text-center font-semibold">
                            {pct(detail.shifts.total.percentage)}
                          </td>
                        </tr>
                      ))}

                      {/* Category Total row */}
                      <tr className="font-bold bg-gray-100">
                        <td className="border border-gray-300 px-2 py-1" />
                        <td className="border border-gray-300 px-2 py-1" />
                        <td className="border border-gray-300 px-3 py-1 pl-6">Total :</td>
                        <td className="border border-gray-300 px-3 py-1 text-center">
                          {pct(head.shifts[1].percentage)}
                        </td>
                        <td className="border border-gray-300 px-3 py-1 text-center">
                          {pct(head.shifts[2].percentage)}
                        </td>
                        <td className="border border-gray-300 px-3 py-1 text-center">
                          {pct(head.shifts[3].percentage)}
                        </td>
                        <td className="border border-gray-300 px-3 py-1 text-center">
                          {pct(head.shifts.total.percentage)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}

                  {/* Net Total row */}
                  <tr className="font-bold bg-blue-100">
                    <td className="border border-gray-300 px-2 py-1" />
                    <td className="border border-gray-300 px-2 py-1" />
                    <td className="border border-gray-300 px-3 py-1 pl-6">Net Total :</td>
                    <td className="border border-gray-300 px-3 py-1 text-center">
                      {pct(reportData.netTotal[1].percentage)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center">
                      {pct(reportData.netTotal[2].percentage)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center">
                      {pct(reportData.netTotal[3].percentage)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center">
                      {pct(reportData.netTotal.total.percentage)}
                    </td>
                  </tr>
                </tbody>
              </table>

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
              <p>Select a date range and click "Generate Report" to view stoppage data</p>
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
