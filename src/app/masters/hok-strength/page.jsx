'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DataGrid from '@/components/common/DataGrid';
import HOKStrengthForm from '@/components/modules/masters/HOKStrengthForm';
import {
  getHOKEntries,
  createBulkHOKEntries,
  updateHOKEntry,
  deleteHOKEntry,
  searchHOKEntries,
} from '@/lib/supabase/hokStrengthQueries';

export default function HOKStrengthPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchField, setSearchField] = useState('hok_id');
  const [searchOperator, setSearchOperator] = useState('Equal');
  const [searchValue, setSearchValue] = useState('');

  const columns = [
    { key: 'hok_id', label: 'id' },
    { 
      key: 'date', 
      label: 'date',
      render: (value) => format(new Date(value), 'dd-MMM-yy')
    }
  ];

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await getHOKEntries();
      setEntries(data);
    } catch (error) {
      toast.error('Failed to load HOK Strength entries');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      loadEntries();
      return;
    }

    try {
      const results = await searchHOKEntries({
        field: searchField,
        operator: searchOperator,
        value: searchValue,
      });
      setEntries(results);
      toast.success(`Found ${results.length} entries`);
    } catch (error) {
      toast.error('Search failed');
      console.error(error);
    }
  };

  const handleShowAll = () => {
    setSearchValue('');
    loadEntries();
    toast.success('Showing all entries');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCreate = () => {
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleDelete = async (entry) => {
    if (!confirm(`Delete HOK entry for ${format(new Date(entry.date), 'dd/MM/yyyy')}?`)) return;

    try {
      await deleteHOKEntry(entry.hok_id);
      toast.success('Entry deleted successfully');
      loadEntries();
    } catch (error) {
      toast.error('Failed to delete entry');
      console.error(error);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingEntry) {
        // Update existing entry
        await updateHOKEntry(editingEntry.hok_id, formData);
        toast.success('HOK Strength entry updated successfully');
      } else {
        // Create new entry
        await createBulkHOKEntries(formData);
        toast.success('HOK Strength entry created successfully');
      }
      setDialogOpen(false);
      setEditingEntry(null);
      loadEntries();
    } catch (error) {
      toast.error(editingEntry ? 'Failed to update entry' : 'Failed to create entry');
      console.error(error);
    }
  };

  const handleDialogClose = (open) => {
    setDialogOpen(open);
    if (!open) {
      // Reset state when dialog closes
      setEditingEntry(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">HOK Strength Master</h1>
          <p className="text-gray-600 mt-1">Manage HOK values by department and shift</p>
        </div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          New Entry
        </Button>
      </div>

      {/* Search Section */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <h2 className="font-semibold text-lg">Search Entries</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Field</Label>
            <Select value={searchField} onValueChange={setSearchField}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hok_id">id</SelectItem>
                <SelectItem value="date">date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Operator</Label>
            <Select value={searchOperator} onValueChange={setSearchOperator}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Equal">Equal</SelectItem>
                <SelectItem value="Not Equal">Not Equal</SelectItem>
                <SelectItem value="Greater">Greater Than</SelectItem>
                <SelectItem value="Less">Less Than</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Value</Label>
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search value..."
            />
          </div>

          <div className="space-y-2">
            <Label className="invisible">Action</Label>
            <div className="flex gap-2">
              <Button onClick={handleSearch} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
              <Button onClick={handleShowAll} variant="outline" className="flex-1">
                Show All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid
        columns={columns}
        data={entries}
        loading={loading}
        onContextMenu={(row, e) => {
          e.preventDefault();
          handleEdit(row);
        }}
        emptyMessage="No HOK Strength entries found. Click 'New Entry' to create one."
      />

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'To Modify the HOK Strength Head' : 'HOK Strength Head'}
            </DialogTitle>
          </DialogHeader>
          <HOKStrengthForm 
            initialData={editingEntry} 
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false);
              setEditingEntry(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
