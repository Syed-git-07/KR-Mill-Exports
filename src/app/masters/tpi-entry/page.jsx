'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import TPIEntryForm from '@/components/modules/masters/TPIEntryForm';
import {
  getTPIEntriesAction,
  createTPIEntryAction,
  updateTPIEntryAction,
  deleteTPIEntryAction,
  searchTPIEntriesAction
} from '@/app/actions/tpi-entry';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { assertAllActionsSucceeded } from '@/lib/actionResult';
import { useLatestRows } from '@/hooks/useLatestRows';

export default function TPIEntryMaster() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { getCurrentRow, getCurrentRows, openRowEditor, resetInteractionState, runLatestRowsRequest } = useLatestRows({
    rows: entries, setRows: setEntries,
    selectedItem: selectedRow, setSelectedItem: setSelectedRow,
    selectedRows, setSelectedRows,
    setIsSelectMode,
    editingItem: editingEntry, setEditingItem: setEditingEntry,
    setIsEditing,
    setIsModalOpen
  });

  // VB6 search: id field with = condition
  const searchFields = [
    { label: 'ID', value: 'entry_id' },
    { label: 'Entry Date', value: 'entry_date' },
    { label: 'TPI Value', value: 'tpi_value' }
  ];

  // VB6 Grid columns: id, sdate, countname, TPI
  const columns = [
    { key: 'entry_id', label: 'id' },
    { key: 'sdate', label: 'sdate' },
    { key: 'countname', label: 'countname' },
    { key: 'tpi_display', label: 'TPI' },
  ];

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    await runLatestRowsRequest(
      () => getTPIEntriesAction(),
      {
        onStart: () => setLoading(true),
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows((result.data || []).map(entry => ({
            ...entry,
            entry_id: entry.entry_id || entry.id,
            sdate: format(new Date(entry.entry_date), 'dd-MMM-yy'),
            countname: entry.spinning_counts?.count_name || 'N/A',
            tpi_display: entry.tpi_value ? Number(entry.tpi_value).toFixed(2) : '0.00',
          })));
        },
        onError: err => {
          console.error('Error loading TPI entries:', err);
          toast.error('Failed to load TPI entries: ' + err.message);
        },
        onFinally: () => setLoading(false)
      }
    );
  };

  const handleSearch = async (field, condition, value) => {
    if (!value.trim()) {
      loadEntries();
      return;
    }
    
    await runLatestRowsRequest(
      () => searchTPIEntriesAction(field, condition, value),
      {
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows((result.data || []).map(entry => ({
            ...entry,
            entry_id: entry.entry_id || entry.id,
            sdate: format(new Date(entry.entry_date), 'dd-MMM-yy'),
            countname: entry.spinning_counts?.count_name || 'N/A',
            tpi_display: entry.tpi_value ? Number(entry.tpi_value).toFixed(2) : '0.00',
          })));
          toast.success(`Found ${(result.data || []).length} result(s)`);
        },
        onError: err => {
          console.error('Search error:', err);
          toast.error('Search failed: ' + err.message);
        }
      }
    );
  };

  const handleShowAll = () => {
    loadEntries();
  };

  const handleRowClick = (entry) => {
    if (isSelectMode) return;
    setSelectedRow(entry);
  };

  const handleAdd = () => {
    resetInteractionState();
    setEditingEntry(null);
    setSelectedRow(null);
    setSelectedRows([]);
    setIsSelectMode(false);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditForm = (entry) => {
    if (isSelectMode) return;
    const currentEntry = getCurrentRow(entry);
    if (!currentEntry) return;
    const editData = {
      ...currentEntry,
      tpi_value: parseFloat(currentEntry.tpi_display),
    };

    openRowEditor(currentEntry, { editingItem: editData });
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
    const nextSelectMode = !isSelectMode;
    resetInteractionState({ closeModal: true });
    setIsSelectMode(nextSelectMode);
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      const currentSelectedRows = getCurrentRows(selectedRows);
      if (!currentSelectedRows.length) return toast.warning('The selected TPI entries are no longer in the current list');
      if (!confirm(`Are you sure you want to delete ${currentSelectedRows.length} entry(ies)?`)) {
        return;
      }

      try {
        const results = await Promise.all(currentSelectedRows.map(row => deleteTPIEntryAction(row.id)));
        assertAllActionsSucceeded(results, 'Failed to delete one or more TPI entries');
        toast.success(`${currentSelectedRows.length} entry(ies) deleted successfully`);
        resetInteractionState({ closeModal: true });
        setSelectedRows([]);
        setIsSelectMode(false);
      } catch (error) {
        toast.error('Failed to delete entries: ' + error.message);
      } finally {
        loadEntries();
      }
    } else if (!isSelectMode && selectedRow) {
      // Single delete from modal
      const currentEntry = getCurrentRow(selectedRow);
      if (!currentEntry) return toast.warning('The selected TPI entry is no longer in the current list');
      if (!confirm(`Are you sure you want to delete this TPI entry?`)) {
        return;
      }

      try {
        const result = await deleteTPIEntryAction(currentEntry.id);
        if (result.success) {
          toast.success('Entry deleted successfully');
          resetInteractionState({ closeModal: true });
          setSelectedRow(null);
          setIsModalOpen(false);
          loadEntries();
        } else {
          toast.error('Failed to delete entry: ' + result.error);
        }
      } catch (error) {
        toast.error('Failed to delete entry: ' + error.message);
      }
    } else {
      toast.error('Please select entry(ies) to delete');
    }
  };

  const handleSave = async (formData) => {
    setIsLoading(true);
    try {
      if (isEditing && editingEntry) {
        const currentEntry = getCurrentRow(editingEntry);
        if (!currentEntry) throw new Error('This TPI entry is no longer in the current list');
        const result = await updateTPIEntryAction(currentEntry.id, formData);
        if (result.success) {
          toast.success('Entry updated successfully');
        } else {
          toast.error('Failed to update entry: ' + result.error);
          return;
        }
      } else {
        const result = await createTPIEntryAction(formData);
        if (result.success) {
          toast.success('Entry created successfully');
        } else {
          toast.error('Failed to create entry: ' + result.error);
          return;
        }
      }
      resetInteractionState({ closeModal: true });
      setIsModalOpen(false);
      setEditingEntry(null);
      setSelectedRow(null);
      loadEntries();
    } catch (err) {
      console.error('Error saving entry:', err);
      toast.error(err.message || 'Failed to save entry');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">TPI Entry Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Twist Per Inch data entry and tracking</p>
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
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedRow}
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
          Loading TPI entries...
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No entries found. Click "Add New" to add your first entry.
        </div>
      ) : (
        <DataGrid
          columns={columns}
          data={entries}
          onRowClick={handleRowClick}
          selectedRow={selectedRow}
          showCheckbox={isSelectMode}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
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
          <span>Total Records: {entries.length}</span>
          {selectedRow && (
            <span>Selected: {selectedRow.sdate} - {selectedRow.countname}</span>
          )}
        </div>
      )}

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingEntry(null);
            setIsEditing(false);
          }
        }}
        title="TPI Entry Master"
        description={isEditing ? "Update TPI entry details" : "Add a new TPI entry"}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingEntry(null);
          setIsEditing(false);
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        isLoading={isLoading}
        saveLabel={isEditing ? "Update" : "Create"}
      >
        <TPIEntryForm
          initialData={editingEntry}
          onSubmit={handleSave}
          isLoading={isLoading}
        />
      </FormModal>
    </div>
  );
}
