'use client'

import { useState, useEffect } from 'react'
import { getStoppageDetailsAction, createStoppageDetailAction, updateStoppageDetailAction, deleteStoppageDetailAction, searchStoppageDetailsAction } from '@/app/actions/stoppage-detail'
import SearchFilter from '@/components/common/SearchFilter'
import DataGrid from '@/components/common/DataGrid'
import FormModal from '@/components/common/FormModal'
import StoppageDetailForm from '@/components/modules/masters/StoppageDetailForm'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { assertAllActionsSucceeded } from '@/lib/actionResult'
import { useLatestRows } from '@/hooks/useLatestRows'

export default function StoppageDetailPage() {
  const [stoppageDetails, setStoppageDetails] = useState([])
  const [selectedStoppageDetail, setSelectedStoppageDetail] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const { getCurrentRow, getCurrentRows, openRowEditor, resetInteractionState, runLatestRowsRequest } = useLatestRows({
    rows: stoppageDetails, setRows: setStoppageDetails,
    selectedItem: selectedStoppageDetail, setSelectedItem: setSelectedStoppageDetail,
    selectedRows, setSelectedRows,
    setIsSelectMode,
    setIsEditing,
    setIsModalOpen,
    closeModalWhenSelectedItemStale: isEditing
  })

  // Suppress hydration warnings caused by browser extensions (e.g., fdprocessedid)
  useEffect(() => {
    const handleError = (e) => {
      if (e.message.includes('Hydration') || e.message.includes('hydration')) {
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  useEffect(() => {
    loadStoppageDetails()
  }, [])

  const loadStoppageDetails = async () => {
    await runLatestRowsRequest(
      () => getStoppageDetailsAction(),
      {
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error)
          replaceRows(result.data || [])
        },
        onError: error => toast.error('Failed to load stoppage details: ' + error.message)
      }
    )
  }

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadStoppageDetails()
      return
    }
    
    await runLatestRowsRequest(
      () => searchStoppageDetailsAction(field, condition, value),
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
    loadStoppageDetails()
  }

  const handleRowClick = (detail) => {
    if (isSelectMode) return
    setSelectedStoppageDetail(detail)
  }

  const handleAdd = () => {
    resetInteractionState()
    setSelectedStoppageDetail(null)
    setSelectedRows([])
    setIsSelectMode(false)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      const currentSelectedRows = getCurrentRows(selectedRows)
      if (!currentSelectedRows.length) return toast.warning('The selected stoppage details are no longer in the current list')
      if (!confirm(`Are you sure you want to delete ${currentSelectedRows.length} stoppage detail(s)?`)) {
        return
      }

      try {
        const results = await Promise.all(currentSelectedRows.map(row => deleteStoppageDetailAction(row.id)))
        assertAllActionsSucceeded(results, 'Failed to delete one or more stoppage details')
        toast.success(`${currentSelectedRows.length} stoppage detail(s) deleted successfully`)
        resetInteractionState({ closeModal: true })
        setSelectedRows([])
        setIsSelectMode(false)
      } catch (error) {
        toast.error('Failed to delete stoppage details: ' + error.message)
      } finally {
        loadStoppageDetails()
      }
    } else if (!isSelectMode && selectedStoppageDetail) {
      // Single delete from modal
      const currentDetail = getCurrentRow(selectedStoppageDetail)
      if (!currentDetail) return toast.warning('The selected stoppage detail is no longer in the current list')
      if (!confirm(`Are you sure you want to delete "${currentDetail.stoppage_name}"?`)) {
        return
      }

      try {
        const result = await deleteStoppageDetailAction(currentDetail.id)
        if (result.success) {
          toast.success('Stoppage detail deleted successfully')
          resetInteractionState({ closeModal: true })
          setSelectedStoppageDetail(null)
          setIsModalOpen(false)
          loadStoppageDetails()
        } else {
          toast.error('Failed to delete stoppage detail: ' + result.error)
        }
      } catch (error) {
        toast.error('Failed to delete stoppage detail: ' + error.message)
      }
    } else {
      toast.error('Please select stoppage detail(s) to delete')
    }
  }

  const handleDeactivate = async () => {
    const currentTargets = isSelectMode ? getCurrentRows(selectedRows) : getCurrentRows(selectedStoppageDetail)
    const targets = currentTargets.filter(row => row.is_active)
    if (!targets.length) return toast.info('Select at least one active stoppage detail')
    if (!confirm(`Deactivate ${targets.length} stoppage detail(s)?`)) return
    try {
      const results = await Promise.all(targets.map(row => updateStoppageDetailAction(row.id, { is_active: false })))
      assertAllActionsSucceeded(results, 'Failed to deactivate one or more stoppage details')
      toast.success(`${targets.length} stoppage detail(s) deactivated`)
      resetInteractionState({ closeModal: true })
      setSelectedRows([])
      setSelectedStoppageDetail(null)
    } catch (error) {
      toast.error('Failed to deactivate stoppage details: ' + error.message)
    } finally {
      loadStoppageDetails()
    }
  }

  const handleSave = async (formData) => {
    try {
      setIsLoading(true)
      if (isEditing && selectedStoppageDetail) {
        const currentDetail = getCurrentRow(selectedStoppageDetail)
        if (!currentDetail) throw new Error('This stoppage detail is no longer in the current list')
        const result = await updateStoppageDetailAction(currentDetail.id, formData)
        if (result.success) {
          toast.success('Stoppage detail updated successfully')
        } else {
          toast.error('Failed to update stoppage detail: ' + result.error)
          return
        }
      } else {
        const result = await createStoppageDetailAction(formData)
        if (result.success) {
          toast.success('Stoppage detail created successfully')
        } else {
          toast.error('Failed to create stoppage detail: ' + result.error)
          return
        }
      }
      resetInteractionState({ closeModal: true })
      setIsModalOpen(false)
      setSelectedStoppageDetail(null)
      loadStoppageDetails()
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} stoppage detail: ` + error.message)
    } finally {
      setIsLoading(false)
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
      setSelectedRows([...stoppageDetails])
    } else {
      setSelectedRows([])
    }
  }

  const toggleSelectMode = () => {
    const nextSelectMode = !isSelectMode
    resetInteractionState({ closeModal: true })
    setIsSelectMode(nextSelectMode)
  }

  const columns = [
    { key: 'code', label: 'Code', width: '100px' },
    { key: 'stoppage_name', label: 'Stoppage Name', width: '200px' },
    { key: 'stoppage_head_name', label: 'Stoppage Head Name', width: '200px' },
    { key: 'dept_name', label: 'Department', width: 'auto' },
  ]

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Stoppage Detail Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage detailed stoppage reasons</p>
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
            disabled={isSelectMode ? !selectedRows.some(row => row.is_active) : !selectedStoppageDetail?.is_active}
          >
            <Ban className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Deactivate</span>
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedStoppageDetail}
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
          { label: 'Code', value: 'code' },
          { label: 'Stoppage Name', value: 'stoppage_name' },
          { label: 'Stoppage Head Name', value: 'stoppage_head_name' },
          { label: 'Department', value: 'dept_name' }
        ]}
        onSearch={handleSearch}
        onShowAll={handleShowAll}
      />

      {/* Data Grid */}
      <DataGrid 
        columns={columns}
        data={stoppageDetails}
        onRowClick={handleRowClick}
        selectedRow={selectedStoppageDetail}
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
          e.preventDefault()
          if (isSelectMode) return
          openRowEditor(row)
        }}
      />

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) setIsEditing(false)
        }}
        title="Stoppage Detail Master"
        description={isEditing ? "Modify stoppage detail information" : "Add new stoppage detail"}
        onCancel={() => {
          setIsModalOpen(false)
          setIsEditing(false)
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        isLoading={isLoading}
        saveLabel={isEditing ? "Update" : "Create"}
      >
        <StoppageDetailForm
          initialData={selectedStoppageDetail}
          onSubmit={handleSave}
        />
      </FormModal>
    </div>
  )
}
