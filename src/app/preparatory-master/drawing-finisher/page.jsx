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
    getSpinningCountOptionsAction().then(r => { if (r.success) setCountOptions(r.data); });
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const result = await getDrawingFinisherMachinesAction();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Format data for display
      const formattedData = result.data.map(machine => ({
        ...machine,
        prodn_mixing: machine.prodn_mixing || '-',
        make_name: machine.make_name || '-',
        speed: machine.speed || 0
      }));
      
      setMachines(formattedData);
    } catch (err) {
      console.error('Error loading drawing finisher machines:', err);
      toast.error('Failed to load drawing finisher machines: ' + err.message);
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
      const result = await searchDrawingFinisherMachinesAction(field, condition, value);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      const formattedData = result.data.map(machine => ({
        ...machine,
        prodn_mixing: machine.prodn_mixing || '-',
        make_name: machine.make_name || '-',
        speed: machine.speed || 0
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
    setSelectedMachine(machine);
  };

  const handleAdd = () => {
    setSelectedMachine(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    if (!selectedMachine) {
      toast.error('Please select a machine to edit');
      return;
    }
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeactivate = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      const activeRows = selectedRows.filter(r => r.is_active);
      if (activeRows.length === 0) {
        toast.info('All selected machines are already inactive');
        return;
      }

      if (!confirm(`Deactivate ${activeRows.length} machine(s)?\n\nThey will be hidden from new production entries.`)) {
        return;
      }

      try {
        await Promise.all(activeRows.map(row => updateDrawingFinisherMachineAction(row.id, { is_active: false })));
        toast.success(`${activeRows.length} machine(s) deactivated`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to deactivate: ' + error.message);
      }
    } else {
      const targetMachine = selectedMachine;
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
      if (!confirm(`Are you sure you want to delete ${selectedRows.length} machine(s)?`)) {
        return;
      }

      try {
        await Promise.all(selectedRows.map(row => deleteDrawingFinisherMachineAction(row.id)));
        toast.success(`${selectedRows.length} machine(s) deleted successfully`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to delete machines: ' + error.message);
      }
    } else if (!isSelectMode && selectedMachine) {
      // Single delete from modal
      if (!confirm(`Are you sure you want to delete "${selectedMachine.machine_no}"?`)) {
        return;
      }

      try {
        const result = await deleteDrawingFinisherMachineAction(selectedMachine.id);
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Machine deleted successfully');
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
    setIsSelectMode(!isSelectMode);
    setSelectedRows([]);
  };

  const handleSave = async (formData) => {
    setIsLoading(true);
    try {
      let result;
      if (isEditing && selectedMachine) {
        result = await updateDrawingFinisherMachineAction(selectedMachine.id, formData);
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
            setSelectedMachine(row);
            setIsEditing(true);
            setIsModalOpen(true);
          }}
          onContextMenu={(row, e) => {
            e.preventDefault();
            setSelectedMachine(row);
            setIsEditing(true);
            setIsModalOpen(true);
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
        title="Draw Frame Finisher M/c Master"
        description={isEditing ? "Modify machine make details" : "Add new machine make details"}
        onSave={() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }}
        onCancel={() => {
          setIsModalOpen(false);
          setSelectedMachine(null);
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
