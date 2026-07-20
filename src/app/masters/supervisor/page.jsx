'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import SupervisorForm from '@/components/modules/masters/SupervisorForm';
import {
  getSupervisorsAction,
  createSupervisorAction,
  updateSupervisorAction,
  deleteSupervisorAction,
  searchSupervisorsAction
} from '@/app/actions/supervisor';
import { Plus, Trash2 } from 'lucide-react';

export default function SupervisorMaster() {
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  const searchFields = ['code', 'supervisor_name', 'department_name'];

  const columns = [
    { key: 'code', label: 'Code', width: '100px' },
    { key: 'supervisor_name', label: 'Name', width: 'auto' },
    { key: 'department_name', label: 'Department', width: 'auto' }
  ];

  useEffect(() => {
    loadSupervisors();
  }, []);

  const loadSupervisors = async () => {
    try {
      setLoading(true);
      const result = await getSupervisorsAction();
      
      if (result.success) {
        const formattedData = result.data.map(supervisor => ({
          ...supervisor,
          department_name: supervisor.dept_name || '-'
        }));
        
        setSupervisors(formattedData);
        setError(null);
      } else {
        setError('Failed to load supervisors: ' + result.error);
        toast.error('Failed to load supervisors');
      }
    } catch (err) {
      console.error('Error loading supervisors:', err);
      setError('Failed to load supervisors. Please check your database connection.');
      toast.error('Failed to load supervisors');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (field, condition, value) => {
    try {
      setLoading(true);
      const result = await searchSupervisorsAction(field, condition, value);
      
      if (result.success) {
        const formattedData = result.data.map(supervisor => ({
          ...supervisor,
          department_name: supervisor.dept_name || '-'
        }));
        
        setSupervisors(formattedData);
        toast.success(`Found ${result.data.length} supervisor(s)`);
      } else {
        toast.error('Search failed: ' + result.error);
      }
    } catch (err) {
      console.error('Error searching supervisors:', err);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleShowAll = () => {
    loadSupervisors();
    toast.info('Showing all supervisors');
  };

  const handleRowClick = (supervisor) => {
    setSelectedSupervisor(supervisor);
  };

  const handleAdd = () => {
    setEditingSupervisor(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      if (!confirm(`Are you sure you want to delete ${selectedRows.length} supervisor(s)?`)) {
        return;
      }

      try {
        await Promise.all(selectedRows.map(row => deleteSupervisorAction(row.id)));
        toast.success(`${selectedRows.length} supervisor(s) deleted successfully`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadSupervisors();
      } catch (error) {
        toast.error('Failed to delete supervisors: ' + error.message);
      }
    } else if (!isSelectMode && selectedSupervisor) {
      // Single delete
      if (!confirm(`Are you sure you want to delete supervisor "${selectedSupervisor.supervisor_name}"?`)) {
        return;
      }

      try {
        const result = await deleteSupervisorAction(selectedSupervisor.id);
        if (result.success) {
          toast.success('Supervisor deleted successfully');
          setSelectedSupervisor(null);
          loadSupervisors();
        } else {
          toast.error('Failed to delete supervisor: ' + result.error);
        }
      } catch (err) {
        console.error('Error deleting supervisor:', err);
        toast.error('Failed to delete supervisor');
      }
    } else {
      toast.error('Please select supervisor(s) to delete');
    }
  };

  const handleSelectRow = (row) => {
    setSelectedRows(prev => {
      const exists = prev.some(r => r.id === row.id);
      if (exists) {
        return prev.filter(r => r.id !== row.id);
      } else {
        return [...prev, row];
      }
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows([...supervisors]);
    } else {
      setSelectedRows([]);
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedRows([]);
  };

  const handleSave = async (supervisorData) => {
    try {
      if (isEditing && editingSupervisor) {
        const result = await updateSupervisorAction(editingSupervisor.id, supervisorData);
        if (result.success) {
          toast.success('Supervisor updated successfully');
        } else {
          toast.error('Failed to update supervisor: ' + result.error);
          return;
        }
      } else {
        const result = await createSupervisorAction(supervisorData);
        if (result.success) {
          toast.success('Supervisor created successfully');
        } else {
          toast.error('Failed to create supervisor: ' + result.error);
          return;
        }
      }
      setIsModalOpen(false);
      setIsEditing(false);
      setEditingSupervisor(null);
      setSelectedSupervisor(null);
      loadSupervisors();
    } catch (err) {
      console.error('Error saving supervisor:', err);
      toast.error(err.message || 'Failed to save supervisor');
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Supervisor Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage supervisor information</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">New</span>
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
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedSupervisor}
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Delete</span>
            <span className="text-xs sm:text-sm">{isSelectMode && selectedRows.length > 0 && ` (${selectedRows.length})`}</span>
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      <SearchFilter
        fields={searchFields}
        onSearch={handleSearch}
        onShowAll={handleShowAll}
      />

      {/* Data Grid */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading supervisors...
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          {error}
        </div>
      ) : supervisors.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No supervisors found. Click "New" to add your first supervisor.
        </div>
      ) : (
        <DataGrid
          columns={columns}
          data={supervisors}
          onRowClick={handleRowClick}
          selectedRow={selectedSupervisor}
          showCheckbox={isSelectMode}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          onContextMenu={(row, e) => {
            e.preventDefault();
            setSelectedSupervisor(row);
            setEditingSupervisor(row);
            setIsEditing(true);
            setIsModalOpen(true);
          }}
        />
      )}

      {!loading && !error && (
        <div className="text-sm text-muted-foreground">
          Total Supervisors: {supervisors.length}
        </div>
      )}

      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Supervisor Master"
        description={isEditing ? 'To Add, Modify, Supervisor details.' : 'Add a new supervisor to the system'}
        onSave={() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }}
        onCancel={() => {
          setIsModalOpen(false);
          setIsEditing(false);
          setEditingSupervisor(null);
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        isLoading={loading}
        saveLabel={isEditing ? 'Update' : 'Save'}
      >
        <SupervisorForm
          initialData={editingSupervisor}
          onSubmit={handleSave}
          isLoading={loading}
        />
      </FormModal>
    </div>
  );
}
