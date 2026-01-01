'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import SupervisorForm from '@/components/modules/masters/SupervisorForm';
import {
  getSupervisors,
  createSupervisor,
  updateSupervisor,
  deleteSupervisor,
  searchSupervisors
} from '@/lib/supabase/supervisorQueries';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function SupervisorMaster() {
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);

  const searchFields = [{ label: 'Code', value: 'code' }, { label: 'Name', value: 'supervisor_name' }, { label: 'Department', value: 'department_name' }];

  const columns = [
    { key: 'code', label: 'Code', width: '100px' },
    { key: 'supervisor_name', label: 'Name', width: 'auto' },
    { key: 'department_name', label: 'Department', width: 'auto' }
  ];

  useEffect(() => {
    loadSupervisors();
  }, []);

  const loadSupervisors = async () => {
    try {
      setLoading(true);
      const data = await getSupervisors();
      
      const formattedData = data.map(supervisor => ({
        ...supervisor,
        department_name: supervisor.departments?.dept_name || '-'
      }));
      
      setSupervisors(formattedData);
      setError(null);
    } catch (err) {
      console.error('Error loading supervisors:', err);
      setError('Failed to load supervisors. Please check your database connection.');
      toast.error('Failed to load supervisors');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (field, condition, value) => {
    try {
      setLoading(true);
      const data = await searchSupervisors(field, condition, value);
      
      const formattedData = data.map(supervisor => ({
        ...supervisor,
        department_name: supervisor.departments?.dept_name || '-'
      }));
      
      setSupervisors(formattedData);
      toast.success(`Found ${data.length} supervisor(s)`);
    } catch (err) {
      console.error('Error searching supervisors:', err);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleShowAll = () => {
    loadSupervisors();
    toast.info('Showing all supervisors');
  };

  const handleRowClick = (supervisor) => {
    setSelectedSupervisor(supervisor);
  };

  const handleAdd = () => {
    setEditingSupervisor(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    if (!selectedSupervisor) {
      toast.error('Please select a supervisor to edit');
      return;
    }
    setEditingSupervisor(selectedSupervisor);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedSupervisor) {
      toast.error('Please select a supervisor to delete');
      return;
    }

    if (confirm(`Are you sure you want to delete supervisor "${selectedSupervisor.supervisor_name}"?`)) {
      try {
        await deleteSupervisor(selectedSupervisor.id);
        toast.success('Supervisor deleted successfully');
        setSelectedSupervisor(null);
        loadSupervisors();
      } catch (err) {
        console.error('Error deleting supervisor:', err);
        toast.error('Failed to delete supervisor');
      }
    }
  };

  const handleSave = async (supervisorData) => {
    try {
      if (isEditing && editingSupervisor) {
        await updateSupervisor(editingSupervisor.id, supervisorData);
        toast.success('Supervisor updated successfully');
      } else {
        await createSupervisor(supervisorData);
        toast.success('Supervisor created successfully');
      }
      setIsModalOpen(false);
      setIsEditing(false);
      setEditingSupervisor(null);
      setSelectedSupervisor(null);
      loadSupervisors();
    } catch (err) {
      console.error('Error saving supervisor:', err);
      toast.error(err.message || 'Failed to save supervisor');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700">
          <CardTitle className="text-white text-xl">Supervisor Master</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <SearchFilter
            fields={searchFields}
            onSearch={handleSearch}
            onShowAll={handleShowAll}
          />

          <div className="flex gap-2">
            <Button
              onClick={handleAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
            <Button
              onClick={handleEdit}
              variant="outline"
              disabled={!selectedSupervisor}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              onClick={handleDelete}
              variant="outline"
              disabled={!selectedSupervisor}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading supervisors...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              {error}
            </div>
          ) : supervisors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No supervisors found. Click "New" to add your first supervisor.
            </div>
          ) : (
            <DataGrid
              columns={columns}
              data={supervisors}
              onRowClick={handleRowClick}
              selectedRow={selectedSupervisor}
              onContextMenu={(row, e) => {
                e.preventDefault();
                setSelectedSupervisor(row);
                setEditingSupervisor(row);
                setIsEditing(true);
                setIsModalOpen(true);
              }}
            />
          )}

          {!loading && !error && (
            <div className="text-sm text-muted-foreground">
              Total Supervisors: {supervisors.length}
            </div>
          )}
        </CardContent>
      </Card>

      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Supervisor Master"
        description={isEditing ? 'To Add, Modify, Supervisor details.' : 'Add a new supervisor to the system'}
        onSave={() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }}
        onCancel={() => {
          setIsModalOpen(false);
          setIsEditing(false);
          setEditingSupervisor(null);
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        isLoading={loading}
        saveLabel={isEditing ? 'Update' : 'Save'}
      >
        <SupervisorForm
          initialData={editingSupervisor}
          onSubmit={handleSave}
          isLoading={loading}
        />
      </FormModal>
    </div>
  );
}
