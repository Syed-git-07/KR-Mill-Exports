'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, Plus, Trash2, Edit, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  updateSimplexMachineSetup,
  bulkUpdateSimplexMachineCount,
  getSimplexCountOptions,
  addSimplexMachine,
  removeSimplexMachine
} from '@/lib/supabase/simplexEntryQueries'

export default function SimplexMachineSetupTab({
  machineSetupData = [],
  onDataRefresh
}) {
  const [localData, setLocalData] = useState([])
  const [editedRows, setEditedRows] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [selectedRows, setSelectedRows] = useState([])
  
  // Dialog states
  const [showCountChangeDialog, setShowCountChangeDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  
  // Count change form
  const [newCount, setNewCount] = useState('')
  const [customCount, setCustomCount] = useState('')
  const [countOptions, setCountOptions] = useState([])
  
  // New machine form (like Comber - creates new machine)
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    make_name: 'LMW',
    prodn_mixing: '64COMBED GOLD',
    session_no: 1,
    cc_time: 0,
    sl_hank: 1.4,
    mc_effi: 92,
    tpi: 1.73,
    spindles: 140,
    speed: 1000
  })

  // Initialize local data
  useEffect(() => {
    // Sort by machine number
    const sortedData = [...machineSetupData].sort((a, b) => {
      const aNum = parseInt(a.machine?.machine_no || '0')
      const bNum = parseInt(b.machine?.machine_no || '0')
      return aNum - bNum
    })
    setLocalData(sortedData)
    setEditedRows({})
  }, [machineSetupData])

  // Load count options
  useEffect(() => {
    loadCountOptions()
  }, [])

  const loadCountOptions = async () => {
    try {
      const options = await getSimplexCountOptions()
      setCountOptions(options || [])
    } catch (error) {
      console.error('Error loading count options:', error)
    }
  }

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    setLocalData(prev => prev.map(row => {
      if (row.id !== rowId) return row
      return { ...row, [field]: value }
    }))
    setEditedRows(prev => ({ ...prev, [rowId]: true }))
  }

  // Toggle row selection (using setup row ID)
  const handleRowSelect = (rowId) => {
    setSelectedRows(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    )
  }

  // Select all rows
  const handleSelectAll = () => {
    if (selectedRows.length === localData.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(localData.map(row => row.id))
    }
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
      const rowsToSave = localData.filter(row => editedRows[row.id])
      
      for (const row of rowsToSave) {
        await updateSimplexMachineSetup(row.id, {
          prodn_mixing: row.prodn_mixing,
          session_no: parseInt(row.session_no) || 1,
          cc_time: parseFloat(row.cc_time) || 0,
          sl_hank: parseFloat(row.sl_hank) || 1.4,
          mc_effi: parseFloat(row.mc_effi) || 92,
          tpi: parseFloat(row.tpi) || 1.73,
          spindles: parseInt(row.spindles) || 140,
          shift_time: parseInt(row.shift_time) || 510
        })
      }

      toast.success(`${rowsToSave.length} row(s) saved successfully`)
      setEditedRows({})
      
      if (onDataRefresh) {
        await onDataRefresh()
      }
    } catch (error) {
      console.error('Error saving machine setup:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle count change
  const handleCountChange = async () => {
    if (selectedRows.length === 0) {
      toast.warning('Please select machines to change count')
      return
    }

    const countToSet = customCount || newCount
    if (!countToSet) {
      toast.warning('Please select or enter a count')
      return
    }

    setIsSaving(true)
    try {
      // Extract machine IDs from selected setup row IDs
      const machineIds = selectedRows.map(rowId => {
        const setup = localData.find(r => r.id === rowId)
        return setup?.machine?.id
      }).filter(Boolean)
      
      await bulkUpdateSimplexMachineCount(machineIds, countToSet)
      toast.success(`Count updated for ${selectedRows.length} machine(s)`)
      setShowCountChangeDialog(false)
      setNewCount('')
      setCustomCount('')
      setSelectedRows([])
      
      if (onDataRefresh) {
        await onDataRefresh()
      }
    } catch (error) {
      console.error('Error updating count:', error)
      toast.error('Failed to update count')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle add new machine (creates both machine and setup - like Comber)
  const handleAddMachine = async () => {
    if (!newMachine.machine_no) {
      toast.warning('Please enter machine number')
      return
    }

    setIsSaving(true)
    try {
      await addSimplexMachine({
        machine_no: newMachine.machine_no,
        make_name: newMachine.make_name,
        prodn_mixing: newMachine.prodn_mixing,
        session_no: newMachine.session_no,
        cc_time: newMachine.cc_time,
        sl_hank: newMachine.sl_hank,
        mc_effi: newMachine.mc_effi,
        tpi: newMachine.tpi,
        spindles: newMachine.spindles,
        speed: newMachine.speed
      })
      
      toast.success('New machine added successfully')
      setShowAddDialog(false)
      setNewMachine({
        machine_no: '',
        make_name: 'LMW',
        prodn_mixing: '64COMBED GOLD',
        session_no: 1,
        cc_time: 0,
        sl_hank: 1.4,
        mc_effi: 92,
        tpi: 1.73,
        spindles: 140,
        speed: 1000
      })
      
      if (onDataRefresh) {
        await onDataRefresh()
      }
    } catch (error) {
      console.error('Error adding machine:', error)
      const errorMsg = error?.message || error?.toString() || 'Failed to add machine'
      toast.error(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle remove selected machines (soft delete - deactivates machine)
  const handleRemoveMachines = async () => {
    if (selectedRows.length === 0) {
      toast.warning('Please select machines to remove')
      return
    }

    setIsSaving(true)
    try {
      for (const rowId of selectedRows) {
        const machineSetup = localData.find(s => s.id === rowId)
        if (machineSetup?.machine?.id) {
          await removeSimplexMachine(machineSetup.machine.id)
        }
      }
      
      toast.success(`${selectedRows.length} machine(s) removed successfully`)
      setShowRemoveDialog(false)
      setSelectedRows([])
      
      if (onDataRefresh) {
        await onDataRefresh()
      }
    } catch (error) {
      console.error('Error removing machines:', error)
      toast.error('Failed to remove machines')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Save Bar */}
      <div className="flex items-center justify-end gap-2">
        {Object.keys(editedRows).length > 0 && (
          <span className="text-yellow-600 font-medium text-sm mr-2">
            {Object.keys(editedRows).length} unsaved change(s)
          </span>
        )}
        <Button 
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

      {/* Machine Setup Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === localData.length && localData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-24">Make</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40">Count/Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">CC Time</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Sl.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">MC.Effi%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">TPI</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Spindles</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">ShiftTime</th>
              </tr>
            </thead>
            <tbody>
              {localData.map((row, index) => {
                const machine = row.machine || {}
                const isEdited = editedRows[row.id]
                const isSelected = selectedRows.includes(row.id)

                return (
                  <tr 
                    key={row.id}
                    className={`
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                      ${isEdited ? 'bg-yellow-50' : ''} 
                      ${isSelected ? 'bg-blue-100' : ''}
                      hover:bg-blue-50
                    `}
                  >
                    {/* Checkbox */}
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRowSelect(row.id)}
                        className="rounded border-gray-300"
                      />
                    </td>

                    {/* Machine No */}
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700">
                      {machine.machine_no || '-'}
                    </td>
                    
                    {/* Make */}
                    <td className="border border-gray-300 px-2 py-1">
                      {machine.make_name || '-'}
                    </td>
                    
                    {/* Count/Mixing */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="text"
                        value={row.prodn_mixing || ''}
                        onChange={(e) => handleInputChange(row.id, 'prodn_mixing', e.target.value)}
                        className="h-6 text-xs border-gray-300 w-36"
                      />
                    </td>
                    
                    {/* Session */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        value={row.session_no || ''}
                        onChange={(e) => handleInputChange(row.id, 'session_no', e.target.value)}
                        className="h-6 text-xs text-center border-gray-300 w-12"
                      />
                    </td>
                    
                    {/* CC Time */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={row.cc_time || ''}
                        onChange={(e) => handleInputChange(row.id, 'cc_time', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-14"
                      />
                    </td>
                    
                    {/* Sliver Hank */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={row.sl_hank || ''}
                        onChange={(e) => handleInputChange(row.id, 'sl_hank', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-16"
                      />
                    </td>
                    
                    {/* MC Efficiency */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        step="0.1"
                        value={row.mc_effi || ''}
                        onChange={(e) => handleInputChange(row.id, 'mc_effi', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-16"
                      />
                    </td>
                    
                    {/* TPI */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={row.tpi || ''}
                        onChange={(e) => handleInputChange(row.id, 'tpi', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-16"
                      />
                    </td>
                    
                    {/* Spindles */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        value={row.spindles || ''}
                        onChange={(e) => handleInputChange(row.id, 'spindles', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-16"
                      />
                    </td>
                    
                    {/* Speed (from machine master) */}
                    <td className="border border-gray-300 px-2 py-1 text-right text-gray-600">
                      {machine.speed || '-'}
                    </td>
                    
                    {/* Shift Time */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        value={row.shift_time || ''}
                        onChange={(e) => handleInputChange(row.id, 'shift_time', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-16"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
        <strong>Simplex Machine Setup Parameters:</strong>
        <br />
        • <strong>Sl.Hank:</strong> Sliver Hank (default 1.4 for Simplex)
        <br />
        • <strong>TPI:</strong> Twist Per Inch (affects production calculation)
        <br />
        • <strong>Spindles:</strong> Total spindles per machine (for Active Spindles calculation)
        <br />
        • <strong>MC.Effi%:</strong> Machine Efficiency (default 92%)
        <br />
        • <strong>Speed:</strong> Machine speed from master (read-only here)
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button 
          variant="outline"
          onClick={() => setShowCountChangeDialog(true)}
          disabled={selectedRows.length === 0}
        >
          <Edit className="h-4 w-4 mr-1" />
          Count change {selectedRows.length > 0 && `(${selectedRows.length})`}
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
          Remove machine {selectedRows.length > 0 && `(${selectedRows.length})`}
        </Button>
      </div>

      {/* Count Change Dialog */}
      <Dialog open={showCountChangeDialog} onOpenChange={setShowCountChangeDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Count/Mixing</DialogTitle>
            <DialogDescription>
              Update count/mixing for {selectedRows.length} selected machine(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="existing-count">Select Existing Count</Label>
              <Select
                value={newCount}
                onValueChange={(val) => {
                  setNewCount(val)
                  setCustomCount('')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose from existing counts" />
                </SelectTrigger>
                <SelectContent>
                  {countOptions.map((count) => (
                    <SelectItem key={count} value={count}>
                      {count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-center text-gray-500 text-sm">- OR -</div>
            
            <div>
              <Label htmlFor="custom-count">Enter Custom Count</Label>
              <Input
                id="custom-count"
                type="text"
                value={customCount}
                onChange={(e) => {
                  setCustomCount(e.target.value)
                  setNewCount('')
                }}
                placeholder="e.g., 80CARDED or 50COMBED"
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCountChangeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCountChange}
              disabled={isSaving || (!newCount && !customCount)}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Machine Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>
              Create a new simplex machine and add it to the setup
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="add-machine-no">Machine No *</Label>
                <Input
                  id="add-machine-no"
                  type="text"
                  value={newMachine.machine_no}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, machine_no: e.target.value }))}
                  placeholder="e.g., 11"
                />
              </div>
              <div>
                <Label htmlFor="add-make">Make</Label>
                <Input
                  id="add-make"
                  type="text"
                  value={newMachine.make_name}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, make_name: e.target.value }))}
                  placeholder="e.g., LMW"
                />
              </div>
              <div>
                <Label htmlFor="add-mixing">Prodn Mixing</Label>
                <Input
                  id="add-mixing"
                  type="text"
                  value={newMachine.prodn_mixing}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, prodn_mixing: e.target.value }))}
                  placeholder="e.g., 64COMBED GOLD"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="add-session">Session No</Label>
                <Input
                  id="add-session"
                  type="number"
                  value={newMachine.session_no}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, session_no: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label htmlFor="add-speed">Speed</Label>
                <Input
                  id="add-speed"
                  type="number"
                  value={newMachine.speed}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, speed: parseInt(e.target.value) || 1000 }))}
                />
              </div>
              <div>
                <Label htmlFor="add-cctime">CC Time</Label>
                <Input
                  id="add-cctime"
                  type="number"
                  value={newMachine.cc_time}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, cc_time: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="add-hank">Sl.Hank</Label>
                <Input
                  id="add-hank"
                  type="number"
                  step="0.01"
                  value={newMachine.sl_hank}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, sl_hank: parseFloat(e.target.value) || 1.4 }))}
                />
              </div>
              <div>
                <Label htmlFor="add-tpi">TPI</Label>
                <Input
                  id="add-tpi"
                  type="number"
                  step="0.01"
                  value={newMachine.tpi}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, tpi: parseFloat(e.target.value) || 1.73 }))}
                />
              </div>
              <div>
                <Label htmlFor="add-effi">MC.Effi%</Label>
                <Input
                  id="add-effi"
                  type="number"
                  value={newMachine.mc_effi}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, mc_effi: parseFloat(e.target.value) || 92 }))}
                />
              </div>
              <div>
                <Label htmlFor="add-spindles">Spindles</Label>
                <Input
                  id="add-spindles"
                  type="number"
                  value={newMachine.spindles}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, spindles: parseInt(e.target.value) || 140 }))}
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
              disabled={isSaving || !newMachine.machine_no}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Remove Machines</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedRows.length} selected machine(s) from setup?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="text-sm text-gray-600">
              Selected machines to remove:
              <ul className="list-disc pl-5 mt-2">
                {selectedRows.map(rowId => {
                  const machine = localData.find(r => r.id === rowId)?.machine
                  return (
                    <li key={rowId}>
                      {machine?.machine_no || 'Unknown'} - {machine?.machine_name || 'N/A'}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRemoveMachines}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
