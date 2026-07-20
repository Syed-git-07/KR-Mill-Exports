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
      const result = await generatePreparatoryWasteReportAction(fromDate, toDate)
      
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

      // Preparatory Section
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('PREPARATORY', 14, yPosition)
      yPosition += 5

      // Preparatory table data
      const prepData = reportData.preparatory.map(dept => [
        dept.department,
        dept.wasteKgsUpto.toFixed(2),
        dept.wastePercentUpto.toFixed(2),
        dept.wasteKgs.toFixed(2),
        dept.wastePercent.toFixed(2)
      ])

      // Add preparatory total
      prepData.push([
        'TOTAL',
        reportData.preparatoryTotal.wasteKgsUpto.toFixed(2),
        reportData.preparatoryTotal.wastePercentUpto.toFixed(2),
        reportData.preparatoryTotal.wasteKgs.toFixed(2),
        reportData.preparatoryTotal.wastePercent.toFixed(2)
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [['Department', 'Waste Kgs (Up to)', 'Waste % (Up to)', 'Waste Kgs', 'Waste %']],
        body: prepData,
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
        didParseCell: function(data) {
          if (data.row.index === prepData.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [240, 240, 240]
          }
        }
      })

      yPosition = doc.lastAutoTable.finalY + 10

      // Post Preparatory Section
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('POST PREPARATORY', 14, yPosition)
      yPosition += 5

      // Post preparatory table data
      const postPrepData = reportData.postPreparatory.map(dept => [
        dept.department,
        dept.wasteKgsUpto.toFixed(2),
        dept.wastePercentUpto.toFixed(2),
        dept.wasteKgs.toFixed(2),
        dept.wastePercent.toFixed(2)
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [['Department', 'Waste Kgs (Up to)', 'Waste % (Up to)', 'Waste Kgs', 'Waste %']],
        body: postPrepData,
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
        margin: { left: 14, right: 14 }
      })

      yPosition = doc.lastAutoTable.finalY + 10

      // Grand Total
      const grandTotalData = [[
        'GRAND TOTAL',
        reportData.grandTotal.wasteKgsUpto.toFixed(2),
        reportData.grandTotal.wastePercentUpto.toFixed(2),
        reportData.grandTotal.wasteKgs.toFixed(2),
        reportData.grandTotal.wastePercent.toFixed(2)
      ]]

      autoTable(doc, {
        startY: yPosition,
        head: [['', 'Waste Kgs (Up to)', 'Waste % (Up to)', 'Waste Kgs', 'Waste %']],
        body: grandTotalData,
        theme: 'grid',
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 60, fontStyle: 'bold' },
          1: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
          2: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
          3: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
          4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
        },
        bodyStyles: {
          fontSize: 9,
          fillColor: [250, 250, 250]
        },
        margin: { left: 14, right: 14 }
      })

      yPosition = doc.lastAutoTable.finalY + 15

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
                <h2 className="text-xl font-semibold mt-2">Preparatory Waste Abstract Report</h2>
                <p className="text-sm mt-2">
                  <strong>Period:</strong> {format(new Date(reportData.period.from), 'dd-MM-yyyy')} to {format(new Date(reportData.period.to), 'dd-MM-yyyy')}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Up to: {format(new Date(reportData.period.uptoFrom), 'dd-MM-yyyy')} to {format(new Date(reportData.period.uptoTo), 'dd-MM-yyyy')}
                </p>
              </div>

              {/* PREPARATORY Section */}
              <div>
                <h3 className="text-lg font-bold uppercase mb-3 text-blue-700">PREPARATORY</h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-200">
                      <th className="border border-gray-300 px-3 py-2 text-left print:border-black">Department</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste Kgs<br/>(Up to)</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste %<br/>(Up to)</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste Kgs</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.preparatory.map((dept, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 px-3 py-2 print:border-black">{dept.department}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{dept.wasteKgsUpto.toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{dept.wastePercentUpto.toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{dept.wasteKgs.toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{dept.wastePercent.toFixed(2)}</td>
                      </tr>
                    ))}
                    {/* Preparatory Total */}
                    <tr className="bg-blue-50 font-bold print:bg-gray-100">
                      <td className="border border-gray-300 px-3 py-2 print:border-black">TOTAL</td>
                      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{reportData.preparatoryTotal.wasteKgsUpto.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{reportData.preparatoryTotal.wastePercentUpto.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{reportData.preparatoryTotal.wasteKgs.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{reportData.preparatoryTotal.wastePercent.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* POST PREPARATORY Section */}
              <div>
                <h3 className="text-lg font-bold uppercase mb-3 text-purple-700">POST PREPARATORY</h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-200">
                      <th className="border border-gray-300 px-3 py-2 text-left print:border-black">Department</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste Kgs<br/>(Up to)</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste %<br/>(Up to)</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste Kgs</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.postPreparatory.map((dept, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 px-3 py-2 print:border-black">{dept.department}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{dept.wasteKgsUpto.toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{dept.wastePercentUpto.toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{dept.wasteKgs.toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{dept.wastePercent.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* GRAND TOTAL */}
              <div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-200">
                      <th className="border border-gray-300 px-3 py-2 text-left print:border-black"></th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste Kgs<br/>(Up to)</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste %<br/>(Up to)</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste Kgs</th>
                      <th className="border border-gray-300 px-3 py-2 text-right print:border-black">Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-yellow-50 font-bold text-base print:bg-gray-200">
                      <td className="border border-gray-300 px-3 py-2 print:border-black">GRAND TOTAL</td>
                      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{reportData.grandTotal.wasteKgsUpto.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{reportData.grandTotal.wastePercentUpto.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{reportData.grandTotal.wasteKgs.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right print:border-black">{reportData.grandTotal.wastePercent.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
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
