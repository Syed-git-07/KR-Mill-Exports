'use client';

import { confirmAction } from '@/lib/confirmation'

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { runBulkActions } from '@/lib/actionResults';
import { useAuthUser } from '@/components/auth/AuthUserContext';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import SpinningMachineForm from '@/components/modules/masters/SpinningMachineForm';
import {
  getSpinningMachinesAction,
  getSpinningMasterEfficiencyAction,
  setSpinningMasterEfficiencyAction,
  createSpinningMachineAction,
  updateSpinningMachineAction,
  deleteSpinningMachineAction,
  searchSpinningMachinesAction,
  getSpinningMachineWithSetupAction
} from '@/app/actions/spinning-machine';
import { Plus, Pencil, Trash2, PowerOff } from 'lucide-react';
import { getActiveMasterRecordCount, getMasterRecordRowClassName, orderMasterRecords } from '@/lib/masterRecordDisplay';

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
  const [efficiencyPercent, setEfficiencyPercent] = useState('');
  const [efficiencyLoading, setEfficiencyLoading] = useState(true);
  const [efficiencySaving, setEfficiencySaving] = useState(false);

  useEffect(() => {
    getSpinningMasterEfficiencyAction().then(result => {
      if (!result.success) throw new Error(result.error);
      setEfficiencyPercent(String(Math.round(result.data * 10000) / 100));
    }).catch(error => toast.error(error.message || 'Failed to load efficiency'))
      .finally(() => setEfficiencyLoading(false));
  }, []);

  const applyEfficiencyPercent = async () => {
    const percent = Number(efficiencyPercent);
    if (efficiencyPercent.trim() === '' || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error('Efficiency must be between 0 and 100');
      return;
    }
    setEfficiencySaving(true);
    try {
      const result = await setSpinningMasterEfficiencyAction(percent);
      if (!result.success) throw new Error(result.error);
      const savedPercent = Math.round(result.data * 10000) / 100;
      setEfficiencyPercent(String(savedPercent));
      toast.success(`Efficiency saved at ${savedPercent}% for all machines in future entries.`);
    } catch (error) {
      toast.error(error.message || 'Failed to save efficiency');
    } finally {
      setEfficiencySaving(false);
    }
  };

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
        
        setMachines(orderMasterRecords(formattedData));
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
        
        setMachines(orderMasterRecords(formattedData));
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
      if (!(await confirmAction('permanently remove'))) return;
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
      if (!(await confirmAction('permanently remove'))) return;
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
      const activeRows = selectedRows.filter(row => row.is_active !== false);
      if (activeRows.length === 0) return toast.info('All selected machines are already deleted');
      if (!(await confirmAction('delete'))) return;

      const { succeeded, failed } = await runBulkActions(
        activeRows,
        row => deleteSpinningMachineAction(row.id)
      );
      if (succeeded.length) toast.success(`${succeeded.length} machine(s) deleted from Machine Master`);
      if (failed.length) toast.error(`${failed.length} machine(s) failed: ${failed[0].error}`);
      setSelectedRows(failed.map(outcome => outcome.item));
      setIsSelectMode(failed.length > 0);
      if (succeeded.length) loadMachines();
    } else if (!isSelectMode && selectedRowId) {
      const machine = machines.find(m => m.id === selectedRowId);
      if (machine?.is_active === false) return toast.info('Machine is already deleted');
      const machineName = machine?.machine_no || 'this machine';
      if (!(await confirmAction('delete'))) return;

      try {
        const result = await deleteSpinningMachineAction(selectedRowId);
        if (result.success) {
          toast.success('Machine deleted from Machine Master');
          setSelectedRowId(null);
          setIsModalOpen(false);
          setEditingMachine(null);
          loadMachines();
        } else {
          toast.error('Failed to delete machine: ' + result.error);
        }
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
    setIsSelectMode(!isSelectMode);
    setSelectedRows([]);
  };

  const handleSave = async (machineData) => {
    if (!(await confirmAction('update'))) return
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
            disabled={isSelectMode
              ? selectedRows.filter(row => row.is_active !== false).length === 0
              : !selectedRowId || machines.find(row => row.id === selectedRowId)?.is_active === false
            }
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="text-xs sm:text-sm">Delete</span>
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      {canManageMasters && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Label htmlFor="bulk-spinning-efficiency" className="font-semibold text-blue-900">Set Efficiency %</Label>
          <NumberInput
            id="bulk-spinning-efficiency"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={efficiencyPercent}
            onChange={event => setEfficiencyPercent(event.target.value)}
            disabled={efficiencyLoading || efficiencySaving}
            className="w-24 bg-white text-center"
          />
          <Button type="button" onClick={applyEfficiencyPercent} disabled={efficiencyLoading || efficiencySaving} className="bg-blue-600 text-white hover:bg-blue-700">
            {efficiencySaving ? 'Saving...' : 'Apply all'}
          </Button>
          <p className="text-sm text-blue-900">Applies to all machines in new entries. Existing entries keep their saved efficiency.</p>
        </div>
      )}

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
          No machines found. Click &quot;Add New&quot; to add your first machine.
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
          getRowClassName={getMasterRecordRowClassName}
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
          <span>Active Machines: {getActiveMasterRecordCount(machines)}</span>
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
        deleteLabel="Delete"
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
