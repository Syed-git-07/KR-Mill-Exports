'use client'

import { useState, useEffect } from 'react'
import { getSpinningCountsAction, createSpinningCountAction, updateSpinningCountAction, deleteSpinningCountAction, searchSpinningCountsAction } from '@/app/actions/spinning-count'
import SearchFilter from '@/components/common/SearchFilter'
import DataGrid from '@/components/common/DataGrid'
import FormModal from '@/components/common/FormModal'
import SpinningCountForm from '@/components/modules/masters/SpinningCountForm'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { assertAllActionsSucceeded } from '@/lib/actionResult'
import { useLatestRows } from '@/hooks/useLatestRows'

export default function SpinningCountPage() {
  const [spinningCounts, setSpinningCounts] = useState([])
  const [selectedSpinningCount, setSelectedSpinningCount] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const { getCurrentRow, getCurrentRows, openRowEditor, resetInteractionState, runLatestRowsRequest } = useLatestRows({
    rows: spinningCounts, setRows: setSpinningCounts,
    selectedItem: selectedSpinningCount, setSelectedItem: setSelectedSpinningCount,
    selectedRows, setSelectedRows,
    setIsSelectMode,
    setIsEditing,
    setIsModalOpen,
    closeModalWhenSelectedItemStale: isEditing
  })

  useEffect(() => {
    loadSpinningCounts()
  }, [])

  const loadSpinningCounts = async () => {
    await runLatestRowsRequest(
      () => getSpinningCountsAction(),
      {
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error)
          replaceRows(result.data || [])
          if (!result.data?.length) toast.error('No spinning count records found. Please check database.')
        },
        onError: error => {
          console.error('Failed to load spinning counts:', error)
          toast.error('Failed to load spinning counts: ' + error.message)
        }
      }
    )
  }

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadSpinningCounts()
      return
    }
    
    await runLatestRowsRequest(
      () => searchSpinningCountsAction(field, condition, value),
      {
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error)
          replaceRows(result.data || [])
          toast.success(`Found ${(result.data || []).length} result(s)`)
        },
        onError: error => toast.error('Search failed: ' + error.message)
      }
    )
  }

  const handleShowAll = () => {
    loadSpinningCounts()
  }

  const handleRowClick = (count) => {
    if (isSelectMode) return
    setSelectedSpinningCount(count)
  }

  const handleAdd = () => {
    resetInteractionState()
    setSelectedSpinningCount(null)
    setSelectedRows([])
    setIsSelectMode(false)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      const currentSelectedRows = getCurrentRows(selectedRows)
      if (!currentSelectedRows.length) return toast.warning('The selected spinning counts are no longer in the current list')
      if (!confirm(`Are you sure you want to delete ${currentSelectedRows.length} spinning count(s)?`)) {
        return
      }

      try {
        const results = await Promise.all(currentSelectedRows.map(row => deleteSpinningCountAction(row.id)))
        assertAllActionsSucceeded(results, 'Failed to delete one or more spinning counts')
        toast.success(`${currentSelectedRows.length} spinning count(s) deleted successfully`)
        resetInteractionState({ closeModal: true })
        setSelectedRows([])
        setIsSelectMode(false)
      } catch (error) {
        toast.error('Failed to delete spinning counts: ' + error.message)
      } finally {
        loadSpinningCounts()
      }
    } else if (!isSelectMode && selectedSpinningCount) {
      // Single delete from modal
      const currentCount = getCurrentRow(selectedSpinningCount)
      if (!currentCount) return toast.warning('The selected spinning count is no longer in the current list')
      if (!confirm(`Are you sure you want to delete "${currentCount.count_name}"?`)) {
        return
      }

      try {
        const result = await deleteSpinningCountAction(currentCount.id)
        if (result.success) {
          toast.success('Spinning count deleted successfully')
          resetInteractionState({ closeModal: true })
          setSelectedSpinningCount(null)
          setIsModalOpen(false)
          loadSpinningCounts()
        } else {
          toast.error('Failed to delete spinning count: ' + result.error)
        }
      } catch (error) {
        toast.error('Failed to delete spinning count: ' + error.message)
      }
    } else {
      toast.error('Please select spinning count(s) to delete')
    }
  }

  const handleDeactivate = async () => {
    const currentTargets = isSelectMode ? getCurrentRows(selectedRows) : getCurrentRows(selectedSpinningCount)
    const targets = currentTargets.filter(row => row.is_active)
    if (!targets.length) return toast.info('Select at least one active spinning count')
    if (!confirm(`Deactivate ${targets.length} spinning count(s)?`)) return
    try {
      const results = await Promise.all(targets.map(row => updateSpinningCountAction(row.id, { is_active: false })))
      assertAllActionsSucceeded(results, 'Failed to deactivate one or more spinning counts')
      toast.success(`${targets.length} spinning count(s) deactivated`)
      resetInteractionState({ closeModal: true })
      setSelectedRows([])
      setSelectedSpinningCount(null)
    } catch (error) {
      toast.error('Failed to deactivate spinning counts: ' + error.message)
    } finally {
      loadSpinningCounts()
    }
  }

  const handleSelectRow = (row) => {
    setSelectedRows(prev => {
      const exists = prev.some(r => r.id === row.id)
      if (exists) {
        return prev.filter(r => r.id !== row.id)
      } else {
        return [...prev, row]
      }
    })
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows([...spinningCounts])
    } else {
      setSelectedRows([])
    }
  }

  const toggleSelectMode = () => {
    const nextSelectMode = !isSelectMode
    resetInteractionState({ closeModal: true })
    setIsSelectMode(nextSelectMode)
  }

  const handleSave = async (formData) => {
    setIsLoading(true)
    try {
      if (isEditing && selectedSpinningCount) {
        const currentCount = getCurrentRow(selectedSpinningCount)
        if (!currentCount) throw new Error('This spinning count is no longer in the current list')
        const result = await updateSpinningCountAction(currentCount.id, formData)
        if (result.success) {
          toast.success('Spinning count updated successfully')
        } else {
          toast.error('Failed to update spinning count: ' + result.error)
          return
        }
      } else {
        const result = await createSpinningCountAction(formData)
        if (result.success) {
          toast.success('Spinning count created successfully')
        } else {
          toast.error('Failed to create spinning count: ' + result.error)
          return
        }
      }
      resetInteractionState({ closeModal: true })
      setIsModalOpen(false)
      setSelectedSpinningCount(null)
      loadSpinningCounts()
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} spinning count: ` + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const columns = [
    { key: 'count_name', label: 'Count Name', width: '300px' },
    { key: 'act_count', label: 'Act Count', width: '150px' },
  ]

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Spinning Count Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage spinning count specifications</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Add New</span>
          </Button>
          <Button 
            onClick={toggleSelectMode} 
            variant={isSelectMode ? "default" : "outline"}
            className={`flex-1 sm:flex-none ${isSelectMode ? "bg-blue-600 text-white hover:bg-blue-700" : "border-blue-600 text-blue-600 hover:bg-blue-50"}`}
          >
            <span className="text-xs sm:text-sm">{isSelectMode ? 'Cancel' : 'Select'}</span>
          </Button>
          <Button
            onClick={handleDeactivate}
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? !selectedRows.some(row => row.is_active) : !selectedSpinningCount?.is_active}
          >
            <Ban className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Deactivate</span>
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedSpinningCount}
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Remove Permanently</span>
            <span className="text-xs sm:text-sm">{isSelectMode && selectedRows.length > 0 && ` (${selectedRows.length})`}</span>
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      <SearchFilter 
        fields={[
          { label: 'Count Name', value: 'count_name' }
        ]}
        onSearch={handleSearch}
        onShowAll={handleShowAll}
      />

      {/* Data Grid */}
        <DataGrid 
          columns={columns}
          data={spinningCounts}
          onRowClick={handleRowClick}
          selectedRow={selectedSpinningCount}
          showCheckbox={isSelectMode}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          getRowClassName={(row) => !row.is_active ? '!bg-red-100 hover:!bg-red-200 text-red-700' : '!bg-white hover:!bg-yellow-100'}
          onRowDoubleClick={(row) => {
            if (isSelectMode) return
            openRowEditor(row)
          }}
          onContextMenu={(row, e) => {
            e.preventDefault();
            if (isSelectMode) return;
            openRowEditor(row);
          }}
        />
      
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total Records: {spinningCounts.length}</span>
        {selectedSpinningCount && (
          <span>Selected: {selectedSpinningCount.count_name}</span>
        )}
      </div>

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) setIsEditing(false)
        }}
        title="Spinning Count Master"
        description={isEditing ? "To Modify the Spinning Count Details" : "Add new spinning count"}
        onCancel={() => {
          setIsModalOpen(false)
          setIsEditing(false)
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        isLoading={isLoading}
        saveLabel={isEditing ? "Update" : "Save"}
      >
        <SpinningCountForm
          initialData={isEditing ? selectedSpinningCount : null}
          onSubmit={handleSave}
          isLoading={isLoading}
        />
      </FormModal>
    </div>
  )
}
