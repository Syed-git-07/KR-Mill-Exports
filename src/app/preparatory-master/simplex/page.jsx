'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import SimplexMachineForm from '@/components/modules/preparatory-master/SimplexMachineForm';
import {
  getSimplexMachinesAction,
  createSimplexMachineAction,
  updateSimplexMachineAction,
  deleteSimplexMachineAction,
  searchSimplexMachinesAction,
  getSimplexCountOptionsAction
} from '@/app/actions/simplex-machine';
import { Plus, Trash2, PowerOff } from 'lucide-react';

export default function SimplexMachinePage() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [countOptions, setCountOptions] = useState([]);

  // VB6 search fields: Mcno
  const searchFields = [
    { label: 'McNo', value: 'machine_no' },
    { label: 'Description', value: 'description' },
    { label: 'Make', value: 'make_name' },
    { label: 'Mixing', value: 'prodn_mixing' }
  ];

  // VB6 Grid columns: McNo, Mixing Name, Description, Make, Speed, MCEffi, TPI, NoofSpl (8 columns!)
  const columns = [
    { key: 'machine_no', label: 'McNo', width: '60px' },
    { key: 'prodn_mixing', label: 'Mixing Name', width: '130px' },
    { key: 'description', label: 'Description', width: '100px' },
    { key: 'make_name', label: 'Make', width: '60px' },
    { key: 'speed', label: 'Speed', width: '60px' },
    { key: 'prodn_efficiency', label: 'Stf Effi', width: '70px' },
    { key: 'tpi', label: 'TPI', width: '50px' },
    { key: 'no_of_spindles', label: 'NoofSpl', width: '70px' }
  ];

  useEffect(() => {
    loadMachines();
    loadCountOptions();
  }, []);

  const loadCountOptions = async () => {
    try {
      const result = await getSimplexCountOptionsAction();
      if (result.success) {
        setCountOptions(result.data || []);
      }
    } catch (err) {
      console.error('Error loading simplex count options:', err);
    }
  };

  const loadMachines = async () => {
    try {
      setLoading(true);
      const result = await getSimplexMachinesAction();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Format data for display
      const formattedData = result.data.map(machine => ({
        ...machine,
        prodn_mixing: machine.prodn_mixing || '-',
        make_name: machine.make_name || '-',
        speed: machine.speed || 0,
        prodn_efficiency: machine.prodn_efficiency || 0,
        tpi: machine.tpi || 0,
        no_of_spindles: machine.no_of_spindles || 0
      }));
      
      setMachines(formattedData);
    } catch (err) {
      console.error('Error loading simplex machines:', err);
      toast.error('Failed to load simplex machines: ' + err.message);
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
      const result = await searchSimplexMachinesAction(field, condition, value);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      const formattedData = result.data.map(machine => ({
        ...machine,
        prodn_mixing: machine.prodn_mixing || '-',
        make_name: machine.make_name || '-',
        speed: machine.speed || 0,
        prodn_efficiency: machine.prodn_efficiency || 0,
        tpi: machine.tpi || 0,
        no_of_spindles: machine.no_of_spindles || 0
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

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk permanent delete
      if (!confirm(`Permanently remove ${selectedRows.length} machine(s)?\n\nThis cannot be undone.`)) {
        return;
      }

      try {
        await Promise.all(selectedRows.map(row => deleteSimplexMachineAction(row.id)));
        toast.success(`${selectedRows.length} machine(s) permanently removed`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to remove machines: ' + error.message);
      }
    } else if (!isSelectMode && selectedMachine) {
      // Single permanent delete
      if (!confirm(`Permanently remove machine "${selectedMachine.machine_no}"?\n\nThis cannot be undone.`)) {
        return;
      }

      try {
        const result = await deleteSimplexMachineAction(selectedMachine.id);
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Machine permanently removed');
        setSelectedMachine(null);
        setIsModalOpen(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to remove machine: ' + error.message);
      }
    } else {
      toast.error('Please select machine(s) to remove');
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
        await Promise.all(activeRows.map(row => updateSimplexMachineAction(row.id, { is_active: false })));
        toast.success(`${activeRows.length} machine(s) deactivated`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to deactivate: ' + error.message);
      }
    } else {
      if (!selectedMachine) {
        toast.warning('Please select a machine to deactivate');
        return;
      }

      if (!selectedMachine.is_active) {
        toast.info('Machine is already inactive');
        return;
      }

      if (!confirm(`Deactivate machine "${selectedMachine.machine_no}"?\n\nIt will be hidden from new production entries.`)) return;

      try {
        const result = await updateSimplexMachineAction(selectedMachine.id, { is_active: false });
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Machine deactivated');
        setIsModalOpen(false);
        setSelectedMachine(null);
        loadMachines();
      } catch (error) {
        toast.error('Failed to deactivate: ' + error.message);
      }
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
        result = await updateSimplexMachineAction(selectedMachine.id, formData);
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Machine updated successfully');
      } else {
        result = await createSimplexMachineAction(formData);
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
          <h1 className="text-xl sm:text-2xl font-bold">Simplex Machine Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage simplex/speed frame machine details</p>
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
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
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
          Loading simplex machines...
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
          {selectedMachine && (
            <span>Selected: {selectedMachine.machine_no} - {selectedMachine.description}</span>
          )}
        </div>
      )}

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Simplex M/c Master"
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
        <SimplexMachineForm
          initialData={isEditing ? selectedMachine : null}
          onSubmit={handleSave}
          isLoading={isLoading}
          countOptions={countOptions}
        />
      </FormModal>
    </div>
  );
}
