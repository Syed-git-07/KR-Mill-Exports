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

const BASELINE_POSITION_ROWS = [1, 2, 3, 4, 5].map(position => ({
  position,
  occurrence: 0,
  label: String(position),
}))

const chunkGroups = (groups, size = 13) => {
  const chunks = []
  for (let index = 0; index < groups.length; index += size) {
    chunks.push(groups.slice(index, index + size))
  }
  return chunks
}

const getDateKey = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

const displayDateKey = value => {
  const dateKey = getDateKey(value)
  if (!dateKey) return 'Invalid date'
  const [year, month, day] = dateKey.split('-')
  return `${day}-${month}-${year}`
}

const abbreviatedCount = value => String(value || '').replace('COMBED STAR', 'CS')

const formatMachineCell = (machine, group, positionRow) => {
  if (!machine) return ''
  const efficiency = Number(machine.efficiency)
  const formattedEfficiency = Number.isFinite(efficiency) ? efficiency.toFixed(2) : '0.00'
  const needsMachineLabel = !group.isBaseline || positionRow.occurrence > 0
  return needsMachineLabel
    ? `${machine.machine_no}: ${formattedEfficiency}`
    : formattedEfficiency
}

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
      doc.text(`Date: ${displayDateKey(reportData.date)}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      let renderedTable = false
      reportData.shifts.forEach(shift => {
        const positionRows = shift.positionRows?.length
          ? shift.positionRows
          : BASELINE_POSITION_ROWS

        chunkGroups(shift.groups).forEach((groups, groupPageIndex) => {
          if (renderedTable) {
            doc.addPage()
            yPos = 15
          }
          renderedTable = true

          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          const continuation = groupPageIndex > 0 ? ' (continued)' : ''
          doc.text(`Shift ${shift.shift}: ${shift.supervisor_name}${continuation}`, 14, yPos)
          yPos += 5

          const headers = [
            ' ',
            ...groups.map(group => group.headerLabel ?? group.groupNumber ?? group.groupName),
          ]
          const countRow = [
            abbreviatedCount(shift.primary_count),
            ...groups.map(group => abbreviatedCount(group.count)),
          ]
          const bodyRows = positionRows.map((positionRow, positionIndex) => [
            positionRow.label,
            ...groups.map(group => formatMachineCell(
              group.machines[positionIndex],
              group,
              positionRow
            )),
          ])

          autoTable(doc, {
            startY: yPos,
            head: [headers, countRow],
            body: bodyRows,
            theme: 'grid',
            headStyles: {
              fillColor: [22, 163, 74],
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
      })

      // Add designations footer on last page
      let totalPages = doc.getNumberOfPages()
      doc.setPage(totalPages)

      const pageHeight = doc.internal.pageSize.getHeight()
      if ((doc.lastAutoTable?.finalY || 0) > pageHeight - 35) {
        doc.addPage()
        totalPages = doc.getNumberOfPages()
        doc.setPage(totalPages)
      }

      yPos = pageHeight - 25
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setLineWidth(0.3)
      doc.line(14, yPos - 5, pageWidth - 14, yPos - 5)
      
      const signatoriesText = 'AM(P)          GM          MD'
      doc.text(signatoriesText, pageWidth / 2, yPos, { align: 'center' })

      const filename = `Autoconer_Efficiency_${displayDateKey(reportData.date)}.pdf`
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
            <p className="text-sm font-medium">Date: {displayDateKey(reportData.date)}</p>
          </div>

          {/* Shift Grids */}
          {reportData.shifts.map(shift => {
            const positionRows = shift.positionRows?.length
              ? shift.positionRows
              : BASELINE_POSITION_ROWS

            return (
              <div key={shift.shift} className="mb-8 page-break-after">
                <h3 className="text-lg font-semibold mb-3">
                  Shift {shift.shift}: {shift.supervisor_name}
                </h3>

                {chunkGroups(shift.groups).map((groups, groupPageIndex) => (
                  <div
                    key={`${shift.shift}-${groupPageIndex}`}
                    className="overflow-x-auto mb-5"
                  >
                    {groupPageIndex > 0 && (
                      <p className="text-sm font-semibold mb-2">
                        Shift {shift.shift} continued
                      </p>
                    )}
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-green-600 text-white">
                          <th className="border border-gray-300 px-2 py-1"></th>
                          {groups.map(group => (
                            <th
                              key={group.groupKey || group.groupName}
                              className="border border-gray-300 px-2 py-1 text-center font-bold"
                            >
                              {group.headerLabel ?? group.groupNumber ?? group.groupName}
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-green-600 text-white">
                          <th className="border border-gray-300 px-2 py-1 text-center">
                            {abbreviatedCount(shift.primary_count)}
                          </th>
                          {groups.map(group => (
                            <th
                              key={group.groupKey || group.groupName}
                              className="border border-gray-300 px-2 py-1 text-center text-xs font-semibold"
                            >
                              {abbreviatedCount(group.count)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {positionRows.map((positionRow, positionIndex) => (
                          <tr
                            key={`${positionRow.position}-${positionRow.occurrence}`}
                            className="hover:bg-gray-50"
                          >
                            <td className="border border-gray-300 px-2 py-1 text-center font-bold bg-gray-100">
                              {positionRow.label}
                            </td>
                            {groups.map(group => {
                              const machine = group.machines[positionIndex]
                              return (
                                <td
                                  key={group.groupKey || group.groupName}
                                  className="border border-gray-300 px-2 py-1 text-center"
                                  title={machine
                                    ? `${machine.machine_no} - ${machine.count}`
                                    : undefined}
                                >
                                  {formatMachineCell(machine, group, positionRow)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )
          })}

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
