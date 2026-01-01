'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import SpinningMachineForm from '@/components/modules/masters/SpinningMachineForm';
import {
  getSpinningMachines,
  createSpinningMachine,
  updateSpinningMachine,
  deleteSpinningMachine,
  searchSpinningMachines
} from '@/lib/supabase/spinningMachineQueries';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function SpinningMachineMaster() {
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
      const data = await getSpinningMachines();
      
      // Format data for display - keep only fields shown in table
      const formattedData = data.map(machine => ({
        ...machine,
        remarks: machine.remarks || '-'
      }));
      
      setMachines(formattedData);
      setError(null);
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
      const data = await searchSpinningMachines(field, condition, value);
      
      const formattedData = data.map(machine => ({
        ...machine,
        remarks: machine.remarks || '-'
      }));
      
      setMachines(formattedData);
      toast.success(`Found ${data.length} machine(s)`);
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
      // Convert display values back to actual values for editing
      const editData = {
        ...machineToEdit,
        auto_doffing: machineToEdit.auto_doffing === 'Yes',
        spindle_gauge: machineToEdit.spindle_gauge !== '-' ? parseFloat(machineToEdit.spindle_gauge) : null,
        ring_dia: machineToEdit.ring_dia !== '-' ? parseFloat(machineToEdit.ring_dia) : null,
        traveller: machineToEdit.traveller !== '-' ? machineToEdit.traveller : '',
        total_doffs: machineToEdit.total_doffs !== '-' ? parseInt(machineToEdit.total_doffs) : null,
        total_spindles: machineToEdit.total_spindles !== '-' ? parseInt(machineToEdit.total_spindles) : null,
        remarks: machineToEdit.remarks !== '-' ? machineToEdit.remarks : ''
      };
      setEditingMachine(editData);
      setIsModalOpen(true);
    }
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      if (!confirm(`Are you sure you want to delete ${selectedRows.length} machine(s)?`)) {
        return;
      }

      try {
        await Promise.all(selectedRows.map(row => deleteSpinningMachine(row.id)));
        toast.success(`${selectedRows.length} machine(s) deleted successfully`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadMachines();
      } catch (error) {
        toast.error('Failed to delete machines: ' + error.message);
      }
    } else if (!isSelectMode && selectedRowId) {
      // Single delete from modal
      if (!confirm('Are you sure you want to delete this machine?')) {
        return;
      }

      try {
        await deleteSpinningMachine(selectedRowId);
        toast.success('Machine deleted successfully');
        setSelectedRowId(null);
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

  const handleSave = async (machineData) => {
    try {
      if (editingMachine) {
        await updateSpinningMachine(editingMachine.id, machineData);
        toast.success('Machine updated successfully');
      } else {
        await createSpinningMachine(machineData);
        toast.success('Machine created successfully');
      }
      setIsModalOpen(false);
      setEditingMachine(null);
      loadMachines();
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
        <div className="flex flex-wrap gap-2">
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
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedRowId}
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
          onContextMenu={(row, e) => {
            e.preventDefault();
            // Pass data directly for editing (all fields are already in correct format)
            const editData = {
              ...row,
              remarks: row.remarks !== '-' ? row.remarks : ''
            };
            setEditingMachine(editData);
            setSelectedRowId(row.id);
            setIsModalOpen(true);
          }}
        />
      )}

      {/* Stats */}
      {!loading && !error && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total Records: {machines.length}</span>
          {selectedRowId && (
            <span>Selected: {machines.find(m => m.id === selectedRowId)?.machine_name}</span>
          )}
        </div>
      )}

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Spinning Machine Master"
        description={editingMachine ? "Modify machine details" : "Add new machine"}
        onSave={() => {
          const form = document.querySelector('form')
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
          }
        }}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingMachine(null)
        }}
        onDelete={editingMachine ? handleDelete : null}
        showDelete={editingMachine}
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
