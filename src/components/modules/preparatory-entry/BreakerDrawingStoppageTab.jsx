'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getBreakerDrawingStoppageEntries,
  getBreakerDrawingStoppageReasons,
  updateBreakerDrawingStoppageEntry,
  applyBreakerDrawingFullStoppage,
  applyBreakerDrawingPartialStoppage,
  getBreakerDrawingMachines,
  getBreakerDrawingMachineSetups,
  updateBreakerDrawingDetail,
  calculateBreakerDrawingValues,
  syncNewMachinesToBreakerDrawingHeader
} from '@/lib/supabase/breakerDrawingQueries'

export default function BreakerDrawingStoppageTab({ headerId, totalTime = 510, onRefresh }) {
  const [stoppageData, setStoppageData] = useState([])
  const [stoppageReasons, setStoppageReasons] = useState([])
  const [machines, setMachines] = useState([])
  const [machineSetups, setMachineSetups] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedRows, setEditedRows] = useState({})

  // Full stoppage form
  const [fullStoppage, setFullStoppage] = useState({
    reason: '',
    time: '',
    slot: '1'
  })

  // Partial stoppage form
  const [partialStoppage, setPartialStoppage] = useState({
    reason: '',
    fromMachine: '',
    toMachine: '',
    time: '',
    slot: '1'
  })

  // Load data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      // Sync any newly added machines to this header first
      await syncNewMachinesToBreakerDrawingHeader(headerId)
      
      const [stoppages, reasons, machineList, setups] = await Promise.all([
        getBreakerDrawingStoppageEntries(headerId),
        getBreakerDrawingStoppageReasons(),
        getBreakerDrawingMachines(),
        getBreakerDrawingMachineSetups()
      ])
      
      // Sort by natural machine number order (BD1, BD2, BD3, BD4)
      const sortedStoppages = stoppages?.sort((a, b) => {
        const aNum = parseInt(a.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      
      // Sort machines list for dropdowns
      const sortedMachines = machineList?.sort((a, b) => {
        const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      
      // Create machine setup map
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      
      setStoppageData(sortedStoppages)
      setStoppageReasons(reasons || [])
      setMachines(sortedMachines)
      setMachineSetups(setupMap)
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

  // Handle stoppage time change
  const handleTimeChange = (rowId, field, value) => {
    const numValue = parseInt(value) || 0
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: numValue
      }
    }))

    setStoppageData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        // Recalculate total
        updatedRow.total_stoppage_time = 
          (updatedRow.stoppage1_time || 0) +
          (updatedRow.stoppage2_time || 0) +
          (updatedRow.stoppage3_time || 0) +
          (updatedRow.stoppage4_time || 0)
        return updatedRow
      }
      return row
    }))
  }

  // Handle stoppage reason change
  const handleStoppageReasonChange = (rowId, field, value) => {
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value || null
      }
    }))

    // Find the selected reason to update the display
    const selectedReason = stoppageReasons.find(r => r.id === value)
    const stoppageField = field.replace('_id', '') // e.g., 'stoppage1_id' -> 'stoppage1'

    setStoppageData(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: value, [stoppageField]: selectedReason } : row
    ))
  }

  // Save changes
  const handleSave = async () => {
    if (Object.keys(editedRows).length === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)
    try {
      // First update stoppage entries
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => 
        updateBreakerDrawingStoppageEntry(rowId, changes)
      )

      await Promise.all(updatePromises)
      
      // Now recalculate production details based on updated stoppages
      const productionUpdatePromises = Object.keys(editedRows).map(async (rowId) => {
        const stoppageRow = stoppageData.find(s => s.id === rowId)
        if (!stoppageRow || !stoppageRow.production_detail) return null
        
        const prodDetail = stoppageRow.production_detail
        const machineId = prodDetail.machine_id
        const setup = machineSetups[machineId]
        // Speed from machine table (source of truth)
        const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? 750
        
        // Calculate new total stoppage
        const editedChanges = editedRows[rowId]
        const newTotalStoppage = 
          (editedChanges.stoppage1_time ?? stoppageRow.stoppage1_time ?? 0) +
          (editedChanges.stoppage2_time ?? stoppageRow.stoppage2_time ?? 0) +
          (editedChanges.stoppage3_time ?? stoppageRow.stoppage3_time ?? 0) +
          (editedChanges.stoppage4_time ?? stoppageRow.stoppage4_time ?? 0)
        
        // Recalculate production values with new stoppage and machine speed
        const calculated = calculateBreakerDrawingValues(
          prodDetail.act_hank || 0,
          prodDetail.act_prodn || 0,
          totalTime,
          newTotalStoppage,
          setup,
          machineSpeed  // Pass machine speed explicitly (source of truth)
        )
        
        // Update production detail
        return updateBreakerDrawingDetail(prodDetail.id, calculated)
      })
      
      await Promise.all(productionUpdatePromises.filter(Boolean))
      
      setEditedRows({})
      toast.success('Stoppage data saved and production recalculated')
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error saving stoppage data:', error)
      toast.error('Failed to save stoppage data')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply full stoppage
  const handleApplyFullStoppage = async () => {
    if (!fullStoppage.reason || !fullStoppage.time) {
      toast.warning('Please select stoppage reason and enter time')
      return
    }

    setIsSaving(true)
    try {
      await applyBreakerDrawingFullStoppage(headerId, fullStoppage.reason, parseInt(fullStoppage.time), parseInt(fullStoppage.slot))
      toast.success(`Full stoppage applied to Stoppage ${fullStoppage.slot} for all machines`)
      setFullStoppage({ reason: '', time: '', slot: '1' })
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error applying full stoppage:', error)
      toast.error('Failed to apply full stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply partial stoppage
  const handleApplyPartialStoppage = async () => {
    if (!partialStoppage.reason || !partialStoppage.fromMachine || !partialStoppage.toMachine || !partialStoppage.time) {
      toast.warning('Please fill all fields for partial stoppage')
      return
    }

    setIsSaving(true)
    try {
      await applyBreakerDrawingPartialStoppage(
        headerId,
        partialStoppage.fromMachine,
        partialStoppage.toMachine,
        partialStoppage.reason,
        parseInt(partialStoppage.time),
        parseInt(partialStoppage.slot)
      )
      toast.success(`Partial stoppage applied to Stoppage ${partialStoppage.slot} for selected machines`)
      setPartialStoppage({ reason: '', fromMachine: '', toMachine: '', time: '', slot: '1' })
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error applying partial stoppage:', error)
      toast.error('Failed to apply partial stoppage')
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
            className="bg-blue-600 hover:bg-blue-700"
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
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">ShiftTime</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Stoppage 1</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time1</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Stoppage 2</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time2</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Stoppage 3</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time3</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Stoppage 4</th>
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
                    {row.production_detail?.effi_percent?.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {totalTime}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Select
                      value={row.stoppage1?.id || undefined}
                      onValueChange={(value) => handleStoppageReasonChange(row.id, 'stoppage1_id', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-32 border-gray-300">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
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
                      value={row.stoppage2?.id || undefined}
                      onValueChange={(value) => handleStoppageReasonChange(row.id, 'stoppage2_id', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-32 border-gray-300">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
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
                      value={row.stoppage3?.id || undefined}
                      onValueChange={(value) => handleStoppageReasonChange(row.id, 'stoppage3_id', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-32 border-gray-300">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
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
                      value={row.stoppage4?.id || undefined}
                      onValueChange={(value) => handleStoppageReasonChange(row.id, 'stoppage4_id', value)}
                    >
                      <SelectTrigger className="h-6 text-xs w-32 border-gray-300">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
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
              Apply
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
              Apply
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
