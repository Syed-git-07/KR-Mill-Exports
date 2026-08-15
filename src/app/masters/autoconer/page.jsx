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
import AutoconerForm from '@/components/modules/masters/AutoconerForm';
import {
  getAutoconerMachinesAction,
  createAutoconerMachineAction,
  updateAutoconerMachineAction,
  deleteAutoconerMachineAction,
  searchAutoconerMachinesAction
} from '@/app/actions/autoconer';
import { Plus, Trash2, PowerOff } from 'lucide-react';

export default function AutoconerMaster() {
  const { canManageMasters } = useAuthUser();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  const searchFields = ['machine_no', 'description', 'make_name'];
  const searchConditions = ['Like', 'Equal', 'Not Equal', 'Greater', 'Less'];

  // Count is selected here; its properties remain owned by Spinning Count Master.
  const columns = [
    { key: 'machine_no', label: 'M/c No.' },
    { key: 'description', label: 'Description' },
    { key: 'make_name', label: 'Make Name' },
    { key: 'count_name', label: 'Count' }
  ];

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const result = await getAutoconerMachinesAction();
      
      if (result.success) {
        setMachines(result.data);
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
      const result = await searchAutoconerMachinesAction(field, condition, value);
      
      if (result.success) {
        setMachines(result.data);
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

  const handleRowDoubleClick = (machine) => {
    // Open edit modal on double click (like VB6 app behavior)
    const editData = {
      ...machine,
      mc_id: machine.mc_id || null,
      group_id: machine.group_id || 1,
      model: machine.model || '',
      from_drum: machine.from_drum || null,
      to_drum: machine.to_drum || null,
      no_of_drums: machine.no_of_drums || 0,
      speed: machine.speed ?? null,
      count: machine.count || '',
      installed_date: machine.installed_date || null,
      direct_prod_entry: machine.direct_prod_entry || false
    };
    setSelectedRowId(machine.id);
    setEditingMachine(editData);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingMachine(null);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    if (!selectedRowId) {
      toast.warning('Please select a machine to edit');
      return;
    }
    
    const machineToEdit = machines.find(m => m.id === selectedRowId);
    if (machineToEdit) {
      // Prepare data for form with all fields
      const editData = {
        ...machineToEdit,
        mc_id: machineToEdit.mc_id || null,
        group_id: machineToEdit.group_id || 1,
        model: machineToEdit.model || '',
        from_drum: machineToEdit.from_drum || null,
        to_drum: machineToEdit.to_drum || null,
        no_of_drums: machineToEdit.no_of_drums || 0,
        count: machineToEdit.count || '',
        installed_date: machineToEdit.installed_date || null,
        direct_prod_entry: machineToEdit.direct_prod_entry || false
      };
      setEditingMachine(editData);
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
      if (!confirm(`Deactivate ${activeRows.length} machine(s)?\n\nThey will be hidden from new production entries.`)) return;
      try {
        const { succeeded, failed } = await runBulkActions(
          activeRows,
          row => updateAutoconerMachineAction(row.id, { is_active: false })
        );
        if (succeeded.length) toast.success(`${succeeded.length} machine(s) deactivated`);
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
        toast.warning('Please select a machine to deactivate');
        return;
      }
      const machine = machines.find(m => m.id === targetId) || editingMachine;
      if (!machine?.is_active) {
        toast.info('Machine is already inactive');
        return;
      }
      const machineName = machine?.machine_no || 'this machine';
      if (!confirm(`Deactivate machine "${machineName}"?\n\nIt will be hidden from new production entries.`)) return;
      try {
        const result = await updateAutoconerMachineAction(targetId, { is_active: false });
        if (result.success) {
          toast.success('Machine deactivated');
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

  const handleActivate = async () => {
    const machine = editingMachine;
    if (!machine || machine.is_active) return;
    if (!confirm(`Activate machine "${machine.machine_no}"?\n\nIt will be included in new production entries from today onward.`)) return;
    const result = await updateAutoconerMachineAction(machine.id, { is_active: true });
    if (!result.success) return toast.error('Failed to activate: ' + result.error);
    toast.success('Machine activated');
    setIsModalOpen(false); setEditingMachine(null); setSelectedRowId(null); loadMachines();
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk permanent delete
      if (!confirm(`Permanently remove ${selectedRows.length} machine(s)?\n\nThis cannot be undone.`)) {
        return;
      }

      try {
        await Promise.all(selectedRows.map(row => deleteAutoconerMachineAction(row.id)));
        toast.success(`${selectedRows.length} machine(s) permanently removed`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to remove machines: ' + error.message);
      }
    } else if (!isSelectMode && (selectedRowId || editingMachine?.id)) {
      // Single permanent delete
      const targetId = editingMachine?.id || selectedRowId;
      const machineName = machines.find(m => m.id === targetId)?.machine_no || editingMachine?.machine_no || 'this machine';
      if (!confirm(`Permanently remove machine "${machineName}"?\n\nThis cannot be undone.`)) {
        return;
      }

      try {
        const result = await deleteAutoconerMachineAction(targetId);
        if (result.success) {
          toast.success('Machine permanently removed');
          setSelectedRowId(null);
          setIsModalOpen(false);
          setEditingMachine(null);
          loadMachines();
        } else {
          toast.error('Failed to remove machine: ' + result.error);
        }
      } catch (err) {
        console.error('Error removing machine:', err);
        toast.error('Failed to remove machine');
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
        const result = await updateAutoconerMachineAction(editingMachine.id, machineData);
        if (result.success) {
          toast.success('Machine updated successfully');
          setIsModalOpen(false);
          setEditingMachine(null);
          loadMachines();
        } else {
          toast.error('Failed to update machine: ' + result.error);
        }
      } else {
        const result = await createAutoconerMachineAction(machineData);
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
          <h1 className="text-xl sm:text-2xl font-bold">Autoconer Machine Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage autoconer machine information</p>
        </div>
        <div className={canManageMasters ? "flex flex-wrap gap-2" : "hidden"}>
          <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none">
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
          No machines found. Click "New" to add your first machine.
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
          getRowClassName={(row) => !row.is_active ? '!bg-red-100 hover:!bg-red-200 text-red-700' : '!bg-white hover:!bg-yellow-100'}
          onRowDoubleClick={canManageMasters ? handleRowDoubleClick : undefined}
          onContextMenu={(row, e) => {
            if (!canManageMasters) return;
            e.preventDefault();
            handleRowDoubleClick(row);
          }}
        />
      )}

      {!loading && !error && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Total: {machines.length}</span>
          <span className="text-green-600">Active: {machines.filter(m => m.is_active).length}</span>
          <span className="text-red-600">Inactive: {machines.filter(m => !m.is_active).length}</span>
        </div>
      )}

      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingMachine(null);
        }}
        title="AutoConer Machine Master"
        description={editingMachine ? 'Update machine details' : 'Add a new autoconer machine to the system'}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingMachine(null);
        }}
        onDelete={null}
        showDelete={false}
        deleteLabel="Remove Permanently"
        deleteIsDanger={true}
        onSecondaryAction={editingMachine ? (editingMachine.is_active ? handleDeactivate : handleActivate) : null}
        secondaryActionLabel={editingMachine?.is_active ? "Deactivate" : "Activate"}
        saveLabel={editingMachine ? 'Update' : 'Create'}
      >
        <AutoconerForm
          initialData={editingMachine}
          onSubmit={handleSave}
          machines={machines}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingMachine(null);
          }}
        />
      </FormModal>
    </div>
  );
}
