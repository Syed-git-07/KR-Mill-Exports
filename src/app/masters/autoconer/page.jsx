'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import AutoconerForm from '@/components/modules/masters/AutoconerForm';
import {
  getAutoconerMachines,
  createAutoconerMachine,
  updateAutoconerMachine,
  deleteAutoconerMachine,
  searchAutoconerMachines
} from '@/lib/supabase/autoconerQueries';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function AutoconerMaster() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const searchFields = ['machine_no', 'description', 'make_name', 'act_effi', 'is_active'];
  const searchConditions = ['Like', 'Equal', 'Not Equal', 'Greater', 'Less'];

  // Grid columns matching VB6 app: M/c No., Description, Make Name, ActEffi
  const columns = [
    { key: 'machine_no', label: 'M/c No.' },
    { key: 'description', label: 'Description' },
    { key: 'make_name', label: 'Make Name' },
    { key: 'act_effi', label: 'ActEffi' }
  ];

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const data = await getAutoconerMachines();
      
      const formattedData = data.map(machine => ({
        ...machine,
        act_effi: machine.act_effi || 0
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
      const data = await searchAutoconerMachines(field, condition, value);
      
      const formattedData = data.map(machine => ({
        ...machine,
        act_effi: machine.act_effi || 0
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
      speed: machine.speed || null,
      count: machine.count || '',
      installed_date: machine.installed_date || null,
      direct_prod_entry: machine.direct_prod_entry || false
    };
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
        speed: machineToEdit.speed || null,
        count: machineToEdit.count || '',
        installed_date: machineToEdit.installed_date || null,
        direct_prod_entry: machineToEdit.direct_prod_entry || false
      };
      setEditingMachine(editData);
      setIsModalOpen(true);
    }
  };

  const handleDelete = async () => {
    // Get ID from either selectedRowId or editingMachine
    const idToDelete = selectedRowId || editingMachine?.id;
    
    if (!idToDelete) {
      toast.warning('Please select a machine to delete');
      return;
    }

    const machineName = editingMachine?.machine_no || machines.find(m => m.id === idToDelete)?.machine_no || 'this machine';

    if (confirm(`Are you sure you want to delete "${machineName}"?`)) {
      try {
        await deleteAutoconerMachine(idToDelete);
        toast.success('Machine deleted successfully');
        setSelectedRowId(null);
        setEditingMachine(null);
        setIsModalOpen(false);
        loadMachines();
      } catch (err) {
        console.error('Error deleting machine:', err);
        toast.error('Failed to delete machine');
      }
    }
  };

  const handleSave = async (machineData) => {
    try {
      if (editingMachine) {
        await updateAutoconerMachine(editingMachine.id, machineData);
        toast.success('Machine updated successfully');
      } else {
        await createAutoconerMachine(machineData);
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
    <div className="container mx-auto p-6 space-y-4">
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700">
          <CardTitle className="text-white text-xl">Autoconer Machine Master</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <SearchFilter
            fields={searchFields}
            conditions={searchConditions}
            onSearch={handleSearch}
            onReset={handleReset}
          />

          <div className="flex gap-2">
            <Button
              onClick={handleNew}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
            <Button
              onClick={handleEdit}
              variant="outline"
              disabled={!selectedRowId}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              onClick={handleDelete}
              variant="outline"
              disabled={!selectedRowId}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>

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
              selectedRowId={selectedRowId}
              onRowDoubleClick={handleRowDoubleClick}
              onContextMenu={(row, e) => {
                e.preventDefault();
                handleRowDoubleClick(row);
              }}
            />
          )}

          {!loading && !error && (
            <div className="text-sm text-muted-foreground">
              Total Machines: {machines.length}
            </div>
          )}
        </CardContent>
      </Card>

      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingMachine(null);
        }}
        title="AutoConer Machine Master"
        description={editingMachine ? 'Update machine details' : 'Add a new autoconer machine to the system'}
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
        showDelete={!!editingMachine}
        saveLabel={editingMachine ? 'Save' : 'Create'}
      >
        <AutoconerForm
          initialData={editingMachine}
          onSubmit={handleSave}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingMachine(null);
          }}
        />
      </FormModal>
    </div>
  );
}
