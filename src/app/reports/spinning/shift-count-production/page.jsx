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
import { fetchSpinningShiftCountProductionReport } from './actions'

export default function SpinningShiftCountProductionReport() {
  const [fromDate, setFromDate] = useState(new Date())
  const [toDate, setToDate] = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Format date to YYYY-MM-DD using local timezone (not UTC)
  const formatDateForQuery = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

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
      const result = await fetchSpinningShiftCountProductionReport(
        formatDateForQuery(fromDate),
        formatDateForQuery(toDate)
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

  const downloadPDF = () => {
    if (!reportData) return

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      
      // Add title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' })
      
      doc.setFontSize(14)
      doc.text('Spinning Shift & Count wise Production Report', doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' })
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const dateRangeText = reportData.dateRange.from === reportData.dateRange.to 
        ? `Date: ${reportData.dateRange.from}`
        : `Date: ${reportData.dateRange.from} to ${reportData.dateRange.to}`
      doc.text(dateRangeText, doc.internal.pageSize.getWidth() / 2, 29, { align: 'center' })

      // Prepare table data
      const headers = [
        'Date',
        'Shift',
        ...reportData.uniqueCounts.map(count => count + '\n(Production)'),
        'Total\nProduction'
      ]

      const tableData = []
      
      reportData.reportData.forEach((row) => {
        const rowArray = [
          row.dateDisplay,
          row.shift === 'Total' ? 'Total' : row.shift.toString(),
          ...reportData.uniqueCounts.map(count => 
            row.counts[count] ? row.counts[count].toFixed(2) : '0.00'
          ),
          row.rowTotal.toFixed(2)
        ]
        tableData.push(rowArray)
      })

      // Add Grand Total row
      tableData.push([
        '',
        'GRAND TOTAL',
        ...reportData.uniqueCounts.map(count => 
          reportData.grandTotal.counts[count].toFixed(2)
        ),
        reportData.grandTotal.rowTotal.toFixed(2)
      ])

      // Generate table
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 35,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          halign: 'center',
          valign: 'middle'
        },
        headStyles: {
          fillColor: [147, 51, 234], // purple-600
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'center' }
        },
        didParseCell: function(data) {
          // Make date total rows bold
          if (data.cell.text[0] === 'Total') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [243, 244, 246] // gray-100
          }
          
          // Make grand total row bold
          if (data.cell.text[0] === 'GRAND TOTAL' || data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [237, 233, 254] // purple-100
          }
        }
      })

      // Add designations footer
      const pageCount = doc.internal.getNumberOfPages()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        
        // Add designation line and text
        let yPos = pageHeight - 25
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setLineWidth(0.3)
        doc.line(14, yPos - 5, pageWidth - 14, yPos - 5)
        
        const signatoriesText = 'AM(P)          GM          MD'
        doc.text(signatoriesText, pageWidth / 2, yPos, { align: 'center' })
        
        // Add page number and company footer
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 15,
          { align: 'center' }
        )
        doc.text(
          'Report generated for Kayaar Exports Private Limited',
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      }

      // Save PDF
      const fileName = `Spinning_Shift_Count_Production_${reportData.dateRange.from.replace(/ /g, '_')}_to_${reportData.dateRange.to.replace(/ /g, '_')}.pdf`
      doc.save(fileName)
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
                <CardTitle className="text-2xl">Spinning Shift & Count wise Production Report</CardTitle>
                <p className="text-purple-100 mt-2">
                  Production data grouped by date, shift, and count with date range support
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

      {/* Controls & Content */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-6">
          {/* Date Range Selection */}
          <div className="flex flex-wrap gap-4 mb-6 print:hidden">
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(fromDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => date && setFromDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(toDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => date && setToDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end gap-2">
              <Button 
                onClick={generateReport}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              
              {reportData && (
                <Button
                  onClick={downloadPDF}
                  variant="outline"
                  className="border-purple-600 text-purple-600 hover:bg-purple-50"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              )}
            </div>
          </div>

          {/* Report Table */}
          {reportData && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-purple-600 text-white">
                    <th className="border border-gray-300 px-4 py-2">Date</th>
                    <th className="border border-gray-300 px-4 py-2">Shift</th>
                    {reportData.uniqueCounts.map((count, index) => (
                      <th key={index} className="border border-gray-300 px-4 py-2">
                        {count}<br />
                        <span className="text-xs font-normal">(Production)</span>
                      </th>
                    ))}
                    <th className="border border-gray-300 px-4 py-2">
                      Total<br />
                      <span className="text-xs font-normal">Production</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.reportData.map((row, rowIndex) => (
                    <tr 
                      key={rowIndex}
                      className={
                        row.isDateTotal 
                          ? 'font-bold bg-gray-100' 
                          : 'hover:bg-gray-50'
                      }
                    >
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {row.dateDisplay}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {row.shift}
                      </td>
                      {reportData.uniqueCounts.map((count, colIndex) => (
                        <td 
                          key={colIndex}
                          className="border border-gray-300 px-4 py-2 text-center"
                        >
                          {row.counts[count] ? row.counts[count].toFixed(2) : '0.00'}
                        </td>
                      ))}
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold">
                        {row.rowTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Grand Total Row */}
                  <tr className="font-bold bg-purple-100">
                    <td className="border border-gray-300 px-4 py-2 text-center" colSpan="2">
                      GRAND TOTAL
                    </td>
                    {reportData.uniqueCounts.map((count, colIndex) => (
                      <td 
                        key={colIndex}
                        className="border border-gray-300 px-4 py-2 text-center"
                      >
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
              <div className="text-center mt-8 pt-4 border-t print:border-black">
                <p className="text-sm font-semibold space-x-20">
                  <span>AM(P)</span>
                  <span>GM</span>
                  <span>MD</span>
                </p>
              </div>
            </div>
          )}

          {!reportData && !loading && (
            <div className="text-center text-gray-500 py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select date range and click "Generate Report" to view production data</p>
            </div>
          )}

          {loading && (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p>Generating report...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
