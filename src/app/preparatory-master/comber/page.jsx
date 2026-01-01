'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import ComberMachineForm from '@/components/modules/preparatory-master/ComberMachineForm';
import {
  getComberMachines,
  createComberMachine,
  updateComberMachine,
  deleteComberMachine,
  searchComberMachines
} from '@/lib/supabase/comberMachineQueries';
import { Plus, Trash2 } from 'lucide-react';

export default function ComberMachinePage() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // VB6 search fields: McNo
  const searchFields = [
    { label: 'McNo', value: 'machine_no' },
    { label: 'Description', value: 'description' },
    { label: 'Make', value: 'make_name' },
    { label: 'Mixing', value: 'prodn_mixing' }
  ];

  // VB6 Grid columns: McNo, Mixing Name, Description, Make, Speed, McEffi
  const columns = [
    { key: 'machine_no', label: 'McNo', width: '80px' },
    { key: 'prodn_mixing', label: 'Mixing Name', width: '150px' },
    { key: 'description', label: 'Description', width: '120px' },
    { key: 'make_name', label: 'Make', width: '80px' },
    { key: 'speed', label: 'Speed', width: '70px' },
    { key: 'mc_effi', label: 'McEffi', width: '70px' }  // NEW: Machine Efficiency column
  ];

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const data = await getComberMachines();
      
      // Format data for display
      const formattedData = data.map(machine => ({
        ...machine,
        prodn_mixing: machine.prodn_mixing || '-',
        make_name: machine.make_name || '-',
        speed: machine.speed || 0,
        mc_effi: machine.mc_effi || 0
      }));
      
      setMachines(formattedData);
    } catch (err) {
      console.error('Error loading comber machines:', err);
      toast.error('Failed to load comber machines: ' + err.message);
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
      const data = await searchComberMachines(field, condition, value);
      
      const formattedData = data.map(machine => ({
        ...machine,
        prodn_mixing: machine.prodn_mixing || '-',
        make_name: machine.make_name || '-',
        speed: machine.speed || 0,
        mc_effi: machine.mc_effi || 0
      }));
      
      setMachines(formattedData);
      toast.success(`Found ${data.length} result(s)`);
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
      // Bulk delete
      if (!confirm(`Are you sure you want to delete ${selectedRows.length} machine(s)?`)) {
        return;
      }

      try {
        await Promise.all(selectedRows.map(row => deleteComberMachine(row.id)));
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
        await deleteComberMachine(selectedMachine.id);
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
      if (isEditing && selectedMachine) {
        await updateComberMachine(selectedMachine.id, formData);
        toast.success('Machine updated successfully');
      } else {
        await createComberMachine(formData);
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
          <h1 className="text-xl sm:text-2xl font-bold">Comber Machine Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage comber machine details</p>
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
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedMachine}
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Delete</span>
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
          Loading comber machines...
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
          {selectedMachine && (
            <span>Selected: {selectedMachine.machine_no} - {selectedMachine.description}</span>
          )}
        </div>
      )}

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Comber M/c Master"
        description={isEditing ? "Modify comber machine details" : "Add new comber machine details"}
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
        isLoading={isLoading}
        saveLabel={isEditing ? "Update" : "Create"}
      >
        <ComberMachineForm
          initialData={isEditing ? selectedMachine : null}
          onSubmit={handleSave}
          isLoading={isLoading}
        />
      </FormModal>
    </div>
  );
}
