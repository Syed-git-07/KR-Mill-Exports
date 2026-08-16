'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { runBulkActions } from '@/lib/actionResults';
import { MASTER_DELETE_DISABLED_MESSAGE } from '@/lib/masterSafety';
import { useAuthUser } from '@/components/auth/AuthUserContext';
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
import { Plus, Pencil, Trash2, PowerOff } from 'lucide-react';

export default function SpinningMachineMaster() {
  const { canManageMasters } = useAuthUser();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

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
    try {
      setLoading(true);
      const result = await getSpinningMachinesAction();
      
      if (result.success) {
        // Format data for display - keep only fields shown in table
        const formattedData = result.data.map(machine => ({
          ...machine,
          remarks: machine.remarks || '-'
        }));
        
        setMachines(formattedData);
        setError(null);
      } else {
        setError('Failed to load machines: ' + result.error);
        toast.error('Failed to load machines: ' + result.error);
      }
    } catch (err) {
      console.error('Error loading machines:', err);
      setError('Failed to load machines. Please check your database connection.');
      toast.error('Failed to load machines');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (field, condition, value) => {
    try {
      setLoading(true);
      const result = await searchSpinningMachinesAction(field, condition, value);
      
      if (result.success) {
        const formattedData = result.data.map(machine => ({
          ...machine,
          remarks: machine.remarks || '-'
        }));
        
        setMachines(formattedData);
        toast.success(`Found ${result.data.length} machine(s)`);
      } else {
        toast.error('Search failed: ' + result.error);
      }
    } catch (err) {
      console.error('Error searching machines:', err);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    loadMachines();
    toast.info('Showing all machines');
  };

  const handleRowClick = (machine) => {
    setSelectedRowId(machine.id);
  };

  const openEditForm = async (machine) => {
    const result = await getSpinningMachineWithSetupAction(machine.id);
    const merged = result.success && result.data ? result.data : machine;
    setEditingMachine(merged);
    setSelectedRowId(machine.id);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingMachine(null);
    setIsModalOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedRowId) {
      toast.warning('Please select a machine to edit');
      return;
    }
    
    const machineToEdit = machines.find(m => m.id === selectedRowId);
    if (machineToEdit) {
      const result = await getSpinningMachineWithSetupAction(machineToEdit.id);
      const merged = result.success && result.data ? result.data : machineToEdit;
      setEditingMachine(merged);
      setIsModalOpen(true);
    }
  };

  const handleDeactivate = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      const activeRows = selectedRows.filter(r => r.is_active);
      if (activeRows.length === 0) {
        toast.info('All selected machines are already inactive');
        return;
      }
      if (!confirm(`Permanently remove ${activeRows.length} machine(s)?\n\nThey will be excluded from entries initialized today onward and cannot be restored.`)) return;
      try {
        const { succeeded, failed } = await runBulkActions(
          activeRows,
          row => updateSpinningMachineAction(row.id, { is_active: false })
        );
        if (succeeded.length) toast.success(`${succeeded.length} machine(s) removed`);
        if (failed.length) toast.error(`${failed.length} machine(s) failed: ${failed[0].error}`);
        setSelectedRows(failed.map(outcome => outcome.item));
        setIsSelectMode(failed.length > 0);
        if (succeeded.length) loadMachines();
      } catch (error) {
        toast.error('Failed to deactivate: ' + error.message);
      }
    } else {
      const targetId = editingMachine?.id || selectedRowId;
      if (!targetId) {
        toast.warning('Please select a machine to remove');
        return;
      }
      const machine = machines.find(m => m.id === targetId) || editingMachine;
      if (!machine?.is_active) {
        toast.info('Machine is already inactive');
        return;
      }
      const machineName = machine?.machine_no || 'this machine';
      if (!confirm(`Permanently remove machine "${machineName}"?\n\nIt will be excluded from entries initialized today onward and cannot be restored.`)) return;
      try {
        const result = await updateSpinningMachineAction(targetId, { is_active: false });
        if (result.success) {
          toast.success('Machine removed');
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
      if (!confirm(`Permanently remove ${selectedRows.length} machine(s)?\n\nThis cannot be undone.`)) {
        return;
      }

      try {
        await Promise.all(selectedRows.map(row => deleteSpinningMachineAction(row.id)));
        toast.success(`${selectedRows.length} machine(s) permanently removed`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to remove machines: ' + error.message);
      }
    } else if (!isSelectMode && selectedRowId) {
      // Single permanent delete from modal
      const machine = machines.find(m => m.id === selectedRowId);
      const machineName = machine?.machine_no || 'this machine';
      if (!confirm(`Permanently remove machine "${machineName}"?\n\nThis cannot be undone.`)) {
        return;
      }

      try {
        const result = await deleteSpinningMachineAction(selectedRowId);
        if (result.success) {
          toast.success('Machine permanently removed');
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
    setIsSelectMode(!isSelectMode);
    setSelectedRows([]);
  };

  const handleSave = async (machineData) => {
    try {
      if (editingMachine) {
        const result = await updateSpinningMachineAction(editingMachine.id, machineData);
        if (result.success) {
          toast.success('Machine updated successfully');
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
        <div className={canManageMasters ? "flex flex-wrap gap-2" : "hidden"}>
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
            style={{ display: 'none' }}
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50 flex-1 sm:flex-none"
            disabled={isSelectMode
              ? selectedRows.filter(r => r.is_active).length === 0
              : !selectedRowId || !machines.find(m => m.id === selectedRowId)?.is_active
            }
          >
            <PowerOff className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Remove Machine</span>
            <span className="text-xs sm:text-sm">{isSelectMode && selectedRows.filter(r=>r.is_active).length > 0 && ` (${selectedRows.filter(r=>r.is_active).length})`}</span>
          </Button>
          <Button 
            onClick={handleDelete} 
            className="bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-none"
            disabled
            title={MASTER_DELETE_DISABLED_MESSAGE}
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="text-xs sm:text-sm">Deletion Disabled</span>
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
          onRowDoubleClick={canManageMasters ? openEditForm : undefined}
          onContextMenu={(row, e) => {
            if (!canManageMasters) return;
            e.preventDefault();
            openEditForm(row);
          }}
        />
      )}

      {/* Stats */}
      {!loading && !error && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total Records: {machines.length}</span>
          <span className="text-green-700">Available: {machines.filter(m => m.is_active).length}</span>
          <span className="text-red-600">Removed: {machines.filter(m => !m.is_active).length}</span>
        </div>
      )}

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Spinning Machine Master"
        description={editingMachine ? "Modify machine details" : "Add new machine"}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingMachine(null)
        }}
        onDelete={null}
        showDelete={false}
        deleteLabel="Remove Permanently"
        deleteIsDanger={true}
        onSecondaryAction={null}
        secondaryActionLabel="Remove Machine"
        showSave={!editingMachine || editingMachine.is_active}
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
