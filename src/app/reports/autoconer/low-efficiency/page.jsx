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
import {
  generateAutoconerLowEfficiencyReportAction
} from '@/app/actions/autoconer-reports'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Autoconer Low Efficiency Report Page
 * Displays machines where actual efficiency is below target efficiency
 */
export default function AutoconerLowEfficiencyReportPage() {
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
      const data = await generateAutoconerLowEfficiencyReportAction(formattedDate)
      setReportData(data)

      if (data.shifts.length === 0) {
        toast.warning('No low efficiency data found for the selected date')
      } else {
        toast.success('Report generated successfully')
      }
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
      doc.text('Autoconer Sider Efficiency Report', pageWidth / 2, yPos, { align: 'center' })
      yPos += 6

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${format(new Date(reportData.date), 'dd-MM-yyyy')}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      // Loop through each shift
      reportData.shifts.forEach((shift, shiftIndex) => {
        if (shiftIndex > 0) yPos += 8

        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage()
          yPos = 15
        }

        // Shift header
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`Shift ${shift.shift}: ${shift.supervisor_name}`, 14, yPos)
        yPos += 5

        // Table data
        const tableData = shift.machines.map((machine) => [
          machine.machine_no,
          machine.sider_name,
          machine.count,
          machine.act_effi.toFixed(2),
          machine.shift_effi.toFixed(2),
          machine.red_light.toFixed(2)
        ])

        autoTable(doc, {
          startY: yPos,
          head: [['MC NO', 'SIDER NAME', 'COUNT', 'ACT EFFI', 'SHIFT EFFI', 'RED LIGHT']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [22, 163, 74], // green-600
            textColor: 255,
            fontStyle: 'bold',
            halign: 'left'
          },
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 35 },
            2: { cellWidth: 45 },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 25, halign: 'right' }
          },
          didParseCell: function(data) {
            // Color shift effi column (index 4) based on comparison with act effi
            if (data.column.index === 4 && data.section === 'body') {
              const machine = shift.machines[data.row.index]
              if (machine) {
                if (machine.shift_effi >= machine.act_effi) {
                  // Green for good efficiency (meets or exceeds target)
                  data.cell.styles.textColor = [22, 163, 74] // green-600
                  data.cell.styles.fontStyle = 'bold'
                } else {
                  // Red for low efficiency (below target)
                  data.cell.styles.textColor = [220, 38, 38] // red-600
                  data.cell.styles.fontStyle = 'bold'
                }
              }
            }
          }
        })

        yPos = doc.lastAutoTable.finalY + 5
      })

      // Footer
      const totalPages = doc.internal.pages.length - 1
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.text(
          'Report generated for Kayaar Exports Private Limited',
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
      }

      // Add designations footer
      yPos = doc.internal.pageSize.getHeight() - 25
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setLineWidth(0.3)
      doc.line(14, yPos - 5, pageWidth - 14, yPos - 5)
      
      const signatoriesText = 'AM(P)          GM          MD'
      doc.text(signatoriesText, pageWidth / 2, yPos, { align: 'center' })

      const filename = `Autoconer_Low_Efficiency_${format(new Date(reportData.date), 'dd-MM-yyyy')}.pdf`
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
                <CardTitle className="text-2xl">Autoconer Sider Efficiency Report</CardTitle>
                <p className="text-green-100 mt-2">
                  Machine efficiency performance tracking (Green: Above target, Red: Below target)
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
              className="bg-green-600 hover:bg-green-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              {isLoading ? 'Generating...' : 'Generate Report'}
            </Button>

            {/* Action Buttons */}
            {reportData && reportData.shifts.length > 0 && (
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
                  onClick={handleDownloadPDF}
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
      {reportData && reportData.shifts.length > 0 && (
        <div className="bg-white print:p-8">
          {/* Report Header */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Kayaar Exports Private Limited
            </h1>
            <h2 className="text-xl font-semibold text-gray-700">
              Autoconer Sider Efficiency Report
            </h2>
            <p className="text-gray-600">
              <span className="font-medium">Date:</span>{' '}
              {format(new Date(reportData.date), 'dd-MM-yyyy')}
            </p>
          </div>

          <hr className="mb-6 border-gray-300" />

          {/* Shifts */}
          {reportData.shifts.map((shift, shiftIndex) => (
            <div key={shiftIndex} className="mb-8 print:break-inside-avoid">
              {/* Shift Header */}
              <h3 className="text-lg font-bold text-green-700 mb-3">
                Shift {shift.shift}: {shift.supervisor_name}
              </h3>

              {/* Machine Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-green-600 text-white">
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                        MC NO
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                        SIDER NAME
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                        COUNT
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-right font-semibold">
                        ACT EFFI
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-right font-semibold">
                        SHIFT EFFI
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-right font-semibold">
                        RED LIGHT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shift.machines.map((machine, machineIndex) => (
                      <tr
                        key={machineIndex}
                        className={machineIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="border border-gray-300 px-3 py-2">
                          {machine.machine_no}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {machine.sider_name}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {machine.count}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {machine.act_effi.toFixed(2)}
                        </td>
                        <td className={cn(
                          "border border-gray-300 px-3 py-2 text-right font-semibold",
                          machine.shift_effi >= machine.act_effi 
                            ? "text-green-600" 
                            : "text-red-600"
                        )}>
                          {machine.shift_effi.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {machine.red_light.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
      )}
    </div>
  )
}
