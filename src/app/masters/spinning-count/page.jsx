'use client'

import { confirmAction } from '@/lib/confirmation'

import { useState, useEffect } from 'react'
import { getSpinningCountsAction, createSpinningCountAction, updateSpinningCountAction, deleteSpinningCountAction, searchSpinningCountsAction } from '@/app/actions/spinning-count'
import SearchFilter from '@/components/common/SearchFilter'
import DataGrid from '@/components/common/DataGrid'
import FormModal from '@/components/common/FormModal'
import SpinningCountForm from '@/components/modules/masters/SpinningCountForm'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { runBulkActions } from '@/lib/actionResults'
import { useAuthUser } from '@/components/auth/AuthUserContext'
import { getActiveMasterRecordCount, getMasterRecordRowClassName, orderMasterRecords } from '@/lib/masterRecordDisplay'

export default function SpinningCountPage() {
  const { canManageMasters } = useAuthUser()
  const [spinningCounts, setSpinningCounts] = useState([])
  const [selectedSpinningCount, setSelectedSpinningCount] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadSpinningCounts()
  }, [])

  const loadSpinningCounts = async () => {
    try {
      const result = await getSpinningCountsAction()
      if (result.success) {
        setSpinningCounts(orderMasterRecords(result.data))
        if (!result.data || result.data.length === 0) {
          console.warn('No data returned from database')
          toast.error('No spinning count records found. Please check database.')
        }
      } else {
        toast.error('Failed to load spinning counts: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to load spinning counts:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error('Failed to load spinning counts: ' + error.message)
    }
  }

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadSpinningCounts()
      return
    }
    
    try {
      const result = await searchSpinningCountsAction(field, condition, value)
      if (result.success) {
        setSpinningCounts(orderMasterRecords(result.data))
        toast.success(`Found ${result.data.length} result(s)`)
      } else {
        toast.error('Search failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Search failed: ' + error.message)
    }
  }

  const handleShowAll = () => {
    loadSpinningCounts()
  }

  const handleRowClick = (count) => {
    setSelectedSpinningCount(count)
  }

  const handleAdd = () => {
    setSelectedSpinningCount(null)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      const activeRows = selectedRows.filter(row => row.is_active !== false)
      if (activeRows.length === 0) return toast.info('All selected counts are already deleted')
      if (!(await confirmAction('delete'))) return
      const { succeeded, failed } = await runBulkActions(activeRows, row => deleteSpinningCountAction(row.id))
      if (succeeded.length) toast.success(`${succeeded.length} spinning count(s) deleted`)
      if (failed.length) toast.error(`${failed.length} spinning count(s) failed: ${failed[0].error}`)
      setSelectedRows(failed.map(outcome => outcome.item))
      setIsSelectMode(failed.length > 0)
      if (succeeded.length) loadSpinningCounts()
    } else if (!isSelectMode && selectedSpinningCount) {
      if (selectedSpinningCount.is_active === false) return toast.info('Spinning count is already deleted')
      if (!(await confirmAction('delete'))) return

      try {
        const result = await deleteSpinningCountAction(selectedSpinningCount.id)
        if (result.success) {
          toast.success('Spinning count deleted successfully')
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
    setIsSelectMode(!isSelectMode)
    setSelectedRows([])
  }

  const handleSave = async (formData) => {
    if (!(await confirmAction('update'))) return
    setIsLoading(true)
    try {
      if (isEditing && selectedSpinningCount) {
        const result = await updateSpinningCountAction(selectedSpinningCount.id, formData)
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
        <div className={canManageMasters ? "flex flex-wrap gap-2" : "hidden"}>
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
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode
              ? selectedRows.filter(row => row.is_active !== false).length === 0
              : !selectedSpinningCount || selectedSpinningCount.is_active === false
            }
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="text-xs sm:text-sm">Delete</span>
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
          getRowClassName={getMasterRecordRowClassName}
          onRowClick={handleRowClick}
          selectedRow={selectedSpinningCount}
          showCheckbox={isSelectMode}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          onContextMenu={(row, e) => {
            if (!canManageMasters) return
            e.preventDefault();
            setSelectedSpinningCount(row);
            setIsEditing(true);
            setIsModalOpen(true);
          }}
        />
      
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Active Counts: {getActiveMasterRecordCount(spinningCounts)}</span>
        {selectedSpinningCount && (
          <span>Selected: {selectedSpinningCount.count_name}</span>
        )}
      </div>

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Spinning Count Master"
        description={isEditing ? "To Modify the Spinning Count Details" : "Add new spinning count"}
        onCancel={() => setIsModalOpen(false)}
        onDelete={null}
        showDelete={false}
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
