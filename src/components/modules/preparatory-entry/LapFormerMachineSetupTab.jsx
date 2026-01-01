'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Save, RefreshCw, Plus, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import {
  getLapFormerMachineSetups,
  updateLapFormerMachineSetup,
  getLapFormerMachines,
  addLapFormerMachine,
  removeLapFormerMachine,
  bulkUpdateLapFormerMachineMixing,
  getLapFormerMixingOptions
} from '@/lib/supabase/lapFormerQueries'

export default function LapFormerMachineSetupTab({ onRefresh }) {
  const [setupData, setSetupData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedRows, setEditedRows] = useState({})
  const [selectedRows, setSelectedRows] = useState([])
  const [mixingOptions, setMixingOptions] = useState([])

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showMixingChangeDialog, setShowMixingChangeDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // New machine form - Lap Former specific defaults (Hank=0.0082, NOT 0.14)
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    make_name: 'LMW',
    prodn_mixing: '64COMBED GOLD',
    speed: 90,
    shift_time: 510,
    hank_constant: 0.0082,
    std_efficiency_factor: 0.85,
    delivery: 1
  })

  // Mixing change form
  const [newMixing, setNewMixing] = useState('')
  const [customMixing, setCustomMixing] = useState('')

  // Load machine setups
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [setups, machineList, mixings] = await Promise.all([
        getLapFormerMachineSetups(),
        getLapFormerMachines(),
        getLapFormerMixingOptions()
      ])
      
      // Merge setup data with machine info for display
      const mergedData = (machineList || [])
        .filter(m => m.is_active !== false)
        .map(machine => {
          const setup = (setups || []).find(s => s.machine_id === machine.id)
          return {
            id: setup?.id || `new-${machine.id}`,
            machine_id: machine.id,
            machine_no: machine.machine_no,
            make_name: machine.make_name || 'LMW',
            mixing: machine.prodn_mixing || '64COMBED GOLD',
            speed: machine.speed || setup?.speed || 90,
            std_prodn: setup?.std_prodn || 0,
            std_efficiency_factor: setup?.std_efficiency_factor || 0.85,
            hank_constant: setup?.hank_constant || 0.0082,
            divisor_constant: setup?.divisor_constant || 1693,
            delivery: setup?.delivery || 1,
            shift_time: setup?.shift_time || 510,
            is_active: machine.is_active ?? true,
            isNewSetup: !setup
          }
        })
        .sort((a, b) => {
          const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0')
          const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0')
          return aNum - bNum
        })
      
      setSetupData(mergedData)
      setMixingOptions(mixings || [])
    } catch (error) {
      console.error('Error loading machine setups:', error)
      toast.error('Failed to load machine setups')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Calculate Std Prodn - LAP FORMER Formula
  const calculateStdProdn = (speed, hankConstant, stdEffiFactor, delivery, divisor = 1693, shiftTime = 510) => {
    // LAP FORMER Formula: StdProdn = Speed / 1693 / Hank × TotalTime × StdEffi × Delivery
    if (!speed || !hankConstant) return 0
    return (speed / divisor / hankConstant) * shiftTime * stdEffiFactor * delivery
  }

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    const numValue = parseFloat(value) || 0
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: numValue
      }
    }))

    // Update display data and recalculate std_prodn
    setSetupData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        
        // Recalculate std_prodn when relevant fields change
        if (['speed', 'hank_constant', 'std_efficiency_factor', 'shift_time', 'divisor_constant', 'delivery'].includes(field)) {
          const speed = field === 'speed' ? numValue : row.speed
          const hankConstant = field === 'hank_constant' ? numValue : row.hank_constant
          const stdEffi = field === 'std_efficiency_factor' ? numValue : row.std_efficiency_factor
          const shiftTime = field === 'shift_time' ? numValue : row.shift_time
          const divisor = field === 'divisor_constant' ? numValue : row.divisor_constant
          const delivery = field === 'delivery' ? numValue : row.delivery
          
          updatedRow.std_prodn = Math.round(calculateStdProdn(speed, hankConstant, stdEffi, delivery, divisor, shiftTime) * 100) / 100
        }
        
        return updatedRow
      }
      return row
    }))
  }

  // Save changes
  const handleSave = async () => {
    if (Object.keys(editedRows).length === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)
    try {
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => {
        const row = setupData.find(r => r.id === rowId)
        if (!row) return null

        return updateLapFormerMachineSetup(row.machine_id, changes)
      }).filter(Boolean)

      await Promise.all(updatePromises)
      setEditedRows({})
      toast.success('Machine setups saved successfully')
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error saving machine setups:', error)
      toast.error('Failed to save machine setups')
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle row selection
  const handleRowSelect = (machineId) => {
    setSelectedRows(prev => 
      prev.includes(machineId) 
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    )
  }

  // Select all rows
  const handleSelectAll = () => {
    if (selectedRows.length === setupData.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(setupData.map(row => row.machine_id))
    }
  }

  // Add new machine
  const handleAddMachine = async () => {
    setIsSaving(true)
    try {
      await addLapFormerMachine(newMachine)
      toast.success('New machine added successfully')
      setShowAddDialog(false)
      setNewMachine({
        machine_no: '',
        make_name: 'LMW',
        prodn_mixing: '64COMBED GOLD',
        speed: 90,
        shift_time: 510,
        hank_constant: 0.0082,
        std_efficiency_factor: 0.85,
        delivery: 1
      })
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error adding machine:', error)
      toast.error('Failed to add machine')
    } finally {
      setIsSaving(false)
    }
  }

  // Remove machine
  const handleRemoveMachine = async () => {
    if (selectedRows.length === 0) {
      toast.warning('Please select at least one machine')
      return
    }

    setIsSaving(true)
    try {
      const removePromises = selectedRows.map(machineId => 
        removeLapFormerMachine(machineId)
      )
      await Promise.all(removePromises)
      toast.success(`${selectedRows.length} machine(s) removed`)
      setShowRemoveDialog(false)
      setSelectedRows([])
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error removing machines:', error)
      toast.error('Failed to remove machines')
    } finally {
      setIsSaving(false)
    }
  }

  // Change count/mixing for selected machines
  const handleChangeMixing = async () => {
    const mixingValue = newMixing === 'custom' ? customMixing : newMixing
    
    if (!mixingValue) {
      toast.warning('Please select or enter a mixing value')
      return
    }

    if (selectedRows.length === 0) {
      toast.warning('Please select at least one machine')
      return
    }

    setIsSaving(true)
    try {
      await bulkUpdateLapFormerMachineMixing(selectedRows, mixingValue)
      toast.success(`Count/Mixing updated for ${selectedRows.length} machine(s)`)
      setShowMixingChangeDialog(false)
      setNewMixing('')
      setCustomMixing('')
      setSelectedRows([])
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error updating mixing:', error)
      toast.error('Failed to update mixing')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading machine setups...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {setupData.length} machines configured
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

      {/* Machine Setup Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 w-10">
                  <Checkbox
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="border-white"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-24">Make</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-28">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20">Shift Time</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24">Std.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Std.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Sl.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {setupData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} ${selectedRows.includes(row.machine_id) ? 'bg-blue-100' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <Checkbox
                      checked={selectedRows.includes(row.machine_id)}
                      onCheckedChange={() => handleRowSelect(row.machine_id)}
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700">
                    {row.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {row.make_name || 'LMW'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {row.mixing || '64COMBED GOLD'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    1
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.shift_time || 510}
                      onChange={(e) => handleInputChange(row.id, 'shift_time', e.target.value)}
                      className="h-6 text-xs text-right w-full border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium text-blue-700">
                    {row.std_prodn?.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.speed || 90}
                      onChange={(e) => handleInputChange(row.id, 'speed', e.target.value)}
                      className="h-6 text-xs text-right w-full border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="1"
                      value={Math.round((row.std_efficiency_factor || 0.85) * 100)}
                      onChange={(e) => handleInputChange(row.id, 'std_efficiency_factor', parseFloat(e.target.value) / 100)}
                      className="h-6 text-xs text-right w-full border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="0.0001"
                      value={row.hank_constant || 0.0082}
                      onChange={(e) => handleInputChange(row.id, 'hank_constant', e.target.value)}
                      className="h-6 text-xs text-right w-full border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.delivery || 1}
                      onChange={(e) => handleInputChange(row.id, 'delivery', e.target.value)}
                      className="h-6 text-xs text-right w-full border-gray-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons - VB6 Layout */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowMixingChangeDialog(true)}
            disabled={selectedRows.length === 0}
          >
            <Edit className="h-4 w-4 mr-1" />
            Count change {selectedRows.length > 0 && `(${selectedRows.length})`}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add new machine
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowRemoveDialog(true)}
            disabled={selectedRows.length === 0}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove machine {selectedRows.length > 0 && `(${selectedRows.length})`}
          </Button>
        </div>
        <span className="text-sm text-gray-500">
          {selectedRows.length > 0 && (
            <span className="text-blue-600 font-medium mr-4">
              {selectedRows.length} machine(s) selected
            </span>
          )}
          {Object.keys(editedRows).length > 0 && (
            <span className="text-yellow-600 font-medium">
              {Object.keys(editedRows).length} row(s) modified
            </span>
          )}
        </span>
      </div>

      {/* Formula Reference */}
      <div className="p-3 bg-gray-100 rounded text-xs text-gray-600">
        <strong>Formula:</strong> Std Prodn = (Speed / 1693 / Sliver Hank) × Shift Time × (Std. Effi. / 100) × Delivery
        <br />
        <strong>Example:</strong> LF1: (120 / 1693 / 0.0082) × 510 × 0.85 × 1 = 3747.14 kg
        <br />
        <strong>Note:</strong> Lap Former uses Hank = <span className="text-red-600 font-bold">0.0082</span> (NOT 0.14 like Breaker Drawing)
      </div>

      {/* Add Machine Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Machine</DialogTitle>
            <DialogDescription className="text-sm">Enter details for the new Lap Former machine</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Machine No (optional)</Label>
                <Input
                  value={newMachine.machine_no}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, machine_no: e.target.value }))}
                  placeholder="Auto-generated (LF4, LF5...)"
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Make Name</Label>
                <Input
                  value={newMachine.make_name}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, make_name: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Count / Mixing</Label>
              <Input
                value={newMachine.prodn_mixing}
                onChange={(e) => setNewMachine(prev => ({ ...prev, prodn_mixing: e.target.value }))}
                className="h-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Speed</Label>
                <Input
                  type="number"
                  value={newMachine.speed}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, speed: parseFloat(e.target.value) || 90 }))}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Shift Time</Label>
                <Input
                  type="number"
                  value={newMachine.shift_time}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, shift_time: parseInt(e.target.value) || 510 }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Sliver Hank</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={newMachine.hank_constant}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, hank_constant: parseFloat(e.target.value) || 0.0082 }))}
                  className="h-10 text-sm"
                />
                <span className="text-xs text-red-500">Default: 0.0082</span>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Std. Efficiency (%)</Label>
                <Input
                  type="number"
                  value={(newMachine.std_efficiency_factor * 100).toFixed(0)}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, std_efficiency_factor: (parseFloat(e.target.value) || 85) / 100 }))}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Delivery</Label>
                <Input
                  type="number"
                  value={newMachine.delivery}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, delivery: parseInt(e.target.value) || 1 }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="h-10 px-6">Cancel</Button>
            <Button onClick={handleAddMachine} disabled={isSaving} className="h-10 px-6 bg-blue-600 hover:bg-blue-700">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Count Change Dialog */}
      <Dialog open={showMixingChangeDialog} onOpenChange={setShowMixingChangeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Change Count</DialogTitle>
            <DialogDescription className="text-sm">Update count/mixing for {selectedRows.length} selected machine(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Existing Count</Label>
              <Select
                value={newMixing}
                onValueChange={(value) => { setNewMixing(value); setCustomMixing(''); }}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Choose existing count..." />
                </SelectTrigger>
                <SelectContent>
                  {mixingOptions.map(count => (
                    <SelectItem key={count} value={count}>{count}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-center text-sm text-gray-500 font-medium">- OR -</div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Enter New Count</Label>
              <Input
                value={customMixing}
                onChange={(e) => { setCustomMixing(e.target.value); setNewMixing(''); }}
                placeholder="Enter new count..."
                className="h-10 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowMixingChangeDialog(false)} className="h-10 px-6">Cancel</Button>
            <Button onClick={handleChangeMixing} disabled={isSaving || (!newMixing && !customMixing)} className="h-10 px-6 bg-blue-600 hover:bg-blue-700">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply to {selectedRows.length} Machine(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Remove Machines</DialogTitle>
            <DialogDescription className="text-sm">
              Are you sure you want to remove {selectedRows.length} selected machine(s)? 
              This will deactivate them from the system.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Warning:</strong> Removing machines will affect any future production entries.
            Existing production data will be preserved.
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)} className="h-10 px-6">Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleRemoveMachine} 
              disabled={isSaving}
              className="h-10 px-6"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove {selectedRows.length} Machine(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
