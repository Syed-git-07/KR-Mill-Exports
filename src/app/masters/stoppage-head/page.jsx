'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SearchFilter from '@/components/common/SearchFilter';
import DataGrid from '@/components/common/DataGrid';
import FormModal from '@/components/common/FormModal';
import StoppageHeadForm from '@/components/modules/masters/StoppageHeadForm';
import {
  getStoppageHeadsAction,
  createStoppageHeadAction,
  updateStoppageHeadAction,
  deleteStoppageHeadAction,
  searchStoppageHeadsAction
} from '@/app/actions/stoppage-head';
import { Plus, Trash2, Ban } from 'lucide-react';
import { assertAllActionsSucceeded } from '@/lib/actionResult';
import { useLatestRows } from '@/hooks/useLatestRows';

export default function StoppageHeadMaster() {
  const [stoppageHeads, setStoppageHeads] = useState([]);
  const [selectedStoppageHead, setSelectedStoppageHead] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { getCurrentRow, getCurrentRows, openRowEditor, resetInteractionState, runLatestRowsRequest } = useLatestRows({
    rows: stoppageHeads, setRows: setStoppageHeads,
    selectedItem: selectedStoppageHead, setSelectedItem: setSelectedStoppageHead,
    selectedRows, setSelectedRows,
    setIsSelectMode,
    setIsEditing,
    setIsModalOpen,
    closeModalWhenSelectedItemStale: isEditing
  });

  const searchFields = ['code', 'stoppage_head_name'];
  const searchConditions = ['Like', 'Equal', 'Not Equal', 'Greater', 'Less'];

  const columns = [
    { key: 'code', label: 'Code', width: '100px' },
    { key: 'stoppage_head_name', label: 'Stoppage Head Name', width: 'auto' }
  ];

  useEffect(() => {
    loadStoppageHeads();
  }, []);

  const loadStoppageHeads = async () => {
    await runLatestRowsRequest(
      () => getStoppageHeadsAction(),
      {
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows(result.data || []);
        },
        onError: error => toast.error('Failed to load stoppage heads: ' + error.message)
      }
    );
  };

  const handleSearch = async (field, condition, value) => {
    if (!String(value ?? '').trim()) {
      await loadStoppageHeads();
      return;
    }
    await runLatestRowsRequest(
      () => searchStoppageHeadsAction(field, condition, value),
      {
        onSuccess: (result, { replaceRows }) => {
          if (!result.success) throw new Error(result.error);
          replaceRows(result.data || []);
          toast.success(`Found ${(result.data || []).length} stoppage head(s)`);
        },
        onError: error => toast.error('Search failed: ' + error.message)
      }
    );
  };

  const handleReset = () => {
    loadStoppageHeads();
  };

  const handleRowClick = (stoppageHead) => {
    if (!isSelectMode) {
      setSelectedStoppageHead(stoppageHead);
    }
  };

  const handleAdd = () => {
    resetInteractionState();
    setSelectedStoppageHead(null);
    setSelectedRows([]);
    setIsSelectMode(false);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleSave = async (data) => {
    try {
      setIsLoading(true);
      if (isEditing && selectedStoppageHead) {
        const currentHead = getCurrentRow(selectedStoppageHead);
        if (!currentHead) throw new Error('This stoppage head is no longer in the current list');
        const result = await updateStoppageHeadAction(currentHead.id, data);
        if (result.success) {
          toast.success('Stoppage head updated successfully');
          resetInteractionState({ closeModal: true });
          setIsModalOpen(false);
          setSelectedStoppageHead(null);
          loadStoppageHeads();
        } else {
          toast.error('Failed to update: ' + result.error);
        }
      } else {
        const result = await createStoppageHeadAction(data);
        if (result.success) {
          toast.success('Stoppage head created successfully');
          resetInteractionState({ closeModal: true });
          setIsModalOpen(false);
          setSelectedStoppageHead(null);
          loadStoppageHeads();
        } else {
          toast.error('Failed to create: ' + result.error);
        }
      }
    } catch (error) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isSelectMode && selectedRows.length > 0) {
      // Bulk delete
      const currentSelectedRows = getCurrentRows(selectedRows);
      if (!currentSelectedRows.length) return toast.warning('The selected stoppage heads are no longer in the current list');
      if (!confirm(`Are you sure you want to delete ${currentSelectedRows.length} stoppage head(s)?`)) {
        return;
      }

      try {
        const results = await Promise.all(currentSelectedRows.map(row => deleteStoppageHeadAction(row.id)));
        assertAllActionsSucceeded(results, 'Failed to delete one or more stoppage heads');
        toast.success(`${currentSelectedRows.length} stoppage head(s) deleted successfully`);
        resetInteractionState({ closeModal: true });
        setSelectedRows([]);
        setIsSelectMode(false);
      } catch (error) {
        toast.error('Failed to delete stoppage heads: ' + error.message);
      } finally {
        loadStoppageHeads();
      }
    } else if (!isSelectMode && selectedStoppageHead) {
      // Single delete from modal
      const currentHead = getCurrentRow(selectedStoppageHead);
      if (!currentHead) return toast.warning('The selected stoppage head is no longer in the current list');
      if (!confirm(`Are you sure you want to delete "${currentHead.stoppage_head_name}"?`)) {
        return;
      }

      try {
        const result = await deleteStoppageHeadAction(currentHead.id);
        if (result.success) {
          toast.success('Stoppage head deleted successfully');
          resetInteractionState({ closeModal: true });
          setSelectedStoppageHead(null);
          setIsModalOpen(false);
          loadStoppageHeads();
        } else {
          toast.error('Failed to delete stoppage head: ' + result.error);
        }
      } catch (error) {
        toast.error('Failed to delete stoppage head: ' + error.message);
      }
    } else {
      toast.error('Please select stoppage head(s) to delete');
    }
  };

  const handleDeactivate = async () => {
    const currentTargets = isSelectMode ? getCurrentRows(selectedRows) : getCurrentRows(selectedStoppageHead);
    const targets = currentTargets.filter(row => row.is_active);
    if (!targets.length) return toast.info('Select at least one active stoppage head');
    if (!confirm(`Deactivate ${targets.length} stoppage head(s) and hide their details from new entries?`)) return;
    try {
      const results = await Promise.all(targets.map(row => updateStoppageHeadAction(row.id, { is_active: false })));
      assertAllActionsSucceeded(results, 'Failed to deactivate one or more stoppage heads');
      toast.success(`${targets.length} stoppage head(s) deactivated`);
      resetInteractionState({ closeModal: true });
      setSelectedRows([]);
      setSelectedStoppageHead(null);
    } catch (error) {
      toast.error('Failed to deactivate stoppage heads: ' + error.message);
    } finally {
      loadStoppageHeads();
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
      setSelectedRows([...stoppageHeads]);
    } else {
      setSelectedRows([]);
    }
  };

  const toggleSelectMode = () => {
    const nextSelectMode = !isSelectMode;
    resetInteractionState({ closeModal: true });
    setIsSelectMode(nextSelectMode);
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Stoppage Head Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage stoppage head categories</p>
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
            disabled={isSelectMode ? !selectedRows.some(row => row.is_active) : !selectedStoppageHead?.is_active}
          >
            <Ban className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Deactivate</span>
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedStoppageHead}
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
        onShowAll={handleReset}
      />

      {/* Data Grid */}
      <DataGrid 
        columns={columns}
        data={stoppageHeads}
        onRowClick={handleRowClick}
        selectedRow={selectedStoppageHead}
        showCheckbox={isSelectMode}
        selectedRows={selectedRows}
        onSelectRow={handleSelectRow}
        onSelectAll={handleSelectAll}
        getRowClassName={(row) => !row.is_active ? '!bg-red-100 hover:!bg-red-200 text-red-700' : '!bg-white hover:!bg-yellow-100'}
        onRowDoubleClick={(row) => {
          if (isSelectMode) return;
          openRowEditor(row);
        }}
        onContextMenu={(row, e) => {
          e.preventDefault();
          if (isSelectMode) return;
          openRowEditor(row);
        }}
      />

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setIsEditing(false);
        }}
        title="Stoppage Head Master"
        description={isEditing ? "Modify stoppage head details" : "Add new stoppage head"}
        onCancel={() => {
          setIsModalOpen(false);
          setIsEditing(false);
        }}
        onDelete={isEditing ? handleDelete : null}
        showDelete={isEditing}
        isLoading={isLoading}
        saveLabel={isEditing ? "Update" : "Create"}
      >
        <StoppageHeadForm
          initialData={selectedStoppageHead}
          onSubmit={handleSave}
        />
      </FormModal>
    </div>
  );
}
