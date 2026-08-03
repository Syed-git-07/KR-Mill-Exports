'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import SpinningMachineForm from '@/components/modules/masters/SpinningMachineForm';
import {
  getSpinningMachinesAction,
  createSpinningMachineAction,
  updateSpinningMachineAction,
  deleteSpinningMachineAction,
  searchSpinningMachinesAction,
  getSpinningMachineWithSetupAction
} from '@/app/actions/spinning-machine';
import { Plus, Trash2, PowerOff } from 'lucide-react';
import { assertAllActionsSucceeded } from '@/lib/actionResult';
import { useLatestRows } from '@/hooks/useLatestRows';

export default function SpinningMachineMaster() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const editRequestRef = useRef(0);
  const { getCurrentRow, getCurrentRows, openRowEditor, resetInteractionState, runLatestRowsRequest } = useLatestRows({
    rows: machines, setRows: setMachines,
    selectedId: selectedRowId, setSelectedId: setSelectedRowId,
    selectedRows, setSelectedRows,
    setIsSelectMode,
    editingItem: editingMachine, setEditingItem: setEditingMachine,
    setIsModalOpen
  });

  const searchFields = [
    'machine_no',
    'description',
    'make_name'
  ];

  const searchConditions = ['Like', 'Equal', 'Not Equal', 'Greater', 'Less'];

  const columns = [
    { key: 'machine_no', label: 'Machine No', width: '150px' },
    { key: 'description', label: 'Description', width: 'auto' },
    { key: 'make_name', label: 'Make Name', width: '150px' }
  ];

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    await runLatestRowsRequest(
      () => getSpinningMachinesAction(),
      {
        onStart: () => setLoading(true),
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows((result.data || []).map(machine => ({
            ...machine,
            remarks: machine.remarks || '-'
          })));
          setError(null);
        },
        onError: err => {
          console.error('Error loading machines:', err);
          setError('Failed to load machines. Please check your database connection.');
          toast.error('Failed to load machines');
        },
        onFinally: () => setLoading(false)
      }
    );
  };

  const handleSearch = async (field, condition, value) => {
    if (!String(value ?? '').trim()) {
      await loadMachines();
      return;
    }
    await runLatestRowsRequest(
      () => searchSpinningMachinesAction(field, condition, value),
      {
        onStart: () => setLoading(true),
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows((result.data || []).map(machine => ({
            ...machine,
            remarks: machine.remarks || '-'
          })));
          toast.success(`Found ${(result.data || []).length} machine(s)`);
        },
        onError: err => {
          console.error('Error searching machines:', err);
          toast.error('Search failed');
        },
        onFinally: () => setLoading(false)
      }
    );
  };

  const handleReset = () => {
    loadMachines();
    toast.info('Showing all machines');
  };

  const handleRowClick = (machine) => {
    if (isSelectMode) return;
    setSelectedRowId(machine.id);
  };

  const openEditForm = async (machine) => {
    if (isSelectMode) return;
    const requestId = ++editRequestRef.current;
    const result = await getSpinningMachineWithSetupAction(machine.id);
    if (requestId !== editRequestRef.current) return;
    const currentMachine = getCurrentRow(machine.id);
    if (!currentMachine) return;
    const merged = result.success && result.data ? result.data : currentMachine;
    openRowEditor(currentMachine, { editingItem: merged });
  };

  const handleNew = () => {
    editRequestRef.current += 1;
    resetInteractionState();
    setEditingMachine(null);
    setSelectedRowId(null);
    setSelectedRows([]);
    setIsSelectMode(false);
    setIsModalOpen(true);
  };

  const handleDeactivate = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      const currentSelectedRows = getCurrentRows(selectedRows);
      if (!currentSelectedRows.length) return toast.warning('The selected machines are no longer in the current list');
      const activeRows = currentSelectedRows.filter(r => r.is_active);
      if (activeRows.length === 0) {
        toast.info('All selected machines are already inactive');
        return;
      }
      if (!confirm(`Deactivate ${activeRows.length} machine(s)?\n\nThey will be hidden from new production entries.`)) return;
      try {
        const results = await Promise.all(activeRows.map(row => updateSpinningMachineAction(row.id, { is_active: false })));
        assertAllActionsSucceeded(results, 'Failed to deactivate one or more machines');
        toast.success(`${activeRows.length} machine(s) deactivated`);
        resetInteractionState({ closeModal: true });
        setSelectedRows([]);
        setIsSelectMode(false);
      } catch (error) {
        toast.error('Failed to deactivate: ' + error.message);
      } finally {
        loadMachines();
      }
    } else {
      const machine = getCurrentRow(editingMachine?.id || selectedRowId);
      if (!machine) {
        toast.warning('Please select a machine to deactivate');
        return;
      }
      if (!machine?.is_active) {
        toast.info('Machine is already inactive');
        return;
      }
      const machineName = machine?.machine_no || 'this machine';
      if (!confirm(`Deactivate machine "${machineName}"?\n\nIt will be hidden from new production entries.`)) return;
      try {
        const result = await updateSpinningMachineAction(machine.id, { is_active: false });
        if (result.success) {
          toast.success('Machine deactivated');
          resetInteractionState({ closeModal: true });
          setIsModalOpen(false);
          setEditingMachine(null);
          setSelectedRowId(null);
          loadMachines();
        } else {
          toast.error('Failed to deactivate: ' + result.error);
        }
      } catch (error) {
        toast.error('Failed to deactivate: ' + error.message);
      }
    }
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk permanent delete
      const currentSelectedRows = getCurrentRows(selectedRows);
      if (!currentSelectedRows.length) return toast.warning('The selected machines are no longer in the current list');
      if (!confirm(`Permanently remove ${currentSelectedRows.length} machine(s)?\n\nThis cannot be undone.`)) {
        return;
      }

      try {
        const results = await Promise.all(currentSelectedRows.map(row => deleteSpinningMachineAction(row.id)));
        assertAllActionsSucceeded(results, 'Failed to remove one or more machines');
        toast.success(`${currentSelectedRows.length} machine(s) permanently removed`);
        resetInteractionState({ closeModal: true });
        setSelectedRows([]);
        setIsSelectMode(false);
      } catch (error) {
        toast.error('Failed to remove machines: ' + error.message);
      } finally {
        loadMachines();
      }
    } else if (!isSelectMode && selectedRowId) {
      // Single permanent delete from modal
      const machine = getCurrentRow(selectedRowId);
      if (!machine) return toast.warning('The selected machine is no longer in the current list');
      const machineName = machine?.machine_no || 'this machine';
      if (!confirm(`Permanently remove machine "${machineName}"?\n\nThis cannot be undone.`)) {
        return;
      }

      try {
        const result = await deleteSpinningMachineAction(machine.id);
        if (result.success) {
          toast.success('Machine permanently removed');
          resetInteractionState({ closeModal: true });
          setSelectedRowId(null);
          setIsModalOpen(false);
          setEditingMachine(null);
          loadMachines();
        } else {
          toast.error('Failed to remove machine: ' + result.error);
        }
      } catch (error) {
        toast.error('Failed to remove machine: ' + error.message);
      }
    } else {
      toast.error('Please select machine(s) to remove');
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
      setSelectedRows([...machines]);
    } else {
      setSelectedRows([]);
    }
  };

  const toggleSelectMode = () => {
    const nextSelectMode = !isSelectMode;
    resetInteractionState({ closeModal: true });
    setIsSelectMode(nextSelectMode);
  };

  const handleSave = async (machineData) => {
    try {
      if (editingMachine) {
        const currentMachine = getCurrentRow(editingMachine);
        if (!currentMachine) throw new Error('This machine is no longer in the current list');
        const result = await updateSpinningMachineAction(currentMachine.id, machineData);
        if (result.success) {
          toast.success('Machine updated successfully');
          resetInteractionState({ closeModal: true });
          setIsModalOpen(false);
          setEditingMachine(null);
          loadMachines();
        } else {
          toast.error('Failed to update machine: ' + result.error);
        }
      } else {
        const result = await createSpinningMachineAction(machineData);
        if (result.success) {
          toast.success('Machine created successfully');
          resetInteractionState({ closeModal: true });
          setIsModalOpen(false);
          setEditingMachine(null);
          loadMachines();
        } else {
          toast.error('Failed to create machine: ' + result.error);
        }
      }
    } catch (err) {
      console.error('Error saving machine:', err);
      toast.error(err.message || 'Failed to save machine');
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Spinning Machine Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage spinning machine information</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none">
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
            disabled={isSelectMode
              ? selectedRows.filter(r => r.is_active).length === 0
              : !selectedRowId || !machines.find(m => m.id === selectedRowId)?.is_active
            }
          >
            <PowerOff className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Deactivate</span>
            <span className="text-xs sm:text-sm">{isSelectMode && selectedRows.filter(r=>r.is_active).length > 0 && ` (${selectedRows.filter(r=>r.is_active).length})`}</span>
          </Button>
          <Button 
            onClick={handleDelete} 
            className="bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedRowId}
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
        onShowAll={handleReset}
      />

      {/* Data Grid */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading machines...
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          {error}
        </div>
      ) : machines.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No machines found. Click "Add New" to add your first machine.
        </div>
      ) : (
        <DataGrid
          columns={columns}
          data={machines}
          onRowClick={handleRowClick}
          selectedRow={machines.find(m => m.id === selectedRowId)}
          showCheckbox={isSelectMode}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          getRowClassName={(row) =>
            !row.is_active
              ? '!bg-red-100 hover:!bg-red-200 text-red-700'
              : '!bg-white hover:!bg-yellow-100'
          }
          onRowDoubleClick={openEditForm}
          onContextMenu={(row, e) => {
            e.preventDefault();
            if (isSelectMode) return;
            openEditForm(row);
          }}
        />
      )}

      {/* Stats */}
      {!loading && !error && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total Records: {machines.length}</span>
          <span className="text-green-700">Active: {machines.filter(m => m.is_active).length}</span>
          <span className="text-red-600">Inactive: {machines.filter(m => !m.is_active).length}</span>
        </div>
      )}

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) {
            editRequestRef.current += 1
            setEditingMachine(null)
          }
        }}
        title="Spinning Machine Master"
        description={editingMachine ? "Modify machine details" : "Add new machine"}
        onCancel={() => {
          editRequestRef.current += 1
          setIsModalOpen(false)
          setEditingMachine(null)
        }}
        onDelete={editingMachine ? handleDelete : null}
        showDelete={editingMachine}
        deleteLabel="Remove Permanently"
        deleteIsDanger={true}
        onSecondaryAction={editingMachine?.is_active ? handleDeactivate : null}
        secondaryActionLabel="Deactivate"
        saveLabel={editingMachine ? "Update" : "Create"}
      >
        <SpinningMachineForm
          initialData={editingMachine}
          onSubmit={handleSave}
        />
      </FormModal>
    </div>
  );
}
