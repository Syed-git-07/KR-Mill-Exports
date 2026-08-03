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
import { Plus, Trash2, Ban } from 'lucide-react';
import { assertAllActionsSucceeded } from '@/lib/actionResult';
import { useLatestRows } from '@/hooks/useLatestRows';

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
  const { getCurrentRow, getCurrentRows, openRowEditor, resetInteractionState, runLatestRowsRequest } = useLatestRows({
    rows: supervisors, setRows: setSupervisors,
    selectedItem: selectedSupervisor, setSelectedItem: setSelectedSupervisor,
    selectedRows, setSelectedRows,
    setIsSelectMode,
    editingItem: editingSupervisor, setEditingItem: setEditingSupervisor,
    setIsEditing,
    setIsModalOpen
  });

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
    await runLatestRowsRequest(
      () => getSupervisorsAction(),
      {
        onStart: () => setLoading(true),
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows((result.data || []).map(supervisor => ({
            ...supervisor,
            department_name: supervisor.dept_name || '-'
          })));
          setError(null);
        },
        onError: err => {
          console.error('Error loading supervisors:', err);
          setError('Failed to load supervisors. Please check your database connection.');
          toast.error('Failed to load supervisors');
        },
        onFinally: () => setLoading(false)
      }
    );
  };

  const handleSearch = async (field, condition, value) => {
    if (!String(value ?? '').trim()) {
      await loadSupervisors();
      return;
    }
    await runLatestRowsRequest(
      () => searchSupervisorsAction(field, condition, value),
      {
        onStart: () => setLoading(true),
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows((result.data || []).map(supervisor => ({
            ...supervisor,
            department_name: supervisor.dept_name || '-'
          })));
          toast.success(`Found ${(result.data || []).length} supervisor(s)`);
        },
        onError: err => {
          console.error('Error searching supervisors:', err);
          toast.error('Search failed');
        },
        onFinally: () => setLoading(false)
      }
    );
  };

  const handleShowAll = () => {
    loadSupervisors();
    toast.info('Showing all supervisors');
  };

  const handleRowClick = (supervisor) => {
    if (isSelectMode) return;
    setSelectedSupervisor(supervisor);
  };

  const handleAdd = () => {
    resetInteractionState();
    setEditingSupervisor(null);
    setSelectedSupervisor(null);
    setSelectedRows([]);
    setIsSelectMode(false);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      const currentSelectedRows = getCurrentRows(selectedRows);
      if (!currentSelectedRows.length) return toast.warning('The selected supervisors are no longer in the current list');
      if (!confirm(`Are you sure you want to delete ${currentSelectedRows.length} supervisor(s)?`)) {
        return;
      }

      try {
        const results = await Promise.all(currentSelectedRows.map(row => deleteSupervisorAction(row.id)));
        assertAllActionsSucceeded(results, 'Failed to delete one or more supervisors');
        toast.success(`${currentSelectedRows.length} supervisor(s) deleted successfully`);
        resetInteractionState({ closeModal: true });
        setSelectedRows([]);
        setIsSelectMode(false);
      } catch (error) {
        toast.error('Failed to delete supervisors: ' + error.message);
      } finally {
        loadSupervisors();
      }
    } else if (!isSelectMode && selectedSupervisor) {
      // Single delete
      const currentSupervisor = getCurrentRow(selectedSupervisor);
      if (!currentSupervisor) return toast.warning('The selected supervisor is no longer in the current list');
      if (!confirm(`Are you sure you want to delete supervisor "${currentSupervisor.supervisor_name}"?`)) {
        return;
      }

      try {
        const result = await deleteSupervisorAction(currentSupervisor.id);
        if (result.success) {
          toast.success('Supervisor deleted successfully');
          resetInteractionState({ closeModal: true });
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

  const handleDeactivate = async () => {
    const currentTargets = isSelectMode ? getCurrentRows(selectedRows) : getCurrentRows(selectedSupervisor);
    const targets = currentTargets.filter(row => row.is_active);
    if (!targets.length) return toast.info('Select at least one active supervisor');
    if (!confirm(`Deactivate ${targets.length} supervisor(s)?`)) return;
    try {
      const results = await Promise.all(targets.map(row => updateSupervisorAction(row.id, { is_active: false })));
      assertAllActionsSucceeded(results, 'Failed to deactivate one or more supervisors');
      toast.success(`${targets.length} supervisor(s) deactivated`);
      resetInteractionState({ closeModal: true });
      setSelectedRows([]);
      setSelectedSupervisor(null);
    } catch (error) {
      toast.error('Failed to deactivate supervisors: ' + error.message);
    } finally {
      loadSupervisors();
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
    const nextSelectMode = !isSelectMode;
    resetInteractionState({ closeModal: true });
    setIsSelectMode(nextSelectMode);
  };

  const handleSave = async (supervisorData) => {
    try {
      if (isEditing && editingSupervisor) {
        const currentSupervisor = getCurrentRow(editingSupervisor);
        if (!currentSupervisor) throw new Error('This supervisor is no longer in the current list');
        const result = await updateSupervisorAction(currentSupervisor.id, supervisorData);
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
      resetInteractionState({ closeModal: true });
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
            onClick={handleDeactivate}
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? !selectedRows.some(row => row.is_active) : !selectedSupervisor?.is_active}
          >
            <Ban className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Deactivate</span>
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedSupervisor}
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Remove Permanently</span>
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
          getRowClassName={(row) => !row.is_active ? '!bg-red-100 hover:!bg-red-200 text-red-700' : '!bg-white hover:!bg-yellow-100'}
          onRowDoubleClick={(row) => {
            if (isSelectMode) return;
            openRowEditor(row);
          }}
          onContextMenu={(row, e) => {
            e.preventDefault();
            if (isSelectMode) return;
            openRowEditor(row);
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
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setIsEditing(false);
            setEditingSupervisor(null);
          }
        }}
        title="Supervisor Master"
        description={isEditing ? 'To Add, Modify, Supervisor details.' : 'Add a new supervisor to the system'}
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
