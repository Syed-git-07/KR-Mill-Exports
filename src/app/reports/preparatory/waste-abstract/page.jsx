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
import { generatePreparatoryWasteReportAction } from '@/app/actions/preparatory-reports'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function WasteRow({ department, total = false }) {
  return (
    <tr className={total ? 'bg-gray-100 font-bold' : ''}>
      <td className="border border-gray-300 px-3 py-2 print:border-black">{department.department}</td>
      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{department.wasteKgs.toFixed(2)}</td>
      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{department.wastePercent.toFixed(2)}</td>
      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{department.wasteKgsUpto.toFixed(2)}</td>
      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{department.wastePercentUpto.toFixed(2)}</td>
    </tr>
  )
}

/**
 * Preparatory Waste Abstract Report Page
 * Displays waste analysis by department with "Up to" and "Period" columns
 */
export default function PreparatoryWasteReportPage() {
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
      const result = await generatePreparatoryWasteReportAction(format(fromDate, 'yyyy-MM-dd'), format(toDate, 'yyyy-MM-dd'))
      
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
      doc.text('Preparatory Waste Abstract Report', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 6

      // Period
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const periodText = `Period: ${format(new Date(reportData.period.from), 'dd-MM-yyyy')} to ${format(new Date(reportData.period.to), 'dd-MM-yyyy')}`
      doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 10

      const prepRows = reportData.preparatory.map(dept => [
        dept.department, dept.wasteKgs.toFixed(2), dept.wastePercent.toFixed(2),
        dept.wasteKgsUpto.toFixed(2), dept.wastePercentUpto.toFixed(2)
      ])
      const tableData = [
        ...prepRows,
        [
          'TOTAL', reportData.preparatoryTotal.wasteKgs.toFixed(2),
          reportData.preparatoryTotal.wastePercent.toFixed(2),
          reportData.preparatoryTotal.wasteKgsUpto.toFixed(2),
          reportData.preparatoryTotal.wastePercentUpto.toFixed(2)
        ],
        ...reportData.postPreparatory.map(dept => [
          dept.department, dept.wasteKgs.toFixed(2), dept.wastePercent.toFixed(2),
          dept.wasteKgsUpto.toFixed(2), dept.wastePercentUpto.toFixed(2)
        ])
      ]

      autoTable(doc, {
        startY: yPosition,
        head: [['Department', 'Waste Kgs', 'Waste %', 'Up To Waste Kgs', 'Up To Waste %']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 60 },
          1: { halign: 'right', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', cellWidth: 30 }
        },
        bodyStyles: {
          fontSize: 9
        },
        margin: { left: 14, right: 14 },
        didParseCell(data) {
          if (data.row.index === prepRows.length) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [240, 240, 240]
          }
        }
      })

      yPosition = doc.lastAutoTable.finalY + 15

      // Generate filename with date
      const fromDateStr = format(new Date(reportData.period.from), 'dd-MM-yyyy')
      const toDateStr = format(new Date(reportData.period.to), 'dd-MM-yyyy')
      const filename = `Preparatory_Waste_Report_${fromDateStr}_to_${toDateStr}.pdf`

      // Download
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
        <Card className="bg-linear-to-r from-blue-600 to-blue-700 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Preparatory Waste Abstract Report</CardTitle>
                <p className="text-blue-100 mt-2">
                  Department-wise waste analysis with cumulative and period data
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
                    captionLayout="dropdown"
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
                    captionLayout="dropdown"
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
                <h2 className="text-xl font-semibold mt-2">Preparatory Waste Abstract Report</h2>
                <p className="text-sm mt-2">
                  <strong>Period:</strong> {format(new Date(reportData.period.from), 'dd-MM-yyyy')} to {format(new Date(reportData.period.to), 'dd-MM-yyyy')}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Up to: {format(new Date(reportData.period.uptoFrom), 'dd-MM-yyyy')} to {format(new Date(reportData.period.uptoTo), 'dd-MM-yyyy')}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-200">
                      <th className="border border-gray-300 px-3 py-2 text-left print:border-black">Department</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste Kgs</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste %</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Up To Waste Kgs</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Up To Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.preparatory.map((dept) => <WasteRow key={dept.department} department={dept} />)}
                    <WasteRow department={{
                      department: 'TOTAL',
                      wasteKgs: reportData.preparatoryTotal.wasteKgs,
                      wastePercent: reportData.preparatoryTotal.wastePercent,
                      wasteKgsUpto: reportData.preparatoryTotal.wasteKgsUpto,
                      wastePercentUpto: reportData.preparatoryTotal.wastePercentUpto
                    }} total />
                    {reportData.postPreparatory.map((dept) => <WasteRow key={dept.department} department={dept} />)}
                  </tbody>
                </table>
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
