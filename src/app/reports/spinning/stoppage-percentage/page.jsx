'use client'

import { useState, Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon, Printer, Download, FileText, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  generateSpinningStoppageReportAction
} from '@/app/actions/spinning-reports'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Spinning Stoppage Percentage Report Page
 * Displays stopped spindles and percentages by category and shift
 */
export default function SpinningStoppageReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerateReport = async () => {
    if (!selectedDate) {
      toast.error('Please select a date')
      return
    }

    setIsLoading(true)
    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      const data = await generateSpinningStoppageReportAction(formattedDate)
      
      if (!data.success) {
        toast.error(data.message || 'No data found for the selected date')
        setReportData(null)
        return
      }

      setReportData(data)
      toast.success('Report generated successfully')
    } catch (err) {
      console.error('Error generating report:', err)
      toast.error('Error generating report: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = () => {
    if (!reportData) {
      toast.error('No report data available')
      return
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPos = 15

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', pageWidth / 2, yPos, { align: 'center' })
      yPos += 7

      doc.setFontSize(14)
      doc.text('Spinning Stoppage Percentage Report', pageWidth / 2, yPos, { align: 'center' })
      yPos += 6

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${format(new Date(reportData.date), 'dd-MM-yyyy')}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      // Build table data
      const tableData = []
      let slNo = 1

      reportData.reportData.forEach((head) => {
        // Head row (category label only, no data)
        tableData.push([
          { content: slNo.toString(), rowSpan: 1 },
          { content: head.headName.toUpperCase(), colSpan: 9, styles: { fontStyle: 'bold', fillColor: [243, 232, 255] } }
        ])

        // Detail rows
        head.details.forEach((detail) => {
          tableData.push([
            '',
            '  ' + detail.fullName,
            Math.round(detail.shifts[1].stoppedSpindles).toString(),
            detail.shifts[1].percentage.toFixed(2),
            Math.round(detail.shifts[2].stoppedSpindles).toString(),
            detail.shifts[2].percentage.toFixed(2),
            Math.round(detail.shifts[3].stoppedSpindles).toString(),
            detail.shifts[3].percentage.toFixed(2),
            Math.round(detail.shifts.total.stoppedSpindles).toString(),
            detail.shifts.total.percentage.toFixed(2),
          ])
        })

        // Head Total row
        tableData.push([
          '',
          { content: '  Total :', styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: Math.round(head.shifts[1].stoppedSpindles).toString(), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: head.shifts[1].percentage.toFixed(2), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: Math.round(head.shifts[2].stoppedSpindles).toString(), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: head.shifts[2].percentage.toFixed(2), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: Math.round(head.shifts[3].stoppedSpindles).toString(), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: head.shifts[3].percentage.toFixed(2), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: Math.round(head.shifts.total.stoppedSpindles).toString(), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
          { content: head.shifts.total.percentage.toFixed(2), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
        ])

        slNo++
      })

      // Grand Total row
      tableData.push([
        '-',
        'GRAND TOTAL',
        Math.round(reportData.grandTotal.shifts[1].stoppedSpindles).toString(),
        reportData.grandTotal.shifts[1].percentage.toFixed(2),
        Math.round(reportData.grandTotal.shifts[2].stoppedSpindles).toString(),
        reportData.grandTotal.shifts[2].percentage.toFixed(2),
        Math.round(reportData.grandTotal.shifts[3].stoppedSpindles).toString(),
        reportData.grandTotal.shifts[3].percentage.toFixed(2),
        Math.round(reportData.grandTotal.shifts.total.stoppedSpindles).toString(),
        reportData.grandTotal.shifts.total.percentage.toFixed(2),
      ])

      autoTable(doc, {
        startY: yPos,
        head: [[
          { content: 'SL No', rowSpan: 2 },
          { content: 'Reasons', rowSpan: 2 },
          { content: 'I Shift', colSpan: 2 },
          { content: 'II Shift', colSpan: 2 },
          { content: 'III Shift', colSpan: 2 },
          { content: 'Total', colSpan: 2 },
        ], [
          'Spl', '%', 'Spl', '%', 'Spl', '%', 'Spl', '%'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [124, 58, 237], // purple-600
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 50 },
          2: { cellWidth: 14, halign: 'center' },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 14, halign: 'center' },
          5: { cellWidth: 14, halign: 'center' },
          6: { cellWidth: 14, halign: 'center' },
          7: { cellWidth: 14, halign: 'center' },
          8: { cellWidth: 14, halign: 'center' },
          9: { cellWidth: 14, halign: 'center' },
        },
        didParseCell: function(data) {
          // Grand Total row styling
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [237, 233, 254] // purple-100
          }
        }
      })

      yPos = doc.lastAutoTable.finalY + 15

      // Authorization footer
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setLineWidth(0.3)
      doc.line(14, yPos, pageWidth - 14, yPos)
      yPos += 5
      doc.text('AM(P)          GM          MD', pageWidth / 2, yPos, { align: 'center' })

      const filename = `Spinning_Stoppage_${format(new Date(reportData.date), 'dd-MM-yyyy')}.pdf`
      doc.save(filename)
      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF')
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header - Hide on print */}
      <div className="print:hidden">
        <Card className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Spinning Stoppage Percentage Report</CardTitle>
                <p className="text-purple-100 mt-2">
                  Analyze stopped spindles and stoppage percentages by category and shift
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

      {/* Date Filter Section - Hide on print */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">Report Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Date Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Select Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-50 justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'dd-MMM-yyyy') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerateReport}
              disabled={isLoading || !selectedDate}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <FileText className="mr-2 h-4 w-4" />
              {isLoading ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - Show when report is generated, hide on print */}
      {reportData && (
        <div className="flex gap-2 print:hidden">
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      )}

      {/* Report Display */}
      {reportData && (
        <div className="bg-white p-8 rounded-lg shadow-sm border print:shadow-none print:border-0">
          {/* Report Header */}
          <div className="text-center mb-6 pb-4 border-b print:border-black">
            <h1 className="text-2xl font-bold mb-1">Kayaar Exports Private Limited</h1>
            <h2 className="text-xl font-semibold mb-2">Spinning Stoppage Percentage Report</h2>
            <p className="text-sm font-medium">Date: {format(new Date(reportData.date), 'dd-MM-yyyy')}</p>
          </div>

          {/* Detailed Stoppage Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-purple-600 text-white">
                  <th className="border border-gray-300 px-2 py-2 w-16" rowSpan="2">SL No</th>
                  <th className="border border-gray-300 px-3 py-2 text-left" rowSpan="2">Reasons</th>
                  <th className="border border-gray-300 px-2 py-2" colSpan="2">I Shift</th>
                  <th className="border border-gray-300 px-2 py-2" colSpan="2">II Shift</th>
                  <th className="border border-gray-300 px-2 py-2" colSpan="2">III Shift</th>
                  <th className="border border-gray-300 px-2 py-2" colSpan="2">Total</th>
                </tr>
                <tr className="bg-purple-600 text-white">
                  <th className="border border-gray-300 px-2 py-1 text-xs">Spl</th>
                  <th className="border border-gray-300 px-2 py-1 text-xs">%</th>
                  <th className="border border-gray-300 px-2 py-1 text-xs">Spl</th>
                  <th className="border border-gray-300 px-2 py-1 text-xs">%</th>
                  <th className="border border-gray-300 px-2 py-1 text-xs">Spl</th>
                  <th className="border border-gray-300 px-2 py-1 text-xs">%</th>
                  <th className="border border-gray-300 px-2 py-1 text-xs">Spl</th>
                  <th className="border border-gray-300 px-2 py-1 text-xs">%</th>
                </tr>
              </thead>
              <tbody>
                {reportData.reportData.map((head, headIndex) => (
                  <Fragment key={`head-${headIndex}`}>
                    {/* Category Head Row - Label Only, No Data */}
                    <tr className="font-bold bg-purple-50">
                      <td className="border border-gray-300 px-2 py-2 text-center">{headIndex + 1}</td>
                      <td className="border border-gray-300 px-3 py-2" colSpan="9">{head.headName.toUpperCase()}</td>
                    </tr>

                    {/* Detail Rows */}
                    {head.details.map((detail, detailIndex) => (
                      <tr key={`detail-${headIndex}-${detailIndex}`} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-2"></td>
                        <td className="border border-gray-300 px-3 py-2 pl-6">{detail.fullName}</td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {Math.round(detail.shifts[1].stoppedSpindles)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {detail.shifts[1].percentage.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {Math.round(detail.shifts[2].stoppedSpindles)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {detail.shifts[2].percentage.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {Math.round(detail.shifts[3].stoppedSpindles)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {detail.shifts[3].percentage.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {Math.round(detail.shifts.total.stoppedSpindles)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {detail.shifts.total.percentage.toFixed(2)}
                        </td>
                      </tr>
                    ))}

                    {/* Head Total Row */}
                    <tr className="font-bold bg-gray-100">
                      <td className="border border-gray-300 px-2 py-2"></td>
                      <td className="border border-gray-300 px-3 py-2 pl-6">Total :</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {Math.round(head.shifts[1].stoppedSpindles)}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {head.shifts[1].percentage.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {Math.round(head.shifts[2].stoppedSpindles)}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {head.shifts[2].percentage.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {Math.round(head.shifts[3].stoppedSpindles)}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {head.shifts[3].percentage.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {Math.round(head.shifts.total.stoppedSpindles)}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {head.shifts.total.percentage.toFixed(2)}
                      </td>
                    </tr>
                  </Fragment>
                ))}

                {/* Grand Total Row */}
                <tr className="font-bold bg-purple-100">
                  <td className="border border-gray-300 px-2 py-2 text-center">-</td>
                  <td className="border border-gray-300 px-3 py-2">GRAND TOTAL</td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {Math.round(reportData.grandTotal.shifts[1].stoppedSpindles)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {reportData.grandTotal.shifts[1].percentage.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {Math.round(reportData.grandTotal.shifts[2].stoppedSpindles)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {reportData.grandTotal.shifts[2].percentage.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {Math.round(reportData.grandTotal.shifts[3].stoppedSpindles)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {reportData.grandTotal.shifts[3].percentage.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {Math.round(reportData.grandTotal.shifts.total.stoppedSpindles)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {reportData.grandTotal.shifts.total.percentage.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Authorization Footer */}
          <div className="text-center mt-8 pt-4 border-t print:border-black">
            <p className="text-sm font-semibold space-x-20">
              <span>AM(P)</span>
              <span>GM</span>
              <span>MD</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
