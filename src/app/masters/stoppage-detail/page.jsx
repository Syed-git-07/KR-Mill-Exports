'use client'

import { useState, useEffect } from 'react'
import { getStoppageDetailsAction, createStoppageDetailAction, updateStoppageDetailAction, deleteStoppageDetailAction, searchStoppageDetailsAction } from '@/app/actions/stoppage-detail'
import SearchFilter from '@/components/common/SearchFilter'
import DataGrid from '@/components/common/DataGrid'
import FormModal from '@/components/common/FormModal'
import StoppageDetailForm from '@/components/modules/masters/StoppageDetailForm'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function StoppageDetailPage() {
  const [stoppageDetails, setStoppageDetails] = useState([])
  const [selectedStoppageDetail, setSelectedStoppageDetail] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

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
    try {
      const result = await getStoppageDetailsAction()
      if (result.success) {
        setStoppageDetails(result.data)
      } else {
        toast.error('Failed to load stoppage details: ' + result.error)
      }
    } catch (error) {
      toast.error('Failed to load stoppage details: ' + error.message)
    }
  }

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadStoppageDetails()
      return
    }
    
    try {
      const result = await searchStoppageDetailsAction(field, condition, value)
      if (result.success) {
        setStoppageDetails(result.data)
        toast.success(`Found ${result.data.length} result(s)`)
      } else {
        toast.error('Search failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Search failed: ' + error.message)
    }
  }

  const handleShowAll = () => {
    loadStoppageDetails()
  }

  const handleRowClick = (detail) => {
    setSelectedStoppageDetail(detail)
  }

  const handleAdd = () => {
    setSelectedStoppageDetail(null)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      if (!confirm(`Are you sure you want to delete ${selectedRows.length} stoppage detail(s)?`)) {
        return
      }

      try {
        await Promise.all(selectedRows.map(row => deleteStoppageDetailAction(row.id)))
        toast.success(`${selectedRows.length} stoppage detail(s) deleted successfully`)
        setSelectedRows([])
        setIsSelectMode(false)
        loadStoppageDetails()
      } catch (error) {
        toast.error('Failed to delete stoppage details: ' + error.message)
      }
    } else if (!isSelectMode && selectedStoppageDetail) {
      // Single delete from modal
      if (!confirm(`Are you sure you want to delete "${selectedStoppageDetail.stoppage_name}"?`)) {
        return
      }

      try {
        const result = await deleteStoppageDetailAction(selectedStoppageDetail.id)
        if (result.success) {
          toast.success('Stoppage detail deleted successfully')
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

  const handleSave = async (formData) => {
    try {
      setIsLoading(true)
      if (isEditing && selectedStoppageDetail) {
        const result = await updateStoppageDetailAction(selectedStoppageDetail.id, formData)
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
    setIsSelectMode(!isSelectMode)
    setSelectedRows([])
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
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedStoppageDetail}
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
        onContextMenu={(row, e) => {
          e.preventDefault()
          setSelectedStoppageDetail(row)
          setIsEditing(true)
          setIsModalOpen(true)
        }}
      />

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Stoppage Detail Master"
        description={isEditing ? "Modify stoppage detail information" : "Add new stoppage detail"}
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
        <StoppageDetailForm
          initialData={selectedStoppageDetail}
          onSubmit={handleSave}
        />
      </FormModal>
    </div>
  )
}
