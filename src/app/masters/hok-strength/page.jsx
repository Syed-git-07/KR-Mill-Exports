'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import HOKStrengthForm from '@/components/modules/masters/HOKStrengthForm';
import {
  getHOKEntriesAction,
  createBulkHOKEntriesAction,
  updateHOKEntryAction,
  deleteHOKEntryAction,
  searchHOKEntriesAction,
} from '@/app/actions/hok-strength';

export default function HOKStrengthPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const searchFields = ['hok_id', 'date'];

  const columns = [
    { key: 'hok_id', label: 'ID', width: '100px' },
    { key: 'formatted_date', label: 'Date', width: 'auto' }
  ];

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const result = await getHOKEntriesAction();
      
      if (!result.success) {
        toast.error(result.error || 'Failed to load HOK Strength entries');
        return;
      }
      
      // Format date for display and add id for DataGrid compatibility
      const formattedData = result.data.map(entry => ({
        ...entry,
        id: entry.hok_id, // Add id for DataGrid row selection
        formatted_date: format(new Date(entry.date), 'dd-MMM-yyyy')
      }));
      setEntries(formattedData);
    } catch (error) {
      toast.error('Failed to load HOK Strength entries');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (field, condition, value) => {
    if (!value || !value.trim()) {
      loadEntries();
      return;
    }

    try {
      const result = await searchHOKEntriesAction({
        field: field,
        operator: condition,
        value: value,
      });
      
      if (!result.success) {
        toast.error(result.error || 'Search failed');
        return;
      }
      
      const formattedData = result.data.map(entry => ({
        ...entry,
        id: entry.hok_id, // Add id for DataGrid row selection
        formatted_date: format(new Date(entry.date), 'dd-MMM-yyyy')
      }));
      setEntries(formattedData);
      toast.success(`Found ${result.data.length} entries`);
    } catch (error) {
      toast.error('Search failed');
      console.error(error);
    }
  };

  const handleShowAll = () => {
    loadEntries();
    toast.success('Showing all entries');
  };

  const handleRowClick = (entry) => {
    setSelectedEntry(entry);
  };

  const handleCreate = () => {
    setEditingEntry(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      if (!confirm(`Delete ${selectedRows.length} HOK entries?`)) return;
      try {
        const results = await Promise.all(selectedRows.map(row => deleteHOKEntryAction(row.hok_id)));
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          toast.error(`Failed to delete ${failed.length} entry(ies)`);
        } else {
          toast.success(`${selectedRows.length} entries deleted successfully`);
        }
        setSelectedRows([]);
        setIsSelectMode(false);
        loadEntries();
      } catch (error) {
        toast.error('Failed to delete entries');
        console.error(error);
      }
    } else if (!isSelectMode && selectedEntry) {
      if (!confirm(`Delete HOK entry for ${selectedEntry.formatted_date}?`)) return;
      try {
        const result = await deleteHOKEntryAction(selectedEntry.hok_id);
        if (!result.success) {
          toast.error(result.error || 'Failed to delete entry');
          return;
        }
        toast.success('Entry deleted successfully');
        setSelectedEntry(null);
        loadEntries();
      } catch (error) {
        toast.error('Failed to delete entry');
        console.error(error);
      }
    } else {
      toast.error('Please select entry(s) to delete');
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
      setSelectedRows([...entries]);
    } else {
      setSelectedRows([]);
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedRows([]);
  };

  const handleSubmit = async (formData) => {
    try {
      let result;
      if (isEditing && editingEntry) {
        result = await updateHOKEntryAction(editingEntry.hok_id, formData);
      } else {
        result = await createBulkHOKEntriesAction(formData);
      }
      
      if (!result.success) {
        toast.error(result.error || (isEditing ? 'Failed to update entry' : 'Failed to create entry'));
        return;
      }
      
      toast.success(isEditing ? 'HOK Strength entry updated successfully' : 'HOK Strength entry created successfully');
      setIsModalOpen(false);
      setEditingEntry(null);
      setIsEditing(false);
      loadEntries();
    } catch (error) {
      toast.error(isEditing ? 'Failed to update entry' : 'Failed to create entry');
      console.error(error);
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">HOK Strength Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage HOK values by department and shift</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">New Entry</span>
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
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedEntry}
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
        <div className="text-center py-8 text-muted-foreground">Loading entries...</div>
      ) : (
        <DataGrid
          columns={columns}
          data={entries}
          onRowClick={handleRowClick}
          selectedRow={selectedEntry}
          showCheckbox={isSelectMode}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          onContextMenu={(row, e) => {
            e.preventDefault();
            setSelectedEntry(row);
            setEditingEntry(row);
            setIsEditing(true);
            setIsModalOpen(true);
          }}
        />
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total Records: {entries.length}</span>
      </div>

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="HOK Strength Master"
        description={isEditing ? 'To Modify the HOK Strength Head' : 'Add new HOK Strength entry'}
        onSave={() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingEntry(null);
          setIsEditing(false);
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        saveLabel={isEditing ? 'Update' : 'Save'}
      >
        <HOKStrengthForm
          initialData={editingEntry}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingEntry(null);
            setIsEditing(false);
          }}
        />
      </FormModal>
    </div>
  );
}
