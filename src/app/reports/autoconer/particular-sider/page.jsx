'use client'

import { useState } from 'react'
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
import EmployeeAutocomplete from '@/components/ui/employee-autocomplete'
import {
  generateAutoconerParticularSiderReportAction
} from '@/app/actions/autoconer-reports'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Autoconer Particular Sider Report Page
 * Shows individual sider performance across date range
 */
export default function AutoconerParticularSiderReportPage() {
  const [empName, setEmpName] = useState('')
  const [fromDate, setFromDate] = useState(new Date())
  const [toDate, setToDate] = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerateReport = async () => {
    if (!empName) {
      toast.error('Please select an employee')
      return
    }

    if (!fromDate || !toDate) {
      toast.error('Please select from and to dates')
      return
    }

    if (fromDate > toDate) {
      toast.error('From date must be before or equal to to date')
      return
    }

    setIsLoading(true)
    try {
      const result = await generateAutoconerParticularSiderReportAction(empName, fromDate, toDate)
      
      if (!result.success) {
        toast.error(result.message || 'Failed to generate report')
        return
      }

      setReportData(result.data)
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
      doc.text('AutoConer Particular Sider Report', pageWidth / 2, yPos, { align: 'center' })
      yPos += 6

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const fromDateStr = format(new Date(reportData.period.from), 'dd-MM-yyyy')
      const toDateStr = format(new Date(reportData.period.to), 'dd-MM-yyyy')
      doc.text(`Period: ${fromDateStr} to ${toDateStr}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      // Horizontal separator
      doc.setLineWidth(0.3)
      doc.line(14, yPos, pageWidth - 14, yPos)
      yPos += 8

      // Employee Information
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Employee Information', 14, yPos)
      yPos += 5

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Sider Name: ${reportData.employee.name}`, 14, yPos)
      yPos += 5

      if (reportData.employee.doj) {
        const dojDate = format(new Date(reportData.employee.doj), 'dd-MMM-yy')
        doc.text(`Date of Joining: ${dojDate}`, 14, yPos)
        yPos += 5
      }

      doc.text(`Token No: ${reportData.employee.emp_code || 'N/A'}`, 14, yPos)
      yPos += 8

      // Performance Data Table
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Performance Data', 14, yPos)
      yPos += 5

      // Table data
      const tableData = reportData.performance.map((day) => [
        format(new Date(day.date), 'dd-MMM-yy'),
        day.drum.toFixed(2),
        day.prod_kgs.toFixed(2),
        day.effi_percent.toFixed(2),
        day.uti_percent.toFixed(2),
        day.red_light.toFixed(2)
      ])

      // Add totals row
      tableData.push([
        'TOTAL',
        reportData.totals.drum.toFixed(2),
        reportData.totals.prod_kgs.toFixed(2),
        reportData.totals.effi_percent.toFixed(2),
        reportData.totals.uti_percent.toFixed(2),
        reportData.totals.red_light.toFixed(2)
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Drum', 'Prod.Kgs', 'Effi %', 'UTI %', 'Red']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [22, 163, 74], // green-600
          textColor: 255,
          fontStyle: 'bold',
          halign: 'left'
        },
        styles: {
          fontSize: 9,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 25, halign: 'right' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25, halign: 'right' }
        },
        didParseCell: function(data) {
          // Bold the TOTAL row
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [240, 240, 240]
          }
        }
      })

      yPos = doc.lastAutoTable.finalY + 10

      // Add designations footer
      yPos = doc.internal.pageSize.getHeight() - 25
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setLineWidth(0.3)
      doc.line(14, yPos - 5, pageWidth - 14, yPos - 5)
      
      const signatoriesText = 'AM(P)          GM          MD'
      doc.text(signatoriesText, pageWidth / 2, yPos, { align: 'center' })

      // Footer
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text(
        'Report generated for Kayaar Exports Private Limited',
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )

      const filename = `Autoconer_Particular_Sider_${reportData.employee.name.replace(/\s+/g, '_')}_${fromDateStr}_to_${toDateStr}.pdf`
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
        <Card className="bg-linear-to-r from-green-600 to-green-700 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Autoconer Particular Sider Report</CardTitle>
                <p className="text-green-100 mt-2">
                  Individual sider performance analysis across date range
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

      {/* Filter Section - Hide on print */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">Report Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Employee Search */}
            <div className="flex flex-col gap-2 flex-1 min-w-62.5">
              <label className="text-sm font-medium">Select Employee</label>
              <EmployeeAutocomplete
                value={empName}
                onChange={setEmpName}
                placeholder="Type employee name..."
              />
            </div>

            {/* From Date Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-50 justify-start text-left font-normal',
                      !fromDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, 'dd-MMM-yyyy') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => date && setFromDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-50 justify-start text-left font-normal',
                      !toDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, 'dd-MMM-yyyy') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => date && setToDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerateReport}
              disabled={isLoading || !empName || !fromDate || !toDate}
              className="bg-green-600 hover:bg-green-700"
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
            <h2 className="text-xl font-semibold mb-2">AutoConer Particular Sider Report</h2>
            <p className="text-sm font-medium">
              Period: {format(new Date(reportData.period.from), 'dd-MM-yyyy')} to {format(new Date(reportData.period.to), 'dd-MM-yyyy')}
            </p>
          </div>

          {/* Employee Information */}
          <div className="mb-6 bg-gray-50 p-4 rounded border border-gray-200 print:bg-white print:border-gray-400">
            <h3 className="text-lg font-semibold mb-3">Employee Information</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Sider Name:</span>
                <span className="ml-2">{reportData.employee.name}</span>
              </div>
              {reportData.employee.doj && (
                <div>
                  <span className="font-medium">Date of Joining:</span>
                  <span className="ml-2">{format(new Date(reportData.employee.doj), 'dd-MMM-yy')}</span>
                </div>
              )}
              <div>
                <span className="font-medium">Token No:</span>
                <span className="ml-2">{reportData.employee.emp_code || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Performance Data Table */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Performance Data</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-green-600 text-white">
                    <th className="border border-gray-300 px-3 py-2 text-left">Date</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Drum</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Prod.Kgs</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Effi %</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">UTI %</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Red</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.performance.map((day, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2">
                        {format(new Date(day.date), 'dd-MMM-yy')}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {day.drum.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {day.prod_kgs.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {day.effi_percent.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {day.uti_percent.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {day.red_light.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border border-gray-300 px-3 py-2">TOTAL</td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {reportData.totals.drum.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {reportData.totals.prod_kgs.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {reportData.totals.effi_percent.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {reportData.totals.uti_percent.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {reportData.totals.red_light.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

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
    </div>
  )
}
