'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { format, parse, isValid } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { bulkCreateHolidaysAction } from '@/app/actions/holiday-list'

function parseDateValue(value) {
  if (!value) return null
  
  // Excel serial number date format (e.g. 45312)
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + value * 86400000)
    if (isValid(date)) return format(date, 'yyyy-MM-dd')
  }

  const str = String(value).trim()

  // Standard YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
  }

  // DD-MM-YYYY or DD/MM/YYYY format
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(str)) {
    const parts = str.split(/[-\/]/)
    const day = parts[0].padStart(2, '0')
    const month = parts[1].padStart(2, '0')
    const year = parts[2]
    return `${year}-${month}-${day}`
  }

  // MM-DD-YYYY or MM/DD/YYYY format fallback
  const parsed = new Date(str)
  if (isValid(parsed)) {
    return format(parsed, 'yyyy-MM-dd')
  }

  return null
}

export default function ImportHolidaysModal({ open, onOpenChange, holidayList, existingHolidays = [], onSuccess }) {
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [isImporting, setIsImporting] = useState(false)

  const handleReset = () => {
    setFile(null)
    setParsedRows([])
    setIsImporting(false)
  }

  const handleClose = () => {
    handleReset()
    onOpenChange(false)
  }

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      { Date: '2026-01-15', Description: 'Pongal / Makar Sankranti' },
      { Date: '2026-01-26', Description: 'Republic Day' },
      { Date: '2026-05-01', Description: 'May Day' },
      { Date: '2026-08-15', Description: 'Independence Day' },
      { Date: '2026-10-20', Description: 'Diwali' },
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Holidays')
    XLSX.writeFile(workbook, 'Holiday_Import_Template.xlsx')
  }

  // File Upload Handler
  const handleFileUpload = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const workbook = XLSX.read(bstr, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

        if (!rawJson || rawJson.length === 0) {
          toast.error('The selected file is empty')
          setParsedRows([])
          return
        }

        const existingDateSet = new Set((existingHolidays || []).map(h => String(h.date).split('T')[0]))

        const listStart = holidayList?.startDate ? String(holidayList.startDate).split('T')[0] : null
        const listEnd = holidayList?.endDate ? String(holidayList.endDate).split('T')[0] : null

        const processed = rawJson.map((row, idx) => {
          // Flexible key lookup
          const rawDateKey = Object.keys(row).find(k => /date|day/i.test(k)) || Object.keys(row)[0]
          const rawDescKey = Object.keys(row).find(k => /desc|name|title|reason/i.test(k)) || Object.keys(row)[1]

          const rawDate = row[rawDateKey]
          const description = String(row[rawDescKey] || '').trim()
          const parsedDate = parseDateValue(rawDate)

          let status = 'valid'
          let statusText = 'Ready to import'

          if (!parsedDate) {
            status = 'invalid'
            statusText = 'Invalid date format'
          } else if (!description) {
            status = 'invalid'
            statusText = 'Missing description'
          } else if (listStart && listEnd && (parsedDate < listStart || parsedDate > listEnd)) {
            status = 'out_of_bounds'
            statusText = `Outside list range (${listStart} to ${listEnd})`
          } else if (existingDateSet.has(parsedDate)) {
            status = 'duplicate'
            statusText = 'Date already exists in holiday list'
          }

          return {
            id: idx,
            date: parsedDate || String(rawDate || '-'),
            description: description || '-',
            status,
            statusText
          }
        })

        setParsedRows(processed)
      } catch (err) {
        console.error('Error parsing file:', err)
        toast.error('Failed to parse file. Please upload a valid Excel or CSV file.')
      }
    }
    reader.readAsBinaryString(selectedFile)
  }

  const validRows = parsedRows.filter(r => r.status === 'valid')

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error('No valid holidays to import')
      return
    }

    if (!holidayList?.id) {
      toast.error('Holiday list not selected')
      return
    }

    try {
      setIsImporting(true)
      const res = await bulkCreateHolidaysAction(holidayList.id, validRows)
      if (res.success) {
        toast.success(`Successfully imported ${res.count} holiday(s)!`)
        onSuccess?.()
        handleClose()
      } else {
        toast.error('Import failed: ' + res.error)
      }
    } catch (err) {
      toast.error('Import failed: ' + err.message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Import Holidays from Excel / CSV
          </DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx, .xls) or CSV file to import multiple holidays into <strong>{holidayList?.listName || 'Holiday List'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-xs text-blue-900 font-medium">
              Expected Columns: <strong>Date</strong> (YYYY-MM-DD or DD-MM-YYYY) and <strong>Description</strong>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs bg-white hover:bg-blue-100">
              <Download className="h-3.5 w-3.5" /> Download Template
            </Button>
          </div>

          {/* File Upload Box */}
          <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-6 text-center cursor-pointer transition-colors bg-gray-50/50">
            <input
              type="file"
              id="excel-file-input"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="excel-file-input" className="cursor-pointer block space-y-2">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
              <div className="font-medium text-sm text-gray-700">
                {file ? file.name : 'Click to upload or drag Excel / CSV file here'}
              </div>
              <p className="text-xs text-muted-foreground">Supports .xlsx, .xls, and .csv files</p>
            </label>
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Total parsed rows: <strong>{parsedRows.length}</strong></span>
                <span className="text-green-700 font-semibold">Valid: {validRows.length}</span>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 sticky top-0 font-medium text-gray-700">
                    <tr>
                      <th className="p-2 border-b">Date</th>
                      <th className="p-2 border-b">Description</th>
                      <th className="p-2 border-b text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="p-2 font-mono">{row.date}</td>
                        <td className="p-2">{row.description}</td>
                        <td className="p-2 text-right">
                          {row.status === 'valid' && (
                            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                            </span>
                          )}
                          {row.status === 'duplicate' && (
                            <span className="inline-flex items-center gap-1 text-yellow-700 font-medium" title={row.statusText}>
                              <AlertCircle className="h-3.5 w-3.5" /> Already Exists
                            </span>
                          )}
                          {row.status === 'out_of_bounds' && (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium" title={row.statusText}>
                              <AlertCircle className="h-3.5 w-3.5" /> Out of Range
                            </span>
                          )}
                          {row.status === 'invalid' && (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium" title={row.statusText}>
                              <XCircle className="h-3.5 w-3.5" /> {row.statusText}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={validRows.length === 0 || isImporting}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {isImporting ? 'Importing...' : `Import ${validRows.length} Valid Holiday(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
