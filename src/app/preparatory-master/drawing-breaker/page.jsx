'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import DrawingBreakerForm from '@/components/modules/preparatory-master/DrawingBreakerForm';
import {
  getDrawingBreakerMachinesAction,
  createDrawingBreakerMachineAction,
  updateDrawingBreakerMachineAction,
  deleteDrawingBreakerMachineAction,
  searchDrawingBreakerMachinesAction,
  getDrawingBreakerCountOptionsAction
} from '@/app/actions/drawing-breaker';
import { Plus, Trash2, PowerOff } from 'lucide-react';

export default function DrawingBreakerPage() {
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
    { label: 'Make', value: 'make_name' }
  ];

  // VB6 Grid columns: McNo, Description, Make, Count Name, Speed
  const columns = [
    { key: 'machine_no', label: 'McNo', width: '100px' },
    { key: 'description', label: 'Description', width: '150px' },
    { key: 'make_name', label: 'Make', width: '100px' },
    { key: 'mixing_display', label: 'Count Name', width: '120px' },
    { key: 'speed', label: 'Speed', width: '80px' }
  ];

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const [result, countRes] = await Promise.all([
        getDrawingBreakerMachinesAction(),
        getDrawingBreakerCountOptionsAction()
      ]);
      
      if (countRes?.success) {
        setCountOptions(countRes.data || []);
      }
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      const formattedData = (result.data || []).map(machine => ({
        ...machine,
        mixing_display: machine.prodn_mixing || '-'
      }));
      
      setMachines(formattedData);
    } catch (err) {
      console.error('Error loading drawing breaker machines:', err);
      toast.error('Failed to load drawing breaker machines: ' + err.message);
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
      const result = await searchDrawingBreakerMachinesAction(field, condition, value);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      const formattedData = result.data.map(machine => ({
        ...machine,
        mixing_display: machine.prodn_mixing || '-'
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
        await Promise.all(activeRows.map(row => updateDrawingBreakerMachineAction(row.id, { is_active: false })));
        toast.success(`${activeRows.length} machine(s) deactivated`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
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
        const result = await updateDrawingBreakerMachineAction(targetId, { is_active: false });
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

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      if (!confirm(`Permanently remove ${selectedRows.length} machine(s)?\n\nThis cannot be undone.`)) {
        return;
      }
      try {
        await Promise.all(selectedRows.map(row => deleteDrawingBreakerMachineAction(row.id)));
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
        const result = await deleteDrawingBreakerMachineAction(selectedRowId);
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
        result = await updateDrawingBreakerMachineAction(editingMachine.id, formData);
        if (!result.success) throw new Error(result.error);
        toast.success('Machine updated successfully');
      } else {
        result = await createDrawingBreakerMachineAction(formData);
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
          <h1 className="text-xl sm:text-2xl font-bold">Breaker Drawing Machine Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage draw frame breaker machine details</p>
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
        onShowAll={handleShowAll}
      />

      {/* Data Grid */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading drawing breaker machines...
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
        title="Draw Frame Breaker M/c Master"
        description={editingMachine ? "Modify machine make details" : "Add new machine make details"}
        onSave={() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingMachine(null);
        }}
        onDelete={editingMachine ? handleDelete : null}
        showDelete={editingMachine}
        deleteLabel="Remove Permanently"
        deleteIsDanger={true}
        onSecondaryAction={editingMachine?.is_active ? handleDeactivate : null}
        secondaryActionLabel="Deactivate"
        isLoading={isLoading}
        saveLabel={editingMachine ? "Update" : "Create"}
      >
        <DrawingBreakerForm
          initialData={editingMachine}
          onSubmit={handleSave}
          isLoading={isLoading}
          countOptions={countOptions}
        />
      </FormModal>
    </div>
  );
}
