'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { runBulkActions } from '@/lib/actionResults';
import { useAuthUser } from '@/components/auth/AuthUserContext';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import CardingMachineForm from '@/components/modules/preparatory-master/CardingMachineForm';
import {
  getCardingMachinePageDataAction,
  createCardingMachineAction,
  updateCardingMachineAction,
  deleteCardingMachineAction,
  searchCardingMachinesAction
} from '@/app/actions/carding-machine';
import { Plus, Trash2, PowerOff } from 'lucide-react';
import { getMasterRecordRowClassName, orderMasterRecords } from '@/lib/masterRecordDisplay';

export default function CardingMachinePage() {
  const { canManageMasters } = useAuthUser();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [countOptions, setCountOptions] = useState([]);

  // VB6 search fields: McNo
  const searchFields = [
    { label: 'McNo', value: 'machine_no' },
    { label: 'Description', value: 'description' },
    { label: 'Model', value: 'model' }
  ];

  // Machine master summary columns. Speed already exists in carding_machines.
  const columns = [
    { key: 'machine_no', label: 'McNo', width: '100px' },
    { key: 'description', label: 'Description', width: '150px' },
    { key: 'model', label: 'Model', width: '150px' },
    { key: 'mixing_display', label: 'Count Name', width: '120px' },
    { key: 'speed', label: 'Speed', width: '80px' }
  ];

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const result = await getCardingMachinePageDataAction();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setCountOptions(result.data?.countOptions || []);

      const formattedData = (result.data?.machines || []).map(machine => ({
        ...machine,
        mixing_display: machine.prodn_mixing || '-',
        speed: machine.speed ?? 0
      }));
      
      setMachines(orderMasterRecords(formattedData));
    } catch (err) {
      console.error('Error loading carding machines:', err);
      toast.error('Failed to load carding machines: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadMachines();
      return;
    }
    
    try {
      const result = await searchCardingMachinesAction(field, condition, value);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      const formattedData = result.data.map(machine => ({
        ...machine,
        mixing_display: machine.prodn_mixing || '-',
        speed: machine.speed ?? 0
      }));
      
      setMachines(orderMasterRecords(formattedData));
      toast.success(`Found ${result.data.length} result(s)`);
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Search failed: ' + err.message);
    }
  };

  const handleShowAll = () => {
    loadMachines();
  };

  const handleRowClick = (machine) => {
    setSelectedRowId(machine.id);
  };

  const openEditForm = (machine) => {
    setEditingMachine(machine);
    setSelectedRowId(machine.id);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingMachine(null);
    setIsModalOpen(true);
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
          row => updateCardingMachineAction(row.id, { is_active: false })
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
        const result = await updateCardingMachineAction(targetId, { is_active: false });
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
      if (!confirm(`Delete ${activeRows.length} machine(s) from Machine Master?\n\nThis is a soft delete. Existing entry snapshots remain unchanged, and deleted records cannot be restored.`)) return;
      const { succeeded, failed } = await runBulkActions(activeRows, row => deleteCardingMachineAction(row.id));
      if (succeeded.length) toast.success(`${succeeded.length} machine(s) deleted from Machine Master`);
      if (failed.length) toast.error(`${failed.length} machine(s) failed: ${failed[0].error}`);
      setSelectedRows(failed.map(outcome => outcome.item));
      setIsSelectMode(failed.length > 0);
      if (succeeded.length) loadMachines();
    } else if (!isSelectMode && selectedRowId) {
      const machine = machines.find(m => m.id === selectedRowId);
      if (machine?.is_active === false) return toast.info('Machine is already deleted');
      const machineName = machine?.machine_no || 'this machine';
      if (!confirm(`Delete machine "${machineName}" from Machine Master?\n\nThis is a soft delete. Existing entry snapshots remain unchanged, and the record cannot be restored.`)) return;
      try {
        const result = await deleteCardingMachineAction(selectedRowId);
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

  const handleSave = async (formData) => {
    setIsLoading(true);
    try {
      let result;
      if (editingMachine) {
        result = await updateCardingMachineAction(editingMachine.id, formData);
        if (!result.success) throw new Error(result.error);
        toast.success('Machine updated successfully');
      } else {
        result = await createCardingMachineAction(formData);
        if (!result.success) throw new Error(result.error);
        toast.success('Machine created successfully');
      }
      setIsModalOpen(false);
      setEditingMachine(null);
      loadMachines();
    } catch (error) {
      toast.error(`Failed to ${editingMachine ? 'update' : 'create'} machine: ` + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Carding Machine</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage carding machine details</p>
        </div>
        <div className={canManageMasters ? "flex flex-wrap gap-2" : "hidden"}>
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
            style={{ display: 'none' }}
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50 flex-1 sm:flex-none"
            disabled={
              isSelectMode
                ? selectedRows.filter(r => r.is_active).length === 0
                : !selectedRowId || !machines.find(m => m.id === selectedRowId)?.is_active
            }
          >
            <PowerOff className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Remove Machine</span>
            <span className="text-xs sm:text-sm">{isSelectMode && selectedRows.filter(r => r.is_active).length > 0 && ` (${selectedRows.filter(r => r.is_active).length})`}</span>
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
      <SearchFilter
        fields={searchFields}
        onSearch={handleSearch}
        onShowAll={handleShowAll}
      />

      {/* Data Grid */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading carding machines...
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
      {!loading && (
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
        title="Carding Machine"
        description={editingMachine ? "Modify machine make details" : "Add new machine make details"}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingMachine(null);
        }}
        onDelete={null}
        showDelete={false}
        deleteLabel="Delete"
        deleteIsDanger={true}
        onSecondaryAction={null}
        secondaryActionLabel="Remove Machine"
        showSave={!editingMachine || editingMachine.is_active}
        isLoading={isLoading}
        saveLabel={editingMachine ? "Update" : "Create"}
      >
        <CardingMachineForm
          initialData={editingMachine}
          onSubmit={handleSave}
          isLoading={isLoading}
          countOptions={countOptions}
        />
      </FormModal>
    </div>
  );
}
