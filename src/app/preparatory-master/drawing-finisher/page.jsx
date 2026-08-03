'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import DrawingFinisherForm from '@/components/modules/preparatory-master/DrawingFinisherForm';
import {
  getDrawingFinisherMachinesAction,
  createDrawingFinisherMachineAction,
  updateDrawingFinisherMachineAction,
  deleteDrawingFinisherMachineAction,
  searchDrawingFinisherMachinesAction
} from '@/app/actions/drawing-finisher';
import { getSpinningCountOptionsAction } from '@/app/actions/finisher-drawing-entry';
import { Plus, Trash2, PowerOff } from 'lucide-react';
import { assertAllActionsSucceeded } from '@/lib/actionResult';
import { useLatestRows } from '@/hooks/useLatestRows';

export default function DrawingFinisherPage() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [countOptions, setCountOptions] = useState([]);
  const { getCurrentRow, getCurrentRows, openRowEditor, resetInteractionState, runLatestRowsRequest } = useLatestRows({
    rows: machines, setRows: setMachines,
    selectedItem: selectedMachine, setSelectedItem: setSelectedMachine,
    selectedRows, setSelectedRows,
    setIsSelectMode,
    setIsEditing,
    setIsModalOpen,
    closeModalWhenSelectedItemStale: isEditing
  });

  // VB6 search fields: McNo
  const searchFields = [
    { label: 'McNo', value: 'machine_no' },
    { label: 'Description', value: 'description' },
    { label: 'Make', value: 'make_name' },
    { label: 'Mixing', value: 'prodn_mixing' }
  ];

  // VB6 Grid columns: McNo, Mixing Name, Description, Make, Speed (NO McEffi)
  const columns = [
    { key: 'machine_no', label: 'McNo', width: '100px' },
    { key: 'prodn_mixing', label: 'Mixing Name', width: '120px' },
    { key: 'description', label: 'Description', width: '150px' },
    { key: 'make_name', label: 'Make', width: '100px' },
    { key: 'speed', label: 'Speed', width: '80px' }
  ];

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    await runLatestRowsRequest(
      () => Promise.all([getDrawingFinisherMachinesAction(), getSpinningCountOptionsAction()]),
      {
        onStart: () => setLoading(true),
        onSuccess: ([result, countRes], { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          if (countRes?.success) setCountOptions(countRes.data || []);
          replaceRows((result.data || []).map(machine => ({
            ...machine,
            prodn_mixing: machine.prodn_mixing || '-',
            make_name: machine.make_name || '-',
            speed: machine.speed || 0
          })));
        },
        onError: err => {
          console.error('Error loading drawing finisher machines:', err);
          toast.error('Failed to load drawing finisher machines: ' + err.message);
        },
        onFinally: () => setLoading(false)
      }
    );
  };

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadMachines();
      return;
    }
    
    await runLatestRowsRequest(
      () => searchDrawingFinisherMachinesAction(field, condition, value),
      {
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows((result.data || []).map(machine => ({
            ...machine,
            prodn_mixing: machine.prodn_mixing || '-',
            make_name: machine.make_name || '-',
            speed: machine.speed || 0
          })));
          toast.success(`Found ${(result.data || []).length} result(s)`);
        },
        onError: err => {
          console.error('Search error:', err);
          toast.error('Search failed: ' + err.message);
        }
      }
    );
  };

  const handleShowAll = () => {
    loadMachines();
  };

  const handleRowClick = (machine) => {
    if (isSelectMode) return;
    setSelectedMachine(machine);
  };

  const handleAdd = () => {
    resetInteractionState();
    setSelectedMachine(null);
    setSelectedRows([]);
    setIsSelectMode(false);
    setIsEditing(false);
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

      if (!confirm(`Deactivate ${activeRows.length} machine(s)?\n\nThey will be hidden from new production entries.`)) {
        return;
      }

      try {
        const results = await Promise.all(activeRows.map(row => updateDrawingFinisherMachineAction(row.id, { is_active: false })));
        assertAllActionsSucceeded(results, 'Failed to deactivate one or more machines');
        toast.success(`${activeRows.length} machine(s) deactivated`);
        resetInteractionState({ closeModal: true });
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to deactivate: ' + error.message);
      }
    } else {
      const targetMachine = getCurrentRow(selectedMachine);
      if (!targetMachine) {
        toast.warning('Please select a machine to deactivate');
        return;
      }

      if (!targetMachine.is_active) {
        toast.info('Machine is already inactive');
        return;
      }

      if (!confirm(`Deactivate machine "${targetMachine.machine_no}"?\n\nIt will be hidden from new production entries.`)) {
        return;
      }

      try {
        const result = await updateDrawingFinisherMachineAction(targetMachine.id, { is_active: false });
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Machine deactivated');
        resetInteractionState({ closeModal: true });
        setIsModalOpen(false);
        setIsEditing(false);
        setSelectedMachine(null);
        loadMachines();
      } catch (error) {
        toast.error('Failed to deactivate: ' + error.message);
      }
    }
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      const currentSelectedRows = getCurrentRows(selectedRows);
      if (!currentSelectedRows.length) return toast.warning('The selected machines are no longer in the current list');
      if (!confirm(`Are you sure you want to delete ${currentSelectedRows.length} machine(s)?`)) {
        return;
      }

      try {
        const results = await Promise.all(currentSelectedRows.map(row => deleteDrawingFinisherMachineAction(row.id)));
        assertAllActionsSucceeded(results, 'Failed to remove one or more machines');
        toast.success(`${currentSelectedRows.length} machine(s) deleted successfully`);
        resetInteractionState({ closeModal: true });
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to delete machines: ' + error.message);
      }
    } else if (!isSelectMode && selectedMachine) {
      // Single delete from modal
      const currentMachine = getCurrentRow(selectedMachine);
      if (!currentMachine) return toast.warning('The selected machine is no longer in the current list');
      if (!confirm(`Are you sure you want to delete "${currentMachine.machine_no}"?`)) {
        return;
      }

      try {
        const result = await deleteDrawingFinisherMachineAction(currentMachine.id);
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Machine deleted successfully');
        resetInteractionState({ closeModal: true });
        setSelectedMachine(null);
        setIsModalOpen(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to delete machine: ' + error.message);
      }
    } else {
      toast.error('Please select machine(s) to delete');
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

  const handleSave = async (formData) => {
    setIsLoading(true);
    try {
      let result;
      if (isEditing && selectedMachine) {
        const currentMachine = getCurrentRow(selectedMachine);
        if (!currentMachine) throw new Error('This machine is no longer in the current list');
        result = await updateDrawingFinisherMachineAction(currentMachine.id, formData);
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Machine updated successfully');
      } else {
        result = await createDrawingFinisherMachineAction(formData);
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Machine created successfully');
      }
      resetInteractionState({ closeModal: true });
      setIsModalOpen(false);
      setSelectedMachine(null);
      loadMachines();
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} machine: ` + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Finisher Drawing Machine Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage draw frame finisher machine details</p>
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
            disabled={isSelectMode
              ? selectedRows.filter(r => r.is_active).length === 0
              : !selectedMachine || !selectedMachine.is_active
            }
          >
            <PowerOff className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Deactivate</span>
            <span className="text-xs sm:text-sm">{isSelectMode && selectedRows.filter(r => r.is_active).length > 0 && ` (${selectedRows.filter(r => r.is_active).length})`}</span>
          </Button>
          <Button 
            onClick={handleDelete} 
            className="bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedMachine}
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
          Loading drawing finisher machines...
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
          selectedRow={selectedMachine}
          showCheckbox={isSelectMode}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          getRowClassName={(row) =>
            !row.is_active
              ? '!bg-red-100 hover:!bg-red-200 text-red-700'
              : '!bg-white hover:!bg-yellow-100'
          }
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

      {/* Stats */}
      {!loading && (
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
          setIsModalOpen(open);
          if (!open) setIsEditing(false);
        }}
        title="Draw Frame Finisher M/c Master"
        description={isEditing ? "Modify machine make details" : "Add new machine make details"}
        onCancel={() => {
          setIsModalOpen(false);
          setIsEditing(false);
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        deleteLabel="Remove Permanently"
        deleteIsDanger={true}
        onSecondaryAction={isEditing && selectedMachine?.is_active ? handleDeactivate : null}
        secondaryActionLabel="Deactivate"
        isLoading={isLoading}
        saveLabel={isEditing ? "Update" : "Create"}
      >
        <DrawingFinisherForm
          initialData={isEditing ? selectedMachine : null}
          onSubmit={handleSave}
          isLoading={isLoading}
          countOptions={countOptions}
        />
      </FormModal>
    </div>
  );
}
