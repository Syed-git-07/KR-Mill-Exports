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
  getFinisherDrawingMachineSetups,
  updateFinisherDrawingMachineSetup,
  getFinisherDrawingMachines,
  addFinisherDrawingMachine,
  removeFinisherDrawingMachine,
  bulkUpdateFinisherDrawingMachineMixing,
  getFinisherDrawingMixingOptions
} from '@/lib/supabase/finisherDrawingEntryQueries'

export default function FinisherDrawingMachineSetupTab({ onRefresh }) {
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

  // New machine form - Finisher Drawing specific defaults (Hank=0.14, Std Effi=0.90)
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    description: '',
    make_name: 'LMW',
    prodn_mixing: '64COMBED GOLD',
    speed: 350,
    shift_time: 510,
    hank_constant: 0.14,
    std_efficiency_factor: 0.90,
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
        getFinisherDrawingMachineSetups(),
        getFinisherDrawingMachines(),
        getFinisherDrawingMixingOptions()
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
            description: machine.description || `Finisher Drawing Machine ${machine.machine_no}`,
            make_name: machine.make_name || 'LMW',
            mixing: machine.prodn_mixing || '64COMBED GOLD',
            speed: machine.speed || setup?.speed || 350,
            std_prodn: setup?.std_prodn || 677.79,
            std_efficiency_factor: setup?.std_efficiency_factor || 0.90,
            hank_constant: setup?.hank_constant || 0.14,
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

  // Calculate Std Prodn - FINISHER DRAWING Formula
  const calculateStdProdn = (speed, hankConstant, stdEffiFactor, delivery, divisor = 1693, shiftTime = 510) => {
    // FINISHER DRAWING Formula: StdProdn = Speed / 1693 / Hank × TotalTime × StdEffi × Delivery
    // = 350 / 1693 / 0.14 × 510 × 0.90 × 1 = 677.79
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

        return updateFinisherDrawingMachineSetup(row.machine_id, changes)
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
    if (!newMachine.machine_no) {
      toast.warning('Please enter machine number')
      return
    }

    setIsSaving(true)
    try {
      const result = await addFinisherDrawingMachine({
        machine_no: newMachine.machine_no,
        description: newMachine.description || `Finisher Drawing Machine ${newMachine.machine_no}`,
        make_name: newMachine.make_name,
        prodn_mixing: newMachine.prodn_mixing,
        speed: newMachine.speed,
        shift_time: newMachine.shift_time,
        hank_constant: newMachine.hank_constant,
        std_efficiency_factor: newMachine.std_efficiency_factor,
        delivery: newMachine.delivery
      })
      toast.success(result.reactivated ? 'Machine reactivated successfully' : 'New machine added successfully')
      setShowAddDialog(false)
      setNewMachine({
        machine_no: '',
        description: '',
        make_name: 'LMW',
        prodn_mixing: '64COMBED GOLD',
        speed: 350,
        shift_time: 510,
        hank_constant: 0.14,
        std_efficiency_factor: 0.90,
        delivery: 1
      })
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error adding machine:', error)
      toast.error(error.message || 'Failed to add machine')
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
        removeFinisherDrawingMachine(machineId)
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
      await bulkUpdateFinisherDrawingMachineMixing(selectedRows, mixingValue)
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
      {/* Header with Refresh and Save */}
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
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
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
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-36">Description</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20">Make</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-28">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Std.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Std.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20">TYPE</th>
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
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium text-blue-700">
                    {row.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                    {row.description || `Finisher Drawing Machine ${row.machine_no}`}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    {row.make_name || 'LMW'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                    {row.mixing}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    {row.speed || 350}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium">
                    {row.std_prodn?.toFixed(2) || '677.79'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    {row.std_efficiency_factor ? Math.round(row.std_efficiency_factor * 100) : 90}%
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    {row.hank_constant || 0.14}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                    FINISHER
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons - Centered like Carding */}
      <div className="flex justify-center gap-4">
        <Button 
          variant="outline" 
          onClick={() => setShowMixingChangeDialog(true)}
          disabled={selectedRows.length === 0}
        >
          <Edit className="h-4 w-4 mr-1" />
          Count change
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add new machine
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowRemoveDialog(true)}
          disabled={selectedRows.length === 0}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Remove machine
        </Button>
      </div>

      {/* Formula Reference */}
      <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded border border-blue-200">
        <strong>Finisher Drawing Machine Setup (Hank=0.14, Std Effi=90%, Speed=350):</strong> Std Prodn = Speed / 1693 / Hank × ShiftTime × StdEffi × Delivery = 350 / 1693 / 0.14 × 510 × 0.90 × 1 = 677.79 kg
      </div>

      {/* Add Machine Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>
              Add a new Finisher Drawing machine to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Machine No.</Label>
                <Input
                  placeholder="e.g., FD11"
                  value={newMachine.machine_no}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, machine_no: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Make</Label>
                <Select
                  value={newMachine.make_name}
                  onValueChange={(value) => setNewMachine(prev => ({ ...prev, make_name: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LMW">LMW</SelectItem>
                    <SelectItem value="RIETER">RIETER</SelectItem>
                    <SelectItem value="LAKSHMI">LAKSHMI</SelectItem>
                    <SelectItem value="TRUTZSCHLER">TRUTZSCHLER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Description</Label>
              <Input
                placeholder="e.g., Finisher Drawing Machine 11"
                value={newMachine.description}
                onChange={(e) => setNewMachine(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Speed (m/min)</Label>
                <Input
                  type="number"
                  value={newMachine.speed}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, speed: parseInt(e.target.value) || 350 }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Mixing</Label>
                <Input
                  value={newMachine.prodn_mixing}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, prodn_mixing: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddMachine}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Plus className="h-4 w-4 mr-1" />
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Mixing Dialog */}
      <Dialog open={showMixingChangeDialog} onOpenChange={setShowMixingChangeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Count/Mixing</DialogTitle>
            <DialogDescription>
              Change the count/mixing for {selectedRows.length} selected machine(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Mixing</Label>
              <Select
                value={newMixing}
                onValueChange={setNewMixing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mixing" />
                </SelectTrigger>
                <SelectContent>
                  {mixingOptions.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newMixing === 'custom' && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Custom Mixing</Label>
                <Input
                  placeholder="Enter custom mixing"
                  value={customMixing}
                  onChange={(e) => setCustomMixing(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMixingChangeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangeMixing}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Edit className="h-4 w-4 mr-1" />
              Apply Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Remove Machine(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedRows.length} machine(s)? This action will deactivate the machines.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRemoveMachine}
              disabled={isSaving}
              variant="destructive"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
