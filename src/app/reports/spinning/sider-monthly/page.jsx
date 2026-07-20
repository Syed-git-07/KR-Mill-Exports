'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarIcon, Download, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fetchSiderMonthlyReport } from './actions'

export default function SiderMonthlyReport() {
  const [fromDate, setFromDate] = useState(new Date())
  const [toDate, setToDate] = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerateReport = async () => {
    if (!fromDate || !toDate) {
      toast.error('Please select both from and to dates')
      return
    }

    if (fromDate > toDate) {
      toast.error('From date cannot be after to date')
      return
    }

    setLoading(true)
    try {
      const result = await fetchSiderMonthlyReport(fromDate, toDate)
      
      if (result.success) {
        setReportData(result.data)
        toast.success('Report generated successfully')
      } else {
        toast.error(result.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('An error occurred while generating the report')
    } finally {
      setLoading(false)
    }
  }

  const exportToPDF = () => {
    if (!reportData || !reportData.reportData) {
      toast.error('No data to export')
      return
    }

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Add company name and report title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', pageWidth / 2, 15, { align: 'center' })
      
      doc.setFontSize(12)
      doc.text(
        `Sider Monthly Spinning Report From ${format(fromDate, 'dd-MM-yyyy')} To ${format(toDate, 'dd-MM-yyyy')}`, 
        pageWidth / 2, 
        23, 
        { align: 'center' }
      )

      // Prepare table data
      const tableData = []
      
      reportData.reportData.forEach((frame) => {
        const row = [
          frame.frameNo,
          // Shift 1
          frame.shifts[1].siderName || 'NIL',
          frame.shifts[1].doj || '01-Jan-00',
          frame.shifts[1].waste.toFixed(2),
          frame.shifts[1].wastePercent.toFixed(2),
          // Shift 2
          frame.shifts[2].siderName || 'NIL',
          frame.shifts[2].doj || '01-Jan-00',
          frame.shifts[2].waste.toFixed(2),
          frame.shifts[2].wastePercent.toFixed(2),
          // Shift 3
          frame.shifts[3].siderName || 'NIL',
          frame.shifts[3].doj || '01-Jan-00',
          frame.shifts[3].waste.toFixed(2),
          frame.shifts[3].wastePercent.toFixed(2)
        ]
        tableData.push(row)
      })

      // Add totals row
      if (reportData.totals) {
        tableData.push([
          'TOTALS',
          '',
          '',
          reportData.totals.shift1.waste.toFixed(2),
          reportData.totals.shift1.wastePercent.toFixed(2),
          '',
          '',
          reportData.totals.shift2.waste.toFixed(2),
          reportData.totals.shift2.wastePercent.toFixed(2),
          '',
          '',
          reportData.totals.shift3.waste.toFixed(2),
          reportData.totals.shift3.wastePercent.toFixed(2)
        ])
      }

      // Create table with three shift columns
      autoTable(doc, {
        startY: 30,
        head: [[
          { content: '', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [139, 92, 246] } },
          { content: '1', colSpan: 4, styles: { halign: 'center', fillColor: [139, 92, 246] } },
          { content: '2', colSpan: 4, styles: { halign: 'center', fillColor: [139, 92, 246] } },
          { content: '3', colSpan: 4, styles: { halign: 'center', fillColor: [139, 92, 246] } }
        ], [
          'FRAME',
          'SIDER NAME',
          'D.O.J',
          'WASTE',
          'WASTE %',
          'SIDER NAME',
          'D.O.J',
          'WASTE',
          'WASTE %',
          'SIDER NAME',
          'D.O.J',
          'WASTE',
          'WASTE %'
        ]],
        body: tableData,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          halign: 'center'
        },
        headStyles: {
          fillColor: [139, 92, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 20 },
          1: { cellWidth: 22 },
          2: { cellWidth: 18 },
          3: { cellWidth: 15 },
          4: { cellWidth: 15 },
          5: { cellWidth: 22 },
          6: { cellWidth: 18 },
          7: { cellWidth: 15 },
          8: { cellWidth: 15 },
          9: { cellWidth: 22 },
          10: { cellWidth: 18 },
          11: { cellWidth: 15 },
          12: { cellWidth: 15 }
        },
        didDrawCell: (data) => {
          // Make the totals row bold
          if (data.row.index === tableData.length - 1 && data.section === 'body') {
            doc.setFont('helvetica', 'bold')
          }
        },
        didParseCell: (data) => {
          // Style the TOTALS row
          if (data.row.index === tableData.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [243, 244, 246]
          }
        },
        margin: { top: 30, left: 10, right: 10 },
        didDrawPage: (data) => {
          // Add footer with page numbers
          const pageCount = doc.internal.getNumberOfPages()
          doc.setFontSize(8)
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          )
          
          // Add generated timestamp
          doc.text(
            `Generated on: ${format(new Date(), 'dd-MM-yyyy HH:mm:ss')}`,
            pageWidth - 15,
            pageHeight - 10,
            { align: 'right' }
          )
        }
      })

      // Save the PDF
      doc.save(`Sider_Monthly_Report_${format(fromDate, 'dd-MM-yyyy')}_to_${format(toDate, 'dd-MM-yyyy')}.pdf`)
      toast.success('PDF exported successfully')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('Failed to export PDF')
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Sider Monthly Spinning Report</CardTitle>
              <p className="text-purple-100 mt-2">
                Sider performance across shifts with waste metrics for selected date range
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

      {/* Controls & Content */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-6">
          {/* Date Selection */}
          <div className="flex flex-wrap gap-4 mb-6 print:hidden">
            {/* From Date Picker */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date Picker */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={setToDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2">
              <Button
                onClick={handleGenerateReport}
                disabled={loading || !fromDate || !toDate}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>

              {reportData && (
                <Button
                  onClick={exportToPDF}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>

          {/* Report Data */}
          {reportData && (
            <div className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Report Period: {format(fromDate, 'dd-MM-yyyy')} to {format(toDate, 'dd-MM-yyyy')}
                </h3>
              </div>
              <div className="overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-purple-600 hover:bg-purple-600">
                      <TableHead rowSpan={2} className="text-white border-r border-white text-center align-middle font-bold">
                        FRAME
                      </TableHead>
                      <TableHead colSpan={4} className="text-white border-r border-white text-center font-bold">
                        Shift 1
                      </TableHead>
                      <TableHead colSpan={4} className="text-white border-r border-white text-center font-bold">
                        Shift 2
                      </TableHead>
                      <TableHead colSpan={4} className="text-white text-center font-bold">
                        Shift 3
                      </TableHead>
                    </TableRow>
                    <TableRow className="bg-purple-500 hover:bg-purple-500">
                      {/* Shift 1 */}
                      <TableHead className="text-white border-r border-white text-center font-bold">SIDER NAME</TableHead>
                      <TableHead className="text-white border-r border-white text-center font-bold">D.O.J</TableHead>
                      <TableHead className="text-white border-r border-white text-center font-bold">WASTE</TableHead>
                      <TableHead className="text-white border-r border-white text-center font-bold">WASTE %</TableHead>
                      {/* Shift 2 */}
                      <TableHead className="text-white border-r border-white text-center font-bold">SIDER NAME</TableHead>
                      <TableHead className="text-white border-r border-white text-center font-bold">D.O.J</TableHead>
                      <TableHead className="text-white border-r border-white text-center font-bold">WASTE</TableHead>
                      <TableHead className="text-white border-r border-white text-center font-bold">WASTE %</TableHead>
                      {/* Shift 3 */}
                      <TableHead className="text-white border-r border-white text-center font-bold">SIDER NAME</TableHead>
                      <TableHead className="text-white border-r border-white text-center font-bold">D.O.J</TableHead>
                      <TableHead className="text-white border-r border-white text-center font-bold">WASTE</TableHead>
                      <TableHead className="text-white text-center font-bold">WASTE %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.reportData.map((frame, index) => (
                      <TableRow key={index} className="hover:bg-purple-50">
                        <TableCell className="font-bold border-r text-center">{frame.frameNo}</TableCell>
                        
                        {/* Shift 1 */}
                        <TableCell className="border-r text-center">{frame.shifts[1].siderName || 'NIL'}</TableCell>
                        <TableCell className="border-r text-center">{frame.shifts[1].doj || '01-Jan-00'}</TableCell>
                        <TableCell className="border-r text-right">{frame.shifts[1].waste.toFixed(2)}</TableCell>
                        <TableCell className="border-r text-right">{frame.shifts[1].wastePercent.toFixed(2)}</TableCell>
                        
                        {/* Shift 2 */}
                        <TableCell className="border-r text-center">{frame.shifts[2].siderName || 'NIL'}</TableCell>
                        <TableCell className="border-r text-center">{frame.shifts[2].doj || '01-Jan-00'}</TableCell>
                        <TableCell className="border-r text-right">{frame.shifts[2].waste.toFixed(2)}</TableCell>
                        <TableCell className="border-r text-right">{frame.shifts[2].wastePercent.toFixed(2)}</TableCell>
                        
                        {/* Shift 3 */}
                        <TableCell className="border-r text-center">{frame.shifts[3].siderName || 'NIL'}</TableCell>
                        <TableCell className="border-r text-center">{frame.shifts[3].doj || '01-Jan-00'}</TableCell>
                        <TableCell className="border-r text-right">{frame.shifts[3].waste.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{frame.shifts[3].wastePercent.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Totals Row */}
                    {reportData.totals && (
                      <TableRow className="bg-gray-100 font-bold hover:bg-gray-100">
                        <TableCell className="border-r text-center">TOTALS</TableCell>
                        
                        {/* Shift 1 */}
                        <TableCell className="border-r"></TableCell>
                        <TableCell className="border-r"></TableCell>
                        <TableCell className="border-r text-right">{reportData.totals.shift1.waste.toFixed(2)}</TableCell>
                        <TableCell className="border-r text-right">{reportData.totals.shift1.wastePercent.toFixed(2)}</TableCell>
                        
                        {/* Shift 2 */}
                        <TableCell className="border-r"></TableCell>
                        <TableCell className="border-r"></TableCell>
                        <TableCell className="border-r text-right">{reportData.totals.shift2.waste.toFixed(2)}</TableCell>
                        <TableCell className="border-r text-right">{reportData.totals.shift2.wastePercent.toFixed(2)}</TableCell>
                        
                        {/* Shift 3 */}
                        <TableCell className="border-r"></TableCell>
                        <TableCell className="border-r"></TableCell>
                        <TableCell className="border-r text-right">{reportData.totals.shift3.waste.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{reportData.totals.shift3.wastePercent.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* No Data Message */}
          {!loading && !reportData && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                Select date range and click "Generate Report" to view the sider monthly report
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
