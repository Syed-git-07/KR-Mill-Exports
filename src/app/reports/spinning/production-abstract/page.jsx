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
import { fetchSpinningProductionAbstract } from './actions'

export default function SpinningProductionAbstractReport() {
  const [reportDate, setReportDate] = useState(new Date())
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      const result = await fetchSpinningProductionAbstract(reportDate)
      
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
    if (!reportData || !reportData.summaryData) {
      toast.error('No data to export')
      return
    }

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Kayaar Exports Private Limited', pageWidth / 2, 15, { align: 'center' })
      
      doc.setFontSize(14)
      doc.text(`Spinning Production Abstract - ${format(reportDate, 'dd-MM-yyyy')}`, pageWidth / 2, 23, { align: 'center' })

      // Summary Table
      const tableData = reportData.summaryData.map((row, index) => [
        index + 1,
        row.countName,
        row.machineCount.toString(),
        row.totalSpindles.toLocaleString(),
        row.productionKg.toFixed(2),
        row.production40s.toFixed(2),
        row.gpsStd.toFixed(2),
        row.gpsAchieved.toFixed(2),
        row.gps40s.toFixed(2),
        row.wasteKg.toFixed(2),
        row.wastePercent.toFixed(2),
        row.utilizationPercent.toFixed(2),
        row.gainLoss.toFixed(2)
      ])

      // Add grand total row
      if (reportData.grandTotal) {
        tableData.push([
          '',
          'TOTAL',
          reportData.grandTotal.machineCount.toString(),
          reportData.grandTotal.totalSpindles.toLocaleString(),
          reportData.grandTotal.productionKg.toFixed(2),
          '',
          '',
          '',
          '',
          reportData.grandTotal.wasteKg.toFixed(2),
          '',
          '',
          ''
        ])
      }

      autoTable(doc, {
        startY: 30,
        head: [[
          'S.No',
          'Yarn Count',
          'No.Of\nMachine',
          'Total\nSpl',
          'Production\nKG',
          'Production\n40\'s',
          'GPS\nStd',
          'GPS\nAchieved',
          '40sGPS',
          'Waste\nKgs',
          'Waste\n%',
          'Util\n%',
          'Gain/\nLoss'
        ]],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          halign: 'center'
        },
        headStyles: {
          fillColor: [147, 51, 234], // purple-600
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },  // S.No
          1: { halign: 'left', cellWidth: 35 },    // Yarn Count
          2: { halign: 'center', cellWidth: 15 },  // Machines
          3: { halign: 'right', cellWidth: 20 },   // Total Spl
          4: { halign: 'right', cellWidth: 22 },   // Production KG
          5: { halign: 'right', cellWidth: 22 },   // Production 40's
          6: { halign: 'right', cellWidth: 18 },   // GPS Std
          7: { halign: 'right', cellWidth: 18 },   // GPS Achieved
          8: { halign: 'right', cellWidth: 18 },   // 40sGPS
          9: { halign: 'right', cellWidth: 18 },   // Waste Kgs
          10: { halign: 'right', cellWidth: 16 },  // Waste %
          11: { halign: 'right', cellWidth: 16 },  // Util %
          12: { halign: 'right', cellWidth: 18 }   // Gain/Loss
        },
        didParseCell: function(data) {
          // Make total row bold
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [243, 232, 255] // purple-100
          }
        }
      })

      // Add Abstract Table if available
      if (reportData.abstractData) {
        const finalY = doc.lastAutoTable.finalY || 30
        
        // Abstract Table Title
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('ABSTRACT - Date Total & Upto Date Total', 14, finalY + 10)

        // Prepare abstract table data
        const abstractTableData = [
          [
            'Total Production',
            reportData.abstractData.totalProduction.currentMonthToday.shift1.toFixed(2),
            reportData.abstractData.totalProduction.currentMonthToday.shift2.toFixed(2),
            reportData.abstractData.totalProduction.currentMonthToday.shift3.toFixed(2),
            reportData.abstractData.totalProduction.currentMonthToday.total.toFixed(2),
            reportData.abstractData.totalProduction.lastMonthSameDate.toFixed(2),
            reportData.abstractData.totalProduction.currentMonthUptoDate.toFixed(2),
            reportData.abstractData.totalProduction.lastMonthUptoDate.toFixed(2)
          ],
          [
            'Avg.Util (%)',
            reportData.abstractData.avgUtilization.currentMonthToday.shift1.toFixed(2),
            reportData.abstractData.avgUtilization.currentMonthToday.shift2.toFixed(2),
            reportData.abstractData.avgUtilization.currentMonthToday.shift3.toFixed(2),
            reportData.abstractData.avgUtilization.currentMonthToday.average.toFixed(2),
            reportData.abstractData.avgUtilization.lastMonthSameDate.toFixed(2),
            reportData.abstractData.avgUtilization.currentMonthUptoDate.toFixed(2),
            reportData.abstractData.avgUtilization.lastMonthUptoDate.toFixed(2)
          ],
          [
            'Worked Spindles',
            reportData.abstractData.workedSpindles.currentMonthToday.shift1.toFixed(2),
            reportData.abstractData.workedSpindles.currentMonthToday.shift2.toFixed(2),
            reportData.abstractData.workedSpindles.currentMonthToday.shift3.toFixed(2),
            reportData.abstractData.workedSpindles.currentMonthToday.total.toFixed(2),
            reportData.abstractData.workedSpindles.lastMonthSameDate.toFixed(2),
            reportData.abstractData.workedSpindles.currentMonthUptoDate.toFixed(2),
            reportData.abstractData.workedSpindles.lastMonthUptoDate.toFixed(2)
          ],
          [
            'Average Count',
            reportData.abstractData.averageCount.currentMonthToday.shift1.toFixed(2),
            reportData.abstractData.averageCount.currentMonthToday.shift2.toFixed(2),
            reportData.abstractData.averageCount.currentMonthToday.shift3.toFixed(2),
            reportData.abstractData.averageCount.currentMonthToday.average.toFixed(2),
            reportData.abstractData.averageCount.lastMonthSameDate.toFixed(2),
            reportData.abstractData.averageCount.currentMonthUptoDate.toFixed(2),
            reportData.abstractData.averageCount.lastMonthUptoDate.toFixed(2)
          ],
          [
            'Total Wastage(KG)',
            reportData.abstractData.totalWastage.currentMonthToday.shift1.toFixed(2),
            reportData.abstractData.totalWastage.currentMonthToday.shift2.toFixed(2),
            reportData.abstractData.totalWastage.currentMonthToday.shift3.toFixed(2),
            reportData.abstractData.totalWastage.currentMonthToday.total.toFixed(2),
            reportData.abstractData.totalWastage.lastMonthSameDate.toFixed(2),
            reportData.abstractData.totalWastage.currentMonthUptoDate.toFixed(2),
            reportData.abstractData.totalWastage.lastMonthUptoDate.toFixed(2)
          ],
          [
            'AVG. Wastage(%)',
            reportData.abstractData.avgWastagePercent.currentMonthToday.shift1.toFixed(2),
            reportData.abstractData.avgWastagePercent.currentMonthToday.shift2.toFixed(2),
            reportData.abstractData.avgWastagePercent.currentMonthToday.shift3.toFixed(2),
            reportData.abstractData.avgWastagePercent.currentMonthToday.average.toFixed(2),
            reportData.abstractData.avgWastagePercent.lastMonthSameDate.toFixed(2),
            reportData.abstractData.avgWastagePercent.currentMonthUptoDate.toFixed(2),
            reportData.abstractData.avgWastagePercent.lastMonthUptoDate.toFixed(2)
          ],
          [
            'Total Stoppage Mins',
            reportData.abstractData.totalStoppageMins.currentMonthToday.shift1.toFixed(2),
            reportData.abstractData.totalStoppageMins.currentMonthToday.shift2.toFixed(2),
            reportData.abstractData.totalStoppageMins.currentMonthToday.shift3.toFixed(2),
            reportData.abstractData.totalStoppageMins.currentMonthToday.total.toFixed(2),
            reportData.abstractData.totalStoppageMins.lastMonthSameDate.toFixed(2),
            reportData.abstractData.totalStoppageMins.currentMonthUptoDate.toFixed(2),
            reportData.abstractData.totalStoppageMins.lastMonthUptoDate.toFixed(2)
          ]
        ]

        autoTable(doc, {
          startY: finalY + 15,
          head: [
            [
              { content: 'Metric', rowSpan: 2 },
              { content: '', colSpan: 3 },
              { content: 'Date Total', colSpan: 2 },
              { content: 'Upto Date Total', colSpan: 2 }
            ],
            [
              'I Shift',
              'II Shift',
              'III Shift',
              'This Month',
              'Last Month',
              'This Month',
              'Last Month'
            ]
          ],
          body: abstractTableData,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
            halign: 'center'
          },
          headStyles: {
            fillColor: [147, 51, 234], // purple-600
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 9
          },
          columnStyles: {
            0: { halign: 'left', cellWidth: 35 },   // Metric
            1: { halign: 'right', cellWidth: 25 },  // Shift 1
            2: { halign: 'right', cellWidth: 25 },  // Shift 2
            3: { halign: 'right', cellWidth: 25 },  // Shift 3
            4: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },  // Date Total This Month
            5: { halign: 'right', cellWidth: 30 },  // Date Total Last Month
            6: { halign: 'right', cellWidth: 30 },  // Upto Date Total This Month
            7: { halign: 'right', cellWidth: 30 }   // Upto Date Total Last Month
          }
        })
      }

      // Count-wise Summary Table
      if (reportData.countwiseSummary) {
        const countwiseFinalY = doc.lastAutoTable.finalY || 30
        
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('Count-wise Summary', 14, countwiseFinalY + 10)

        const countwiseTableData = reportData.countwiseSummary.counts.map(count => [
          count.countName,
          count.production.toFixed(2),
          count.workedSpindles.toFixed(2),
          count.standardGps.toFixed(2),
          count.achievedGps.toFixed(2),
          count.conv40sGps.toFixed(2),
          count.wasteKgs.toFixed(2),
          count.wastePercent.toFixed(2)
        ])

        // Add total row
        countwiseTableData.push([
          { content: 'Total', styles: { fontStyle: 'bold' } },
          { content: reportData.countwiseSummary.totals.production.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: reportData.countwiseSummary.totals.workedSpindles.toFixed(2), styles: { fontStyle: 'bold' } },
          '',
          '',
          '',
          { content: reportData.countwiseSummary.totals.wasteKgs.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: reportData.countwiseSummary.totals.wastePercent.toFixed(2), styles: { fontStyle: 'bold' } }
        ])

        autoTable(doc, {
          startY: countwiseFinalY + 15,
          head: [
            [
              'Count',
              'Production',
              'Worked Spindle',
              'Standard GPS',
              'Achieved GPS',
              '40s Conv GPS',
              'Waste KGS',
              'Waste %'
            ]
          ],
          body: countwiseTableData,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
            halign: 'center'
          },
          headStyles: {
            fillColor: [147, 51, 234], // purple-600
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
          },
          columnStyles: {
            0: { halign: 'left', cellWidth: 40 },
            1: { halign: 'right', cellWidth: 25 },
            2: { halign: 'right', cellWidth: 30 },
            3: { halign: 'right', cellWidth: 28 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'right', cellWidth: 28 },
            6: { halign: 'right', cellWidth: 25 },
            7: { halign: 'right', cellWidth: 22 }
          }
        })
      }

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

      const filename = `Spinning_Abstract_${format(reportDate, 'dd-MM-yyyy')}.pdf`
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
                <CardTitle className="text-2xl">Spinning Production Abstract Report</CardTitle>
                <p className="text-purple-100 mt-2">
                  Daily production summary with count-wise analysis
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
                onClick={handleGenerateReport} 
                disabled={loading || !reportDate}
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
                  Download PDF
                </Button>
              )}
            </div>
          </div>

          {/* Report Display */}
          {reportData && reportData.summaryData && (
            <div className="print:p-0">
              {/* Print Header */}
              <div className="hidden print:block text-center mb-6">
                <h1 className="text-xl font-bold">Kayaar Exports Private Limited</h1>
                <h2 className="text-lg font-semibold mt-2">Spinning Production Abstract Report</h2>
                <p className="text-sm mt-1">Date: {format(reportDate, 'dd-MM-yyyy')}</p>
              </div>

              {/* Summary Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-purple-50">
                      <TableHead className="text-center">S.No</TableHead>
                      <TableHead>Yarn Count</TableHead>
                      <TableHead className="text-center">No.Of Machine</TableHead>
                      <TableHead className="text-center">Total Spl</TableHead>
                      <TableHead className="text-right">Production KG</TableHead>
                      <TableHead className="text-right">Production 40's</TableHead>
                      <TableHead className="text-right">GPS Std</TableHead>
                      <TableHead className="text-right">GPS Achieved</TableHead>
                      <TableHead className="text-right">40sGPS</TableHead>
                      <TableHead className="text-right">Waste Kgs</TableHead>
                      <TableHead className="text-right">Waste %</TableHead>
                      <TableHead className="text-right">Util %</TableHead>
                      <TableHead className="text-right">Gain/Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.summaryData.map((row, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell className="text-center">{index + 1}</TableCell>
                        <TableCell className="font-medium">{row.countName}</TableCell>
                        <TableCell className="text-center">{row.machineCount}</TableCell>
                        <TableCell className="text-center">{row.totalSpindles.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.productionKg.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.production40s.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.gpsStd.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.gpsAchieved.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.gps40s.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.wasteKg.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.wastePercent.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.utilizationPercent.toFixed(2)}</TableCell>
                        <TableCell className={`text-right ${row.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.gainLoss.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Grand Total Row */}
                    {reportData.grandTotal && (
                      <TableRow className="font-bold bg-purple-100">
                        <TableCell></TableCell>
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-center">{reportData.grandTotal.machineCount}</TableCell>
                        <TableCell className="text-center">{reportData.grandTotal.totalSpindles.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{reportData.grandTotal.productionKg.toFixed(2)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">{reportData.grandTotal.wasteKg.toFixed(2)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Abstract Table - Date Total & Upto Date Total */}
              {reportData.abstractData && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">ABSTRACT - Date Total & Upto Date Total</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-purple-50">
                          <TableHead rowSpan={2} className="border border-gray-300 align-middle">
                            <div className="font-bold">Metric</div>
                          </TableHead>
                          <TableHead colSpan={3} className="border border-gray-300 text-center">
                            <div className="font-bold"></div>
                          </TableHead>
                          <TableHead colSpan={2} className="border border-gray-300 text-center">
                            <div className="font-bold">Date Total</div>
                          </TableHead>
                          <TableHead colSpan={2} className="border border-gray-300 text-center">
                            <div className="font-bold">Upto Date Total</div>
                          </TableHead>
                        </TableRow>
                        <TableRow className="bg-purple-50">
                          <TableHead className="border border-gray-300 text-center font-bold">I Shift</TableHead>
                          <TableHead className="border border-gray-300 text-center font-bold">II Shift</TableHead>
                          <TableHead className="border border-gray-300 text-center font-bold">III Shift</TableHead>
                          <TableHead className="border border-gray-300 text-center font-bold">This Month</TableHead>
                          <TableHead className="border border-gray-300 text-center font-bold">Last Month</TableHead>
                          <TableHead className="border border-gray-300 text-center font-bold">This Month</TableHead>
                          <TableHead className="border border-gray-300 text-center font-bold">Last Month</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="border border-gray-300 font-bold">Total Production</TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalProduction.currentMonthToday.shift1.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalProduction.currentMonthToday.shift2.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalProduction.currentMonthToday.shift3.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-semibold">
                            {reportData.abstractData.totalProduction.currentMonthToday.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalProduction.lastMonthSameDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalProduction.currentMonthUptoDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalProduction.lastMonthUptoDate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                        
                        {/* Avg Util % Row */}
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="border border-gray-300 font-bold">Avg.Util (%)</TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgUtilization.currentMonthToday.shift1.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgUtilization.currentMonthToday.shift2.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgUtilization.currentMonthToday.shift3.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-semibold">
                            {reportData.abstractData.avgUtilization.currentMonthToday.average.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgUtilization.lastMonthSameDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgUtilization.currentMonthUptoDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgUtilization.lastMonthUptoDate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                        
                        {/* Worked Spindles Row */}
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="border border-gray-300 font-bold">Worked Spindles</TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.workedSpindles.currentMonthToday.shift1.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.workedSpindles.currentMonthToday.shift2.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.workedSpindles.currentMonthToday.shift3.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-semibold">
                            {reportData.abstractData.workedSpindles.currentMonthToday.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.workedSpindles.lastMonthSameDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.workedSpindles.currentMonthUptoDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.workedSpindles.lastMonthUptoDate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                        
                        {/* Average Count Row */}
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="border border-gray-300 font-bold">Average Count</TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.averageCount.currentMonthToday.shift1.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.averageCount.currentMonthToday.shift2.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.averageCount.currentMonthToday.shift3.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-semibold">
                            {reportData.abstractData.averageCount.currentMonthToday.average.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.averageCount.lastMonthSameDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.averageCount.currentMonthUptoDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.averageCount.lastMonthUptoDate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                        
                        {/* Total Wastage Row */}
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="border border-gray-300 font-bold">Total Wastage(KG)</TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalWastage.currentMonthToday.shift1.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalWastage.currentMonthToday.shift2.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalWastage.currentMonthToday.shift3.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-semibold">
                            {reportData.abstractData.totalWastage.currentMonthToday.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalWastage.lastMonthSameDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalWastage.currentMonthUptoDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalWastage.lastMonthUptoDate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                        
                        {/* AVG Wastage % Row */}
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="border border-gray-300 font-bold">AVG. Wastage(%)</TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgWastagePercent.currentMonthToday.shift1.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgWastagePercent.currentMonthToday.shift2.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgWastagePercent.currentMonthToday.shift3.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-semibold">
                            {reportData.abstractData.avgWastagePercent.currentMonthToday.average.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgWastagePercent.lastMonthSameDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgWastagePercent.currentMonthUptoDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.avgWastagePercent.lastMonthUptoDate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                        
                        {/* Total Stoppage Mins Row */}
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="border border-gray-300 font-bold">Total Stoppage Mins</TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalStoppageMins.currentMonthToday.shift1.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalStoppageMins.currentMonthToday.shift2.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalStoppageMins.currentMonthToday.shift3.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-semibold">
                            {reportData.abstractData.totalStoppageMins.currentMonthToday.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalStoppageMins.lastMonthSameDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalStoppageMins.currentMonthUptoDate.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right">
                            {reportData.abstractData.totalStoppageMins.lastMonthUptoDate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Count-wise Summary Table */}
              {reportData.countwiseSummary && (
                <div className="mt-8 print:mt-8">
                  <h3 className="text-lg font-bold mb-4 text-gray-800">Count-wise Summary</h3>
                  <div className="overflow-x-auto">
                    <Table className="border-collapse border border-gray-400">
                      <TableHeader>
                        <TableRow className="bg-purple-600 text-white">
                          <TableHead className="border border-gray-300 text-white font-bold text-center">Count</TableHead>
                          <TableHead className="border border-gray-300 text-white font-bold text-center">Production</TableHead>
                          <TableHead className="border border-gray-300 text-white font-bold text-center">Worked Spindle</TableHead>
                          <TableHead className="border border-gray-300 text-white font-bold text-center">Standard GPS</TableHead>
                          <TableHead className="border border-gray-300 text-white font-bold text-center">Achieved GPS</TableHead>
                          <TableHead className="border border-gray-300 text-white font-bold text-center">40s Conv GPS</TableHead>
                          <TableHead className="border border-gray-300 text-white font-bold text-center">Waste KGS</TableHead>
                          <TableHead className="border border-gray-300 text-white font-bold text-center">Waste %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.countwiseSummary.counts.map((count, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell className="border border-gray-300 font-semibold">{count.countName}</TableCell>
                            <TableCell className="border border-gray-300 text-right">{count.production.toFixed(2)}</TableCell>
                            <TableCell className="border border-gray-300 text-right">{count.workedSpindles.toFixed(2)}</TableCell>
                            <TableCell className="border border-gray-300 text-right">{count.standardGps.toFixed(2)}</TableCell>
                            <TableCell className="border border-gray-300 text-right">{count.achievedGps.toFixed(2)}</TableCell>
                            <TableCell className="border border-gray-300 text-right">{count.conv40sGps.toFixed(2)}</TableCell>
                            <TableCell className="border border-gray-300 text-right">{count.wasteKgs.toFixed(2)}</TableCell>
                            <TableCell className="border border-gray-300 text-right">{count.wastePercent.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        
                        {/* Total Row */}
                        <TableRow className="bg-gray-100 font-bold">
                          <TableCell className="border border-gray-300 font-bold">Total</TableCell>
                          <TableCell className="border border-gray-300 text-right font-bold">
                            {reportData.countwiseSummary.totals.production.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-bold">
                            {reportData.countwiseSummary.totals.workedSpindles.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300"></TableCell>
                          <TableCell className="border border-gray-300"></TableCell>
                          <TableCell className="border border-gray-300"></TableCell>
                          <TableCell className="border border-gray-300 text-right font-bold">
                            {reportData.countwiseSummary.totals.wasteKgs.toFixed(2)}
                          </TableCell>
                          <TableCell className="border border-gray-300 text-right font-bold">
                            {reportData.countwiseSummary.totals.wastePercent.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

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
              <p>Select a date and click "Generate Report" to view the abstract</p>
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
