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
import { Plus, Trash2 } from 'lucide-react';

export default function StoppageHeadMaster() {
  const [stoppageHeads, setStoppageHeads] = useState([]);
  const [selectedStoppageHead, setSelectedStoppageHead] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
    try {
      const result = await getStoppageHeadsAction();
      if (result.success) {
        setStoppageHeads(result.data);
      } else {
        toast.error('Failed to load stoppage heads: ' + result.error);
      }
    } catch (error) {
      toast.error('Failed to load stoppage heads: ' + error.message);
    }
  };

  const handleSearch = async (field, condition, value) => {
    try {
      const result = await searchStoppageHeadsAction(field, condition, value);
      if (result.success) {
        setStoppageHeads(result.data);
        toast.success(`Found ${result.data.length} stoppage head(s)`);
      } else {
        toast.error('Search failed: ' + result.error);
      }
    } catch (error) {
      toast.error('Search failed: ' + error.message);
    }
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
    setSelectedStoppageHead(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleSave = async (data) => {
    try {
      setIsLoading(true);
      if (isEditing && selectedStoppageHead) {
        const result = await updateStoppageHeadAction(selectedStoppageHead.id, data);
        if (result.success) {
          toast.success('Stoppage head updated successfully');
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
      if (!confirm(`Are you sure you want to delete ${selectedRows.length} stoppage head(s)?`)) {
        return;
      }

      try {
        await Promise.all(selectedRows.map(row => deleteStoppageHeadAction(row.id)));
        toast.success(`${selectedRows.length} stoppage head(s) deleted successfully`);
        setSelectedRows([]);
        setIsSelectMode(false);
        loadStoppageHeads();
      } catch (error) {
        toast.error('Failed to delete stoppage heads: ' + error.message);
      }
    } else if (!isSelectMode && selectedStoppageHead) {
      // Single delete from modal
      if (!confirm(`Are you sure you want to delete "${selectedStoppageHead.stoppage_head_name}"?`)) {
        return;
      }

      try {
        const result = await deleteStoppageHeadAction(selectedStoppageHead.id);
        if (result.success) {
          toast.success('Stoppage head deleted successfully');
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
    setIsSelectMode(!isSelectMode);
    setSelectedRows([]);
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
            onClick={handleDelete} 
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
            disabled={isSelectMode ? selectedRows.length === 0 : !selectedStoppageHead}
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
      <DataGrid 
        columns={columns}
        data={stoppageHeads}
        onRowClick={handleRowClick}
        selectedRow={selectedStoppageHead}
        showCheckbox={isSelectMode}
        selectedRows={selectedRows}
        onSelectRow={handleSelectRow}
        onSelectAll={handleSelectAll}
        onContextMenu={(row, e) => {
          e.preventDefault();
          setSelectedStoppageHead(row);
          setIsEditing(true);
          setIsModalOpen(true);
        }}
      />

      {/* Form Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Stoppage Head Master"
        description={isEditing ? "Modify stoppage head details" : "Add new stoppage head"}
        onSave={() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }}
        onCancel={() => setIsModalOpen(false)}
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
