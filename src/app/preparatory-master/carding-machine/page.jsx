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
import CardingMachineForm from '@/components/modules/preparatory-master/CardingMachineForm';
import {
  getCardingMachinePageDataAction,
  createCardingMachineAction,
  updateCardingMachineAction,
  deleteCardingMachineAction,
  searchCardingMachinesAction
} from '@/app/actions/carding-machine';
import { Plus, Trash2, PowerOff } from 'lucide-react';

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
      
      setMachines(formattedData);
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
      
      setMachines(formattedData);
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
      if (!confirm(`Deactivate ${activeRows.length} machine(s)?\n\nThey will be hidden from new production entries.`)) return;
      try {
        const { succeeded, failed } = await runBulkActions(
          activeRows,
          row => updateCardingMachineAction(row.id, { is_active: false })
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
        const result = await updateCardingMachineAction(targetId, { is_active: false });
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
    const result = await updateCardingMachineAction(machine.id, { is_active: true });
    if (!result.success) return toast.error('Failed to activate: ' + result.error);
    toast.success('Machine activated');
    setIsModalOpen(false); setEditingMachine(null); setSelectedRowId(null); loadMachines();
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      if (!confirm(`Permanently remove ${selectedRows.length} machine(s)?\n\nThis cannot be undone.`)) {
        return;
      }
      try {
        await Promise.all(selectedRows.map(row => deleteCardingMachineAction(row.id)));
        toast.success(`${selectedRows.length} machine(s) permanently removed`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to remove machines: ' + error.message);
      }
    } else if (!isSelectMode && selectedRowId) {
      const machine = machines.find(m => m.id === selectedRowId);
      const machineName = machine?.machine_no || 'this machine';
      if (!confirm(`Permanently remove machine "${machineName}"?\n\nThis cannot be undone.`)) {
        return;
      }
      try {
        const result = await deleteCardingMachineAction(selectedRowId);
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
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50 flex-1 sm:flex-none"
            disabled={
              isSelectMode
                ? selectedRows.filter(r => r.is_active).length === 0
                : !selectedRowId || !machines.find(m => m.id === selectedRowId)?.is_active
            }
          >
            <PowerOff className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Deactivate</span>
            <span className="text-xs sm:text-sm">{isSelectMode && selectedRows.filter(r => r.is_active).length > 0 && ` (${selectedRows.filter(r => r.is_active).length})`}</span>
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
        onOpenChange={setIsModalOpen}
        title="Carding Machine"
        description={editingMachine ? "Modify machine make details" : "Add new machine make details"}
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
