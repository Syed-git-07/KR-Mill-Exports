'use client'

import { useState, useEffect } from 'react'
import { getDepartmentsAction, createDepartmentAction, updateDepartmentAction, deleteDepartmentAction, searchDepartmentsAction } from '@/app/actions/department'
import SearchFilter from '@/components/common/SearchFilter'
import DataGrid from '@/components/common/DataGrid'
import FormModal from '@/components/common/FormModal'
import DepartmentForm from '@/components/modules/masters/DepartmentForm'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { assertAllActionsSucceeded } from '@/lib/actionResult'
import { useLatestRows } from '@/hooks/useLatestRows'

export default function DepartmentPage() {
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const { getCurrentRow, getCurrentRows, openRowEditor, resetInteractionState, runLatestRowsRequest } = useLatestRows({
    rows: departments, setRows: setDepartments,
    selectedItem: selectedDepartment, setSelectedItem: setSelectedDepartment,
    selectedRows, setSelectedRows,
    setIsSelectMode,
    setIsEditing,
    setIsModalOpen,
    closeModalWhenSelectedItemStale: isEditing
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    await runLatestRowsRequest(
      () => getDepartmentsAction(),
      {
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error)
          replaceRows(result.data || [])
        },
        onError: error => toast.error('Failed to load departments: ' + error.message)
      }
    )
  }

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadDepartments()
      return
    }
    
    await runLatestRowsRequest(
      () => searchDepartmentsAction(field, condition, value),
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
    loadDepartments()
  }

  const handleRowClick = (dept) => {
    if (isSelectMode) return
    setSelectedDepartment(dept)
  }

  const handleAdd = () => {
    resetInteractionState()
    setSelectedDepartment(null)
    setSelectedRows([])
    setIsSelectMode(false)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      const currentSelectedRows = getCurrentRows(selectedRows)
      if (!currentSelectedRows.length) return toast.warning('The selected departments are no longer in the current list')
      if (!confirm(`Are you sure you want to delete ${currentSelectedRows.length} department(s)?`)) {
        return
      }

      try {
        const results = await Promise.all(currentSelectedRows.map(row => deleteDepartmentAction(row.id)))
        assertAllActionsSucceeded(results, 'Failed to delete one or more departments')
        toast.success(`${currentSelectedRows.length} department(s) deleted successfully`)
        resetInteractionState({ closeModal: true })
        setSelectedRows([])
        setIsSelectMode(false)
      } catch (error) {
        toast.error('Failed to delete departments: ' + error.message)
      } finally {
        loadDepartments()
      }
    } else if (!isSelectMode && selectedDepartment) {
      // Single delete from modal
      const currentDepartment = getCurrentRow(selectedDepartment)
      if (!currentDepartment) return toast.warning('The selected department is no longer in the current list')
      if (!confirm(`Are you sure you want to delete "${currentDepartment.dept_name}"?`)) {
        return
      }

      try {
        const result = await deleteDepartmentAction(currentDepartment.id)
        if (result.success) {
          toast.success('Department deleted successfully')
          resetInteractionState({ closeModal: true })
          setSelectedDepartment(null)
          setIsModalOpen(false)
          loadDepartments()
        } else {
          toast.error('Failed to delete department: ' + result.error)
        }
      } catch (error) {
        toast.error('Failed to delete department: ' + error.message)
      }
    } else {
      toast.error('Please select department(s) to delete')
    }
  }

  const handleDeactivate = async () => {
    const currentTargets = isSelectMode ? getCurrentRows(selectedRows) : getCurrentRows(selectedDepartment)
    const targets = currentTargets.filter(row => row.is_active)
    if (!targets.length) return toast.info('Select at least one active department')
    if (!confirm(`Deactivate ${targets.length} department(s)?`)) return
    try {
      const results = await Promise.all(targets.map(row => updateDepartmentAction(row.id, { is_active: false })))
      assertAllActionsSucceeded(results, 'Failed to deactivate one or more departments')
      toast.success(`${targets.length} department(s) deactivated`)
      resetInteractionState({ closeModal: true })
      setSelectedRows([])
      setSelectedDepartment(null)
    } catch (error) {
      toast.error('Failed to deactivate departments: ' + error.message)
    } finally {
      loadDepartments()
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
      setSelectedRows([...departments])
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
      if (isEditing && selectedDepartment) {
        const currentDepartment = getCurrentRow(selectedDepartment)
        if (!currentDepartment) throw new Error('This department is no longer in the current list')
        const result = await updateDepartmentAction(currentDepartment.id, formData)
        if (result.success) {
          toast.success('Department updated successfully')
          resetInteractionState({ closeModal: true })
          setIsModalOpen(false)
          setSelectedDepartment(null)
          loadDepartments()
        } else {
          toast.error('Failed to update department: ' + result.error)
        }
      } else {
        const result = await createDepartmentAction(formData)
        if (result.success) {
          toast.success('Department created successfully')
          resetInteractionState({ closeModal: true })
          setIsModalOpen(false)
          setSelectedDepartment(null)
          loadDepartments()
        } else {
          toast.error('Failed to create department: ' + result.error)
        }
      }
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} department: ` + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const columns = [
    { key: 'sl_no', label: 'SL.NO', width: '100px' },
    { key: 'dept_name', label: 'Department', width: 'auto' },
  ]

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Department Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage department information</p>
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
            disabled={isSelectMode ? !selectedRows.some(row => row.is_active) : !selectedDepartment?.is_active}
          >
            <Ban className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Deactivate</span>
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedDepartment}
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
          { label: 'Department', value: 'dept_name' },
          { label: 'SL.NO', value: 'sl_no' },
          { label: 'Code', value: 'code' }
        ]}
        onSearch={handleSearch}
        onShowAll={handleShowAll}
      />

      {/* Data Grid */}
        <DataGrid 
          columns={columns}
          data={departments}
          onRowClick={handleRowClick}
          selectedRow={selectedDepartment}
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
        />      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total Records: {departments.length}</span>
        {selectedDepartment && (
          <span>Selected: {selectedDepartment.dept_name}</span>
        )}
      </div>

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) setIsEditing(false)
        }}
        title="Department Master"
        description={isEditing ? "Modify department details" : "Add new department"}
        onCancel={() => {
          setIsModalOpen(false)
          setIsEditing(false)
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        isLoading={isLoading}
        saveLabel={isEditing ? "Update" : "Create"}
      >
        <DepartmentForm
          initialData={isEditing ? selectedDepartment : null}
          onSubmit={handleSave}
          isLoading={isLoading}
        />
      </FormModal>
    </div>
  )
}
