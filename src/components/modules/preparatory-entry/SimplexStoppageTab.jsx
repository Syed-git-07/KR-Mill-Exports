'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import {
  getSimplexStoppageEntries,
  updateSimplexStoppageEntry,
  applySimplexFullStoppage,
  applySimplexPartialStoppage,
  getSimplexStoppageReasons,
  getSimplexMachines
} from '@/lib/supabase/simplexEntryQueries'

export default function SimplexStoppageTab({
  headerId,
  totalTime = 510,
  onRefresh
}) {
  const [stoppageData, setStoppageData] = useState([])
  const [stoppageReasons, setStoppageReasons] = useState([])
  const [machines, setMachines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedRows, setEditedRows] = useState({})

  // Full Stoppage State
  const [fullStoppage, setFullStoppage] = useState({
    slot: '1',
    reason: '',
    time: ''
  })

  // Partial Stoppage State
  const [partialStoppage, setPartialStoppage] = useState({
    slot: '1',
    reason: '',
    time: '',
    fromMachine: '',
    toMachine: ''
  })

  // Load data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      const [stoppages, reasons, machineList] = await Promise.all([
        getSimplexStoppageEntries(headerId),
        getSimplexStoppageReasons(),
        getSimplexMachines()
      ])
      
      // Sort by natural machine number order (1, 2, 3... 10)
      const sortedStoppages = stoppages?.sort((a, b) => {
        const aNum = parseInt(a.production_detail?.machine?.machine_no || '0')
        const bNum = parseInt(b.production_detail?.machine?.machine_no || '0')
        return aNum - bNum
      }) || []
      
      // Sort machines list for dropdowns
      const sortedMachines = machineList?.sort((a, b) => {
        const aNum = parseInt(a.machine_no || '0')
        const bNum = parseInt(b.machine_no || '0')
        return aNum - bNum
      }) || []
      
      setStoppageData(sortedStoppages)
      setStoppageReasons(reasons || [])
      setMachines(sortedMachines)
    } catch (error) {
      console.error('Error loading stoppage data:', error)
      toast.error('Failed to load stoppage data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle stoppage reason change
  const handleStoppageReasonChange = (rowId, field, value) => {
    // Handle "none" option to clear the stoppage
    const actualValue = value === 'none' ? null : value
    
    setStoppageData(prev => prev.map(row => {
      if (row.id !== rowId) return row
      
      // Clear the relationship object and set the new ID
      const fieldBase = field.replace('_id', '') // e.g., 'stoppage1'
      return { 
        ...row, 
        [field]: actualValue,
        [fieldBase]: actualValue ? { id: actualValue } : null
      }
    }))
    setEditedRows(prev => ({ ...prev, [rowId]: true }))
  }

  // Handle time change
  const handleTimeChange = (rowId, field, value) => {
    const numValue = parseInt(value) || 0
    setStoppageData(prev => prev.map(row => {
      if (row.id !== rowId) return row
      
      const updatedRow = { ...row, [field]: numValue }
      
      // Recalculate total stoppage time
      const total = 
        (field === 'stoppage1_time' ? numValue : (updatedRow.stoppage1_time || 0)) +
        (field === 'stoppage2_time' ? numValue : (updatedRow.stoppage2_time || 0)) +
        (field === 'stoppage3_time' ? numValue : (updatedRow.stoppage3_time || 0)) +
        (field === 'stoppage4_time' ? numValue : (updatedRow.stoppage4_time || 0))
      
      updatedRow.total_stoppage_time = total
      return updatedRow
    }))
    setEditedRows(prev => ({ ...prev, [rowId]: true }))
  }

  // Handle save
  const handleSave = async () => {
    const editedRowIds = Object.keys(editedRows)
    if (editedRowIds.length === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)
    try {
      const rowsToSave = stoppageData.filter(row => editedRows[row.id])
      
      for (const row of rowsToSave) {
        await updateSimplexStoppageEntry(row.id, {
          stoppage1_id: row.stoppage1_id || null,
          stoppage1_time: row.stoppage1_id ? (row.stoppage1_time || 0) : 0,
          stoppage2_id: row.stoppage2_id || null,
          stoppage2_time: row.stoppage2_id ? (row.stoppage2_time || 0) : 0,
          stoppage3_id: row.stoppage3_id || null,
          stoppage3_time: row.stoppage3_id ? (row.stoppage3_time || 0) : 0,
          stoppage4_id: row.stoppage4_id || null,
          stoppage4_time: row.stoppage4_id ? (row.stoppage4_time || 0) : 0
        })
      }

      toast.success(`${rowsToSave.length} row(s) saved successfully`)
      setEditedRows({})
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error saving stoppage data:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply Full Stoppage
  const handleApplyFullStoppage = async () => {
    if (!fullStoppage.reason || !fullStoppage.time) {
      toast.error('Please select a reason and enter time')
      return
    }

    if (!headerId) {
      toast.error('No production header found')
      return
    }

    setIsSaving(true)
    try {
      await applySimplexFullStoppage(
        headerId,
        fullStoppage.reason,
        parseInt(fullStoppage.time) || 0,
        parseInt(fullStoppage.slot)
      )
      
      toast.success('Full stoppage applied to all machines')
      setFullStoppage({ slot: '1', reason: '', time: '' })
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error applying full stoppage:', error)
      toast.error('Failed to apply stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply Partial Stoppage
  const handleApplyPartialStoppage = async () => {
    if (!partialStoppage.reason || !partialStoppage.time) {
      toast.error('Please select a reason and enter time')
      return
    }

    if (!partialStoppage.fromMachine || !partialStoppage.toMachine) {
      toast.error('Please select machine range')
      return
    }

    if (!headerId) {
      toast.error('No production header found')
      return
    }

    setIsSaving(true)
    try {
      await applySimplexPartialStoppage(
        headerId,
        partialStoppage.fromMachine,
        partialStoppage.toMachine,
        partialStoppage.reason,
        parseInt(partialStoppage.time) || 0,
        parseInt(partialStoppage.slot)
      )
      
      toast.success(`Partial stoppage applied to machines ${partialStoppage.fromMachine} - ${partialStoppage.toMachine}`)
      setPartialStoppage({ slot: '1', reason: '', time: '', fromMachine: '', toMachine: '' })
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error applying partial stoppage:', error)
      toast.error('Failed to apply stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading stoppage data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {stoppageData.length} machines | Shift Time: {totalTime} mins
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isSaving || Object.keys(editedRows).length === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Stoppage Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">ActEffi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">R.Time</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40">Stoppage 1</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time1</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40">Stoppage 2</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time2</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40">Stoppage 3</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time3</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40">Stoppage 4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time4</th>
              </tr>
            </thead>
            <tbody>
              {stoppageData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700">
                    {row.production_detail?.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    {row.production_detail?.session_no || 1}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {row.production_detail?.act_effi_percent?.toFixed(2) || '0.00'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {totalTime}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Select
                      value={row.stoppage1_id || row.stoppage1?.id || ''}
                      onValueChange={(value) => handleStoppageReasonChange(row.id, 'stoppage1_id', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-36 border-gray-300">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-gray-400">No Stoppage</span>
                        </SelectItem>
                        {stoppageReasons.map(reason => (
                          <SelectItem key={reason.id} value={reason.id}>
                            {reason.stoppage_name}--&gt;{reason.short_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.stoppage1_time || ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage1_time', e.target.value)}
                      className="h-6 text-xs text-right w-14 border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Select
                      value={row.stoppage2_id || row.stoppage2?.id || ''}
                      onValueChange={(value) => handleStoppageReasonChange(row.id, 'stoppage2_id', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-36 border-gray-300">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-gray-400">No Stoppage</span>
                        </SelectItem>
                        {stoppageReasons.map(reason => (
                          <SelectItem key={reason.id} value={reason.id}>
                            {reason.stoppage_name}--&gt;{reason.short_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.stoppage2_time || ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage2_time', e.target.value)}
                      className="h-6 text-xs text-right w-14 border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Select
                      value={row.stoppage3_id || row.stoppage3?.id || ''}
                      onValueChange={(value) => handleStoppageReasonChange(row.id, 'stoppage3_id', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-36 border-gray-300">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-gray-400">No Stoppage</span>
                        </SelectItem>
                        {stoppageReasons.map(reason => (
                          <SelectItem key={reason.id} value={reason.id}>
                            {reason.stoppage_name}--&gt;{reason.short_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.stoppage3_time || ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage3_time', e.target.value)}
                      className="h-6 text-xs text-right w-14 border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Select
                      value={row.stoppage4_id || row.stoppage4?.id || ''}
                      onValueChange={(value) => handleStoppageReasonChange(row.id, 'stoppage4_id', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-36 border-gray-300">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-gray-400">No Stoppage</span>
                        </SelectItem>
                        {stoppageReasons.map(reason => (
                          <SelectItem key={reason.id} value={reason.id}>
                            {reason.stoppage_name}--&gt;{reason.short_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.stoppage4_time || ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage4_time', e.target.value)}
                      className="h-6 text-xs text-right w-14 border-gray-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stoppage Application Forms */}
      <div className="grid grid-cols-2 gap-6">
        {/* Full Stoppage */}
        <Card className="border-2">
          <CardHeader className="py-4 bg-gray-50">
            <CardTitle className="text-base font-semibold">Full Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Stoppage Slot</Label>
                <Select
                  value={fullStoppage.slot}
                  onValueChange={(value) => setFullStoppage(prev => ({ ...prev, slot: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Stoppage 1</SelectItem>
                    <SelectItem value="2">Stoppage 2</SelectItem>
                    <SelectItem value="3">Stoppage 3</SelectItem>
                    <SelectItem value="4">Stoppage 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Time (mins)</Label>
                <Input
                  type="number"
                  placeholder="Minutes"
                  value={fullStoppage.time}
                  onChange={(e) => setFullStoppage(prev => ({ ...prev, time: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Stoppage Reason</Label>
              <Select
                value={fullStoppage.reason || undefined}
                onValueChange={(value) => setFullStoppage(prev => ({ ...prev, reason: value }))}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select stoppage reason" />
                </SelectTrigger>
                <SelectContent>
                  {stoppageReasons.map(reason => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.stoppage_name}--&gt;{reason.short_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleApplyFullStoppage}
              disabled={isSaving}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply to All Machines
            </Button>
          </CardContent>
        </Card>

        {/* Partial Stoppage */}
        <Card className="border-2">
          <CardHeader className="py-4 bg-gray-50">
            <CardTitle className="text-base font-semibold">Partial Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Stoppage Slot</Label>
                <Select
                  value={partialStoppage.slot}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, slot: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Stoppage 1</SelectItem>
                    <SelectItem value="2">Stoppage 2</SelectItem>
                    <SelectItem value="3">Stoppage 3</SelectItem>
                    <SelectItem value="4">Stoppage 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Time (mins)</Label>
                <Input
                  type="number"
                  placeholder="Minutes"
                  value={partialStoppage.time}
                  onChange={(e) => setPartialStoppage(prev => ({ ...prev, time: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Stoppage Reason</Label>
              <Select
                value={partialStoppage.reason || undefined}
                onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, reason: value }))}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select stoppage reason" />
                </SelectTrigger>
                <SelectContent>
                  {stoppageReasons.map(reason => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.stoppage_name}--&gt;{reason.short_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">From M/c No.</Label>
                <Select
                  value={partialStoppage.fromMachine || undefined}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, fromMachine: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="From" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map(m => (
                      <SelectItem key={m.id} value={m.machine_no}>
                        {m.machine_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">To M/c No.</Label>
                <Select
                  value={partialStoppage.toMachine || undefined}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, toMachine: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="To" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map(m => (
                      <SelectItem key={m.id} value={m.machine_no}>
                        {m.machine_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleApplyPartialStoppage}
              disabled={isSaving}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply to Range
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
