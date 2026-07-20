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
  generateAutoconerEfficiencyReportAction
} from '@/app/actions/autoconer-reports'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Autoconer Efficiency Report Page
 * Displays efficiency grid with machine groups as columns and positions as rows
 */
export default function AutoconerEfficiencyReportPage() {
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
      const data = await generateAutoconerEfficiencyReportAction(formattedDate)
      
      if (!data.success) {
        toast.error(data.message || 'No data found for the selected date')
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
      const doc = new jsPDF('l', 'mm', 'a4') // Landscape for wide table
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPos = 15

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', pageWidth / 2, yPos, { align: 'center' })
      yPos += 7

      doc.setFontSize(14)
      doc.text('Autoconer Production Report', pageWidth / 2, yPos, { align: 'center' })
      yPos += 6

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${format(new Date(reportData.date), 'dd-MM-yyyy')}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      // Loop through each shift
      reportData.shifts.forEach((shift, shiftIndex) => {
        if (shiftIndex > 0) {
          doc.addPage()
          yPos = 15
        }

        // Shift header
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`Shift ${shift.shift}: ${shift.supervisor_name}`, 14, yPos)
        yPos += 5

        // Build table headers (column groups 1-13)
        const headers = [' ', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']
       
        // Build count row (68 CS for all columns)
        const countRow = [shift.primary_count || '68 CS']
        for (let i = 1; i <= 13; i++) {
          const group = shift.groups.find(g => g.groupNumber === i)
          countRow.push(group?.count?.replace('COMBED STAR', 'CS') || '68 CS')
        }

        // Build 5 machine position rows
        const bodyRows = []
        for (let pos = 0; pos < 5; pos++) {
          const row = [String(pos + 1)]
          for (let groupNum = 1; groupNum <= 13; groupNum++) {
            const group = shift.groups.find(g => g.groupNumber === groupNum)
            const machine = group?.machines[pos]
            row.push(machine ? machine.efficiency.toFixed(2) : '')
          }
          bodyRows.push(row)
        }

        autoTable(doc, {
          startY: yPos,
          head: [headers, countRow],
          body: bodyRows,
          theme: 'grid',
          headStyles: {
            fillColor: [22, 163, 74], // green-600
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
          },
          styles: {
            fontSize: 8,
            cellPadding: 1.5,
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: 10, fontStyle: 'bold', fillColor: [240, 240, 240] }
          }
        })

        yPos = doc.lastAutoTable.finalY || yPos
      })

      // Add designations footer on last page
      const totalPages = doc.internal.pages.length - 1
      doc.setPage(totalPages)
      
      yPos = doc.internal.pageSize.getHeight() - 25
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setLineWidth(0.3)
      doc.line(14, yPos - 5, pageWidth - 14, yPos - 5)
      
      const signatoriesText = 'AM(P)          GM          MD'
      doc.text(signatoriesText, pageWidth / 2, yPos, { align: 'center' })

      const filename = `Autoconer_Efficiency_${format(new Date(reportData.date), 'dd-MM-yyyy')}.pdf`
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
                <CardTitle className="text-2xl">Autoconer Efficiency Report</CardTitle>
                <p className="text-green-100 mt-2">
                  Production efficiency grid showing all machines across shifts
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
            <h2 className="text-xl font-semibold mb-2">Autoconer Production Report</h2>
            <p className="text-sm font-medium">Date: {format(new Date(reportData.date), 'dd-MM-yyyy')}</p>
          </div>

          {/* Shift Grids */}
          {reportData.shifts.map((shift, shiftIndex) => (
            <div key={shiftIndex} className="mb-8 page-break-after">
              <h3 className="text-lg font-semibold mb-3">
                Shift {shift.shift}: {shift.supervisor_name}
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    {/* Machine group numbers */}
                    <tr className="bg-green-600 text-white">
                      <th className="border border-gray-300 px-2 py-1"></th>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(num => (
                        <th key={num} className="border border-gray-300 px-2 py-1 text-center font-bold">
                          {num}
                        </th>
                      ))}
                    </tr>
                    {/* Count names row */}
                    <tr className="bg-green-600 text-white">
                      <th className="border border-gray-300 px-2 py-1 text-center"></th>
                      {shift.groups.map((group, idx) => (
                        <th key={idx} className="border border-gray-300 px-2 py-1 text-center text-xs font-semibold">
                          {group.count.replace('COMBED STAR', 'CS')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Machine positions 1-5 */}
                    {[0, 1, 2, 3, 4].map(posIndex => (
                      <tr key={posIndex} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-1 text-center font-bold bg-gray-100">
                          {posIndex + 1}
                        </td>
                        {shift.groups.map((group, groupIdx) => {
                          const machine = group.machines[posIndex]
                          return (
                            <td 
                              key={groupIdx} 
                              className="border border-gray-300 px-2 py-1 text-center"
                            >
                              {machine ? machine.efficiency.toFixed(2) : ''}
                            </td>
                          )
                        })}
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
