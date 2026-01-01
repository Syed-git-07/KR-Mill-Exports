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
  getComberMachineSetups,
  updateComberMachineSetup,
  addComberMachine,
  removeComberMachine,
  getComberMachines,
  getComberCountOptions,
  bulkUpdateComberMachineCount
} from '@/lib/supabase/comberEntryQueries'

export default function ComberMachineSetupTab({ onRefresh }) {
  const [setupData, setSetupData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedRows, setEditedRows] = useState({})
  const [selectedRows, setSelectedRows] = useState([])
  const [countOptions, setCountOptions] = useState([])

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCountChangeDialog, setShowCountChangeDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // New machine form
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    prodn_count: '64COMBED GOLD',
    session: 1,
    cc_time: 0,
    sl_hank: 0.14,
    mc_effi: 93
  })

  // Count change form
  const [newCount, setNewCount] = useState('')
  const [customCount, setCustomCount] = useState('')

  // Load machine setups
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [setups, counts] = await Promise.all([
        getComberMachineSetups(),
        getComberCountOptions()
      ])
      // Sort by natural machine number order (CO1, CO2, ... CO10, CO11)
      const sortedSetups = setups?.sort((a, b) => {
        const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      setSetupData(sortedSetups)
      setCountOptions(counts || [])
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

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    let processedValue = value
    
    // Handle numeric fields
    if (['session_no', 'cc_time', 'mc_effi'].includes(field)) {
      processedValue = parseInt(value) || 0
    } else if (['sl_hank'].includes(field)) {
      processedValue = parseFloat(value) || 0
    }
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: processedValue
      }
    }))

    // Update display data
    setSetupData(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, [field]: processedValue }
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
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => 
        updateComberMachineSetup(rowId, changes)
      )

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
      await addComberMachine({
        machine_no: newMachine.machine_no,
        prodn_mixing: newMachine.prodn_count,
        session_no: newMachine.session,
        cc_time: newMachine.cc_time,
        sl_hank: newMachine.sl_hank,
        mc_effi: newMachine.mc_effi
      })
      toast.success('New machine added successfully')
      setShowAddDialog(false)
      setNewMachine({
        machine_no: '',
        prodn_count: '64COMBED GOLD',
        session: 1,
        cc_time: 0,
        sl_hank: 0.14,
        mc_effi: 93
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

  // Remove selected machines
  const handleRemoveMachines = async () => {
    if (selectedRows.length === 0) {
      toast.warning('Please select machines to remove')
      return
    }

    setIsSaving(true)
    try {
      const promises = selectedRows.map(id => removeComberMachine(id))
      await Promise.all(promises)
      toast.success(`${selectedRows.length} machine(s) removed successfully`)
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

  // Change count for selected machines
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
      await bulkUpdateComberMachineCount(selectedRows, countToSet)
      toast.success(`Count updated for ${selectedRows.length} machine(s)`)
      setShowCountChangeDialog(false)
      setNewCount('')
      setCustomCount('')
      setSelectedRows([])
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error changing count:', error)
      toast.error('Failed to change count')
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
        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-10">
                  <Checkbox
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="border-white"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20">Mc. No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-44">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24">C.C. Time</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24">Sl.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24">MCEffi</th>
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
                    {row.machine?.machine_no || row.machine_id}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Select
                      value={row.prodn_mixing || '64COMBED GOLD'}
                      onValueChange={(value) => handleInputChange(row.id, 'prodn_mixing', value)}
                    >
                      <SelectTrigger className="h-7 text-xs w-40 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {countOptions.length > 0 ? (
                          countOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="64COMBED GOLD">64COMBED GOLD</SelectItem>
                            <SelectItem value="40COMBED GOLD">40COMBED GOLD</SelectItem>
                            <SelectItem value="80COMBED">80COMBED</SelectItem>
                            <SelectItem value="60COMBED">60COMBED</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.session_no || 1}
                      onChange={(e) => handleInputChange(row.id, 'session_no', e.target.value)}
                      className="h-7 text-xs text-center w-16 border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.cc_time || 0}
                      onChange={(e) => handleInputChange(row.id, 'cc_time', e.target.value)}
                      className="h-7 text-xs text-right w-20 border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.sl_hank || 0.14}
                      onChange={(e) => handleInputChange(row.id, 'sl_hank', e.target.value)}
                      className="h-7 text-xs text-right w-20 border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.mc_effi || 93}
                      onChange={(e) => handleInputChange(row.id, 'mc_effi', e.target.value)}
                      className="h-7 text-xs text-right w-20 border-gray-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button 
          variant="outline"
          onClick={() => setShowCountChangeDialog(true)}
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

      {/* Add Machine Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>Add a new comber machine configuration</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Machine No.</Label>
              <Input
                className="col-span-3"
                placeholder="e.g., CO14"
                value={newMachine.machine_no}
                onChange={(e) => setNewMachine(prev => ({ ...prev, machine_no: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Count</Label>
              <Select
                value={newMachine.prodn_count}
                onValueChange={(value) => setNewMachine(prev => ({ ...prev, prodn_count: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="64COMBED GOLD">64COMBED GOLD</SelectItem>
                  <SelectItem value="40COMBED GOLD">40COMBED GOLD</SelectItem>
                  <SelectItem value="80COMBED">80COMBED</SelectItem>
                  <SelectItem value="60COMBED">60COMBED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Session</Label>
              <Input
                className="col-span-3"
                type="number"
                value={newMachine.session}
                onChange={(e) => setNewMachine(prev => ({ ...prev, session: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">C.C. Time</Label>
              <Input
                className="col-span-3"
                type="number"
                value={newMachine.cc_time}
                onChange={(e) => setNewMachine(prev => ({ ...prev, cc_time: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Sl.Hank</Label>
              <Input
                className="col-span-3"
                type="number"
                step="0.01"
                value={newMachine.sl_hank}
                onChange={(e) => setNewMachine(prev => ({ ...prev, sl_hank: parseFloat(e.target.value) || 0.14 }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">MCEffi</Label>
              <Input
                className="col-span-3"
                type="number"
                value={newMachine.mc_effi}
                onChange={(e) => setNewMachine(prev => ({ ...prev, mc_effi: parseInt(e.target.value) || 93 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddMachine} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Count Change Dialog */}
      <Dialog open={showCountChangeDialog} onOpenChange={setShowCountChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Count</DialogTitle>
            <DialogDescription>
              Change count for {selectedRows.length} selected machine(s)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Select Count</Label>
              <Select
                value={newCount}
                onValueChange={(value) => {
                  setNewCount(value)
                  setCustomCount('')
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  {countOptions.length > 0 ? (
                    countOptions.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="64COMBED GOLD">64COMBED GOLD</SelectItem>
                      <SelectItem value="40COMBED GOLD">40COMBED GOLD</SelectItem>
                      <SelectItem value="80COMBED">80COMBED</SelectItem>
                      <SelectItem value="60COMBED">60COMBED</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Or Custom</Label>
              <Input
                className="col-span-3"
                placeholder="Enter custom count"
                value={customCount}
                onChange={(e) => {
                  setCustomCount(e.target.value)
                  setNewCount('')
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCountChangeDialog(false)}>Cancel</Button>
            <Button onClick={handleCountChange} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Edit className="h-4 w-4 mr-1" />}
              Apply Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Remove Machine(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedRows.length} machine(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveMachines} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
