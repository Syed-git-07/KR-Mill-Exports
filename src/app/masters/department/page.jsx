'use client'

import { useState, useEffect } from 'react'
import { getDepartmentsAction, createDepartmentAction, updateDepartmentAction, deleteDepartmentAction, searchDepartmentsAction } from '@/app/actions/department'
import SearchFilter from '@/components/common/SearchFilter'
import DataGrid from '@/components/common/DataGrid'
import FormModal from '@/components/common/FormModal'
import DepartmentForm from '@/components/modules/masters/DepartmentForm'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function DepartmentPage() {
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      const result = await getDepartmentsAction()
      if (result.success) {
        setDepartments(result.data)
      } else {
        toast.error('Failed to load departments: ' + result.error)
      }
    } catch (error) {
      toast.error('Failed to load departments: ' + error.message)
    }
  }

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadDepartments()
      return
    }
    
    try {
      const result = await searchDepartmentsAction(field, condition, value)
      if (result.success) {
        setDepartments(result.data)
        toast.success(`Found ${result.data.length} result(s)`)
      } else {
        toast.error('Search failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Search failed: ' + error.message)
    }
  }

  const handleShowAll = () => {
    loadDepartments()
  }

  const handleRowClick = (dept) => {
    setSelectedDepartment(dept)
  }

  const handleAdd = () => {
    setSelectedDepartment(null)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleEdit = () => {
    if (!selectedDepartment) {
      toast.error('Please select a department to edit')
      return
    }
    setIsEditing(true)
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      if (!confirm(`Are you sure you want to delete ${selectedRows.length} department(s)?`)) {
        return
      }

      try {
        await Promise.all(selectedRows.map(row => deleteDepartmentAction(row.id)))
        toast.success(`${selectedRows.length} department(s) deleted successfully`)
        setSelectedRows([])
        setIsSelectMode(false)
        loadDepartments()
      } catch (error) {
        toast.error('Failed to delete departments: ' + error.message)
      }
    } else if (!isSelectMode && selectedDepartment) {
      // Single delete from modal
      if (!confirm(`Are you sure you want to delete "${selectedDepartment.dept_name}"?`)) {
        return
      }

      try {
        const result = await deleteDepartmentAction(selectedDepartment.id)
        if (result.success) {
          toast.success('Department deleted successfully')
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
    setIsSelectMode(!isSelectMode)
    setSelectedRows([])
  }

  const handleSave = async (formData) => {
    setIsLoading(true)
    try {
      if (isEditing && selectedDepartment) {
        const result = await updateDepartmentAction(selectedDepartment.id, formData)
        if (result.success) {
          toast.success('Department updated successfully')
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
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedDepartment}
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Delete</span>
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
          onContextMenu={(row, e) => {
            e.preventDefault();
            setSelectedDepartment(row);
            setIsEditing(true);
            setIsModalOpen(true);
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
        onOpenChange={setIsModalOpen}
        title="Department Master"
        description={isEditing ? "Modify department details" : "Add new department"}
        onSave={() => {
          const form = document.querySelector('form')
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
          }
        }}
        onCancel={() => setIsModalOpen(false)}
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
