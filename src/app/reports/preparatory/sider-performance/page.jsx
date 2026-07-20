'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, FileText, Printer, Download, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { generatePreparatorySiderPerformanceReportAction } from '@/app/actions/preparatory-reports'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Preparatory Sider Performance Report Page
 * Displays employee-wise performance by department
 */
export default function PreparatorySiderPerformanceReportPage() {
  const [fromDate, setFromDate] = useState(new Date())
  const [toDate, setToDate] = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerateReport = async () => {
    if (!fromDate || !toDate) {
      toast.error('Please select both from and to dates')
      return
    }

    if (fromDate > toDate) {
      toast.error('From date cannot be after to date')
      return
    }

    setIsLoading(true)
    try {
      const result = await generatePreparatorySiderPerformanceReportAction(fromDate, toDate)
      
      if (result.success) {
        setReportData(result.data)
        toast.success('Report generated successfully')
      } else {
        toast.error(result.error || 'Failed to generate report')
      }
    } catch (error) {
      toast.error('Error generating report: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    if (!reportData) {
      toast.error('No report data available')
      return
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.width
      let yPosition = 15

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 7

      doc.setFontSize(14)
      doc.text('Preparatory Sider Performance Report', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 6

      // Period
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const periodText = `Period: ${format(new Date(reportData.period.from), 'dd-MM-yyyy')} to ${format(new Date(reportData.period.to), 'dd-MM-yyyy')}`
      doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 10

      let serialNumber = 1

      // Loop through departments
      Object.entries(reportData.departments).forEach(([deptName, deptData]) => {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage()
          yPosition = 15
        }

        // Department Header
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(deptName.toUpperCase(), 14, yPosition)
        yPosition += 2
        doc.setLineWidth(0.5)
        doc.line(14, yPosition, pageWidth - 14, yPosition)
        yPosition += 5

        // Prepare table data
        const tableData = deptData.employees.map(emp => [
          serialNumber++,
          emp.name,
          emp.productionKgs.toFixed(2),
          emp.efficiencyPercent.toFixed(2),
          emp.utilizationPercent.toFixed(2),
          emp.wastePercent.toFixed(2)
        ])

        // Generate table
        autoTable(doc, {
          startY: yPosition,
          head: [['SL', 'Name', 'Prod Kgs', 'Eff %', 'Util %', 'Waste %']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [220, 220, 220],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center'
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 15 },
            1: { halign: 'left', cellWidth: 70 },
            2: { halign: 'right', cellWidth: 25 },
            3: { halign: 'right', cellWidth: 20 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 20 }
          },
          bodyStyles: {
            fontSize: 9
          },
          margin: { left: 14, right: 14 }
        })

        yPosition = doc.lastAutoTable.finalY + 8
      })

      // Signatories
      if (yPosition > 270) {
        doc.addPage()
        yPosition = 15
      }
      
      yPosition = Math.max(yPosition, doc.internal.pageSize.height - 20)
      doc.setLineWidth(0.3)
      doc.line(14, yPosition - 5, pageWidth - 14, yPosition - 5)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const signatoriesText = 'AM(P)          GM          MD'
      doc.text(signatoriesText, pageWidth / 2, yPosition, { align: 'center' })

      // Generate filename with date
      const fromDateStr = format(new Date(reportData.period.from), 'dd-MM-yyyy')
      const toDateStr = format(new Date(reportData.period.to), 'dd-MM-yyyy')
      const filename = `Preparatory_Sider_Performance_${fromDateStr}_to_${toDateStr}.pdf`

      // Download
      doc.save(filename)
      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF')
    }
  }

  // Calculate serial number across all departments
  const getSerialNumber = (deptIndex, empIndex) => {
    let serial = 1
    const deptNames = Object.keys(reportData?.departments || {})
    
    for (let i = 0; i < deptIndex; i++) {
      const deptName = deptNames[i]
      serial += reportData.departments[deptName].employees.length
    }
    
    return serial + empIndex
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header - Hide on print */}
      <div className="print:hidden">
        <Card className="bg-linear-to-r from-blue-600 to-blue-700 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Preparatory Sider Performance Report</CardTitle>
                <p className="text-blue-100 mt-2">
                  Employee-wise performance analysis across preparatory departments
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
            {/* From Date */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-50 justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "dd-MMM-yyyy") : <span>Pick a date</span>}
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

            {/* To Date */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-50 justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "dd-MMM-yyyy") : <span>Pick a date</span>}
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
              disabled={isLoading || !fromDate || !toDate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              {isLoading ? 'Generating...' : 'Generate Report'}
            </Button>

            {/* Action Buttons */}
            {reportData && (
              <>
                <Button 
                  onClick={handlePrint}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button 
                  onClick={handleDownload}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {reportData && (
        <Card className="print:shadow-none">
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Report Header */}
              <div className="text-center border-b pb-4 print:border-black">
                <h1 className="text-2xl font-bold">Kayaar Exports Private Limited</h1>
                <h2 className="text-xl font-semibold mt-2">Preparatory Sider Performance Report</h2>
                <p className="text-sm mt-2">
                  <strong>Period:</strong> {format(new Date(reportData.period.from), 'dd-MM-yyyy')} to {format(new Date(reportData.period.to), 'dd-MM-yyyy')}
                </p>
              </div>

              {/* Departments */}
              {Object.entries(reportData.departments).map(([deptName, deptData], deptIndex) => (
                <div key={deptName} className="space-y-3">
                  <h3 className="text-lg font-bold uppercase border-b-2 border-blue-300 pb-2 print:border-black">
                    {deptName}
                  </h3>

                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100 print:bg-gray-200">
                        <th className="border border-gray-300 px-2 py-1 text-center w-12 print:border-black">SL</th>
                        <th className="border border-gray-300 px-2 py-1 text-left print:border-black">Name</th>
                        <th className="border border-gray-300 px-2 py-1 text-right w-24 print:border-black">Prod Kgs</th>
                        <th className="border border-gray-300 px-2 py-1 text-right w-20 print:border-black">Eff %</th>
                        <th className="border border-gray-300 px-2 py-1 text-right w-20 print:border-black">Util %</th>
                        <th className="border border-gray-300 px-2 py-1 text-right w-20 print:border-black">Waste %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptData.employees.map((emp, empIndex) => (
                        <tr key={empIndex}>
                          <td className="border border-gray-300 px-2 py-1 text-center print:border-black">
                            {getSerialNumber(deptIndex, empIndex)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 print:border-black">{emp.name}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right print:border-black">
                            {emp.productionKgs.toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right print:border-black">
                            {emp.efficiencyPercent.toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right print:border-black">
                            {emp.utilizationPercent.toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right print:border-black">
                            {emp.wastePercent.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Signatories */}
              <div className="text-center mt-8 pt-4 border-t print:border-black">
                <p className="text-sm font-semibold space-x-20">
                  <span>AM(P)</span>
                  <span>GM</span>
                  <span>MD</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!reportData && !isLoading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No report generated yet</p>
              <p className="text-sm mt-2">Select date range and click Generate Report</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
