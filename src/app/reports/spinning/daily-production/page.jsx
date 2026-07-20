'use client'

import { useState } from 'react'
import { getSpinningDailyProductionReport } from '@/app/actions/spinningDailyProductionActions'
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

export default function SpinningDailyProductionReport() {
  const [reportDate, setReportDate] = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Format date to YYYY-MM-DD using local timezone
  const formatDateForQuery = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const generateReport = async () => {
    if (!reportDate) {
      toast.error('Please select a date')
      return
    }

    setLoading(true)
    try {
      const result = await getSpinningDailyProductionReport(
        formatDateForQuery(reportDate)
      )

      if (result.success) {
        setReportData(result.data)
        toast.success('Report generated successfully')
      } else {
        toast.error(result.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('An error occurred while generating the report')
    } finally {
      setLoading(false)
    }
  }

  const exportToPDF = () => {
    if (!reportData) {
      toast.error('No report data to export')
      return
    }

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      
      // Company header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', pageWidth / 2, 12, { align: 'center' })
      
      doc.setFontSize(12)
      doc.text('Spinning Daily Production Report', pageWidth / 2, 19, { align: 'center' })
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${reportData.displayDate} | Unit: I`, pageWidth / 2, 25, { align: 'center' })

      // Prepare table data with all columns
      const tableData = reportData.machines.map((machine, index) => [
        index + 1,
        machine.machineNo,
        machine.expGpsShift1.toFixed(1),
        machine.expGpsShift2.toFixed(1),
        machine.expGpsShift3.toFixed(1),
        machine.achievedGpsShift1.toFixed(1),
        machine.achievedGpsShift2.toFixed(1),
        machine.achievedGpsShift3.toFixed(1),
        machine.productionShift1.toFixed(2),
        machine.productionShift2.toFixed(2),
        machine.productionShift3.toFixed(2),
        machine.totalProduction.toFixed(2),
        machine.wasteShift1.toFixed(2),
        machine.wasteShift2.toFixed(2),
        machine.wasteShift3.toFixed(2),
        machine.avgWaste.toFixed(2),
        machine.stoppageShift1,
        machine.stoppageShift2,
        machine.stoppageShift3,
        machine.finalGps.toFixed(1)
      ])

      // Add auto table with compact styling for many columns
      autoTable(doc, {
        startY: 28,
        head: [[
          'S.No', 'Mc', 
          'Exp\nGPS I', 'Exp\nGPS II', 'Exp\nGPS III',
          'Ach\nGPS I', 'Ach\nGPS II', 'Ach\nGPS III',
          'Prodn\nI', 'Prodn\nII', 'Prodn\nIII', 'Prodn\nTotal',
          'Waste\n% I', 'Waste\n% II', 'Waste\n% III', 'Waste\nAvg',
          'Stop\nI', 'Stop\nII', 'Stop\nIII',
          'GPS'
        ]],
        body: tableData,
        theme: 'grid',
        styles: { 
          fontSize: 6, 
          cellPadding: 1,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [147, 51, 234], 
          textColor: 255, 
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 6
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },   // S.No
          1: { halign: 'left', cellWidth: 12 },    // Mc Name
          2: { halign: 'center', cellWidth: 11 },  // Exp GPS I
          3: { halign: 'center', cellWidth: 11 },  // Exp GPS II
          4: { halign: 'center', cellWidth: 11 },  // Exp GPS III
          5: { halign: 'center', cellWidth: 11 },  // Ach GPS I
          6: { halign: 'center', cellWidth: 11 },  // Ach GPS II
          7: { halign: 'center', cellWidth: 11 },  // Ach GPS III
          8: { halign: 'right', cellWidth: 13 },   // Prodn I
          9: { halign: 'right', cellWidth: 13 },   // Prodn II
          10: { halign: 'right', cellWidth: 13 },  // Prodn III
          11: { halign: 'right', cellWidth: 14 },  // Prodn Total
          12: { halign: 'right', cellWidth: 11 },  // Waste I
          13: { halign: 'right', cellWidth: 11 },  // Waste II
          14: { halign: 'right', cellWidth: 11 },  // Waste III
          15: { halign: 'right', cellWidth: 11 },  // Waste Avg
          16: { halign: 'right', cellWidth: 10 },  // Stop I
          17: { halign: 'right', cellWidth: 10 },  // Stop II
          18: { halign: 'right', cellWidth: 10 },  // Stop III
          19: { halign: 'center', cellWidth: 10 }  // GPS
        }
      })

      // Add shift totals
      const finalY = doc.lastAutoTable.finalY + 5
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Shift Totals:', 14, finalY)
      
      doc.setFont('helvetica', 'normal')
      doc.text(`I: ${reportData.shiftTotals.shift1.toFixed(2)} Kgs`, 40, finalY)
      doc.text(`II: ${reportData.shiftTotals.shift2.toFixed(2)} Kgs`, 80, finalY)
      doc.text(`III: ${reportData.shiftTotals.shift3.toFixed(2)} Kgs`, 120, finalY)
      
      doc.setFont('helvetica', 'bold')
      doc.text(`GRAND TOTAL: ${reportData.shiftTotals.grandTotal.toFixed(2)} Kgs`, 14, finalY + 6)

      // Add designations footer
      let yPos = doc.internal.pageSize.getHeight() - 25
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

      const fileName = `Spinning_Daily_Production_${reportData.displayDate.replace(/-/g, '_')}.pdf`
      doc.save(fileName)
      toast.success('PDF exported successfully')
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
                <CardTitle className="text-2xl">Spinning Daily Production Report</CardTitle>
                <p className="text-purple-100 mt-2">
                  Machine-wise production data across all shifts for a specific date
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
          {/* Date Selection */}
          <div className="flex flex-wrap gap-4 mb-6 print:hidden">
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">Report Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reportDate ? format(reportDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={reportDate}
                    onSelect={setReportDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end gap-2">
              <Button 
                onClick={generateReport} 
                disabled={loading || !reportDate}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              
              {reportData && (
                <Button
                  onClick={exportToPDF}
                  variant="outline"
                  className="border-purple-600 text-purple-600 hover:bg-purple-50 gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              )}
            </div>
          </div>

          {/* Report Display */}
          {reportData && (
            <div className="space-y-4">
              <div className="print:block">
                <div className="text-center mb-4 hidden print:block">
                  <h1 className="text-2xl font-bold">Kayaar Exports Private Limited</h1>
                  <h2 className="text-xl font-semibold mt-2">Spinning Daily Production Report</h2>
                  <p className="text-sm mt-1">Date: {reportData.displayDate} | Unit: I</p>
                </div>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-purple-50">
                      <TableHead className="text-center font-bold">S.No</TableHead>
                      <TableHead className="font-bold">Mc Name</TableHead>
                      <TableHead className="text-center font-bold">Expected GPS I</TableHead>
                      <TableHead className="text-center font-bold">Expected GPS II</TableHead>
                      <TableHead className="text-center font-bold">Expected GPS III</TableHead>
                      <TableHead className="text-center font-bold">Achieved GPS I</TableHead>
                      <TableHead className="text-center font-bold">Achieved GPS II</TableHead>
                      <TableHead className="text-center font-bold">Achieved GPS III</TableHead>
                      <TableHead className="text-right font-bold">PRODN. Kgs. I</TableHead>
                      <TableHead className="text-right font-bold">PRODN. Kgs. II</TableHead>
                      <TableHead className="text-right font-bold">PRODN. Kgs. III</TableHead>
                      <TableHead className="text-right font-bold">PRODN. Total</TableHead>
                      <TableHead className="text-right font-bold">Waste % I</TableHead>
                      <TableHead className="text-right font-bold">Waste % II</TableHead>
                      <TableHead className="text-right font-bold">Waste % III</TableHead>
                      <TableHead className="text-right font-bold">Waste Avg.</TableHead>
                      <TableHead className="text-right font-bold">Stopped Mins I</TableHead>
                      <TableHead className="text-right font-bold">Stopped Mins II</TableHead>
                      <TableHead className="text-right font-bold">Stopped Mins III</TableHead>
                      <TableHead className="text-center font-bold">GPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.machines.map((machine, index) => (
                    <TableRow key={machine.machineNo} className="hover:bg-purple-50/50">
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell className="font-medium">{machine.machineNo}</TableCell>
                      {/* Expected GPS */}
                      <TableCell className="text-center">{machine.expGpsShift1.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{machine.expGpsShift2.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{machine.expGpsShift3.toFixed(2)}</TableCell>
                      {/* Achieved GPS */}
                      <TableCell className="text-center">{machine.achievedGpsShift1.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{machine.achievedGpsShift2.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{machine.achievedGpsShift3.toFixed(2)}</TableCell>
                      {/* Production */}
                      <TableCell className="text-right">{machine.productionShift1.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{machine.productionShift2.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{machine.productionShift3.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{machine.totalProduction.toFixed(2)}</TableCell>
                      {/* Waste */}
                      <TableCell className="text-right">{machine.wasteShift1.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{machine.wasteShift2.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{machine.wasteShift3.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{machine.avgWaste.toFixed(2)}</TableCell>
                      {/* Stopped Mins */}
                      <TableCell className="text-right">{machine.stoppageShift1}</TableCell>
                      <TableCell className="text-right">{machine.stoppageShift2}</TableCell>
                      <TableCell className="text-right">{machine.stoppageShift3}</TableCell>
                      {/* Final GPS */}
                      <TableCell className="text-center">{machine.finalGps.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Shift Totals Row */}
                  <TableRow className="bg-purple-100 font-bold">
                    <TableCell colSpan={8} className="text-left">Shift Totals</TableCell>
                    <TableCell className="text-right">{reportData.shiftTotals.shift1.toFixed(2)} Kgs</TableCell>
                    <TableCell className="text-right">{reportData.shiftTotals.shift2.toFixed(2)} Kgs</TableCell>
                    <TableCell className="text-right">{reportData.shiftTotals.shift3.toFixed(2)} Kgs</TableCell>
                    <TableCell colSpan={9}></TableCell>
                  </TableRow>
                  
                  {/* Grand Total Row */}
                  <TableRow className="bg-purple-200 font-bold text-lg">
                    <TableCell colSpan={8} className="text-left">GRAND TOTAL</TableCell>
                    <TableCell colSpan={3} className="text-right">
                      {reportData.shiftTotals.grandTotal.toFixed(2)} Kgs
                    </TableCell>
                    <TableCell colSpan={9}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
        </CardContent>
      </Card>
    </div>
  )
}
