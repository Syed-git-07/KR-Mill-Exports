'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'
import { CalendarDays, Plus, Pencil, Trash2, PlusCircle, Download } from 'lucide-react'
import { toast } from 'sonner'
import SearchFilter from '@/components/common/SearchFilter'
import DataGrid from '@/components/common/DataGrid'
import FormModal from '@/components/common/FormModal'
import HolidayListForm from '@/components/modules/post-preparatory/HolidayListForm'
import HolidayForm from '@/components/modules/post-preparatory/HolidayForm'
import ImportHolidaysModal from '@/components/modules/post-preparatory/ImportHolidaysModal'
import {
  getHolidayListsAction,
  searchHolidayListsAction,
  createHolidayListAction,
  updateHolidayListAction,
  deleteHolidayListAction,
  getHolidaysByListIdAction,
  createHolidayAction,
  updateHolidayAction,
  deleteHolidayAction,
} from '@/app/actions/holiday-list'

export default function HolidayListManagement() {
  const DEFAULT_COMPANY_ID = '1'
  const [holidayLists, setHolidayLists] = useState([])
  const [isListModalOpen, setIsListModalOpen] = useState(false)
  const [isEditingList, setIsEditingList] = useState(false)
  const [selectedHolidayList, setSelectedHolidayList] = useState(null)
  const [selectedRowId, setSelectedRowId] = useState(null)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  const [holidays, setHolidays] = useState([])
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isEditingHoliday, setIsEditingHoliday] = useState(false)
  const [selectedHoliday, setSelectedHoliday] = useState(null)
  const [isSubmittingList, setIsSubmittingList] = useState(false)
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false)

  useEffect(() => {
    loadHolidayLists(DEFAULT_COMPANY_ID)
  }, [])

  const loadHolidayLists = async (companyId) => {
    try {
      const result = await getHolidayListsAction(companyId)
      if (result.success) {
        setHolidayLists(result.data || [])
      } else {
        toast.error('Failed to load holiday lists: ' + result.error)
      }
    } catch (error) {
      toast.error('Failed to load holiday lists: ' + error.message)
    }
  }

  const handleSearch = async (field, condition, value) => {
    if (!value || !value.toString().trim()) {
      return loadHolidayLists(DEFAULT_COMPANY_ID)
    }
    try {
      const result = await searchHolidayListsAction(field, condition, value, DEFAULT_COMPANY_ID)
      if (result.success) {
        setHolidayLists(result.data || [])
        toast.success(`Found ${result.data?.length ?? 0} record(s)`)
      } else {
        toast.error('Search failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Search failed: ' + error.message)
    }
  }

  const handleShowAll = () => {
    loadHolidayLists(DEFAULT_COMPANY_ID)
  }

  const handleAddList = () => {
    setIsEditingList(false)
    setSelectedHolidayList(null)
    setIsListModalOpen(true)
  }

  const handleEditList = (holidayList) => {
    setSelectedHolidayList(holidayList)
    setSelectedRowId(holidayList.id)
    setIsEditingList(true)
    setIsListModalOpen(true)
  }

  const handleDeleteList = async (listToDelete) => {
    const list = listToDelete || selectedHolidayList
    if (!list) {
      toast.error('Please select a holiday list to delete')
      return
    }
    if (!confirm(`Delete holiday list '${list.name}'?`)) return

    try {
      const result = await deleteHolidayListAction(list.id)
      if (result.success) {
        toast.success('Holiday list deleted successfully')
        setSelectedHolidayList(null)
        setSelectedRowId(null)
        setIsListModalOpen(false)
        loadHolidayLists(DEFAULT_COMPANY_ID)
      } else {
        toast.error('Delete failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Delete failed: ' + error.message)
    }
  }

  const handleSaveList = async (values) => {
    setIsSubmittingList(true)
    try {
      const payload = {
        companyId: 1,
        name: values.name.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        weekOffs: values.weekOffs,
        status: values.status,
      }

      if (new Date(payload.startDate) > new Date(payload.endDate)) {
        toast.error('Start Date must be less than or equal to End Date.')
        setIsSubmittingList(false)
        return
      }

      let result
      if (isEditingList && selectedHolidayList) {
        result = await updateHolidayListAction(selectedHolidayList.id, payload)
      } else {
        result = await createHolidayListAction(payload)
      }

      if (result.success) {
        toast.success(`Holiday list ${isEditingList ? 'updated' : 'created'} successfully`)
        setIsListModalOpen(false)
        setSelectedHolidayList(null)
        setIsEditingList(false)
        setSelectedRowId(null)
        loadHolidayLists(DEFAULT_COMPANY_ID)
      } else {
        toast.error('Save failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Save failed: ' + error.message)
    } finally {
      setIsSubmittingList(false)
    }
  }

  const handleManageHolidays = async (holidayList) => {
    setSelectedHolidayList(holidayList)
    setSelectedRowId(holidayList.id)
    setIsManageModalOpen(true)
    await loadHolidays(holidayList.id)
  }

  const loadHolidays = async (holidayListId) => {
    try {
      const result = await getHolidaysByListIdAction(holidayListId)
      if (result.success) {
        setHolidays(result.data || [])
      } else {
        toast.error('Failed to load holidays: ' + result.error)
      }
    } catch (error) {
      toast.error('Failed to load holidays: ' + error.message)
    }
  }

  const handleAddHoliday = () => {
    setSelectedHoliday(null)
    setIsEditingHoliday(false)
    setIsHolidayModalOpen(true)
  }

  const handleEditHoliday = (holiday) => {
    setSelectedHoliday(holiday)
    setIsEditingHoliday(true)
    setIsHolidayModalOpen(true)
  }

  const handleDeleteHoliday = async (holiday) => {
    if (!confirm(`Delete holiday on ${format(new Date(holiday.date), 'yyyy-MM-dd')}?`)) return
    try {
      const result = await deleteHolidayAction(holiday.id)
      if (result.success) {
        toast.success('Holiday deleted successfully')
        loadHolidays(selectedHolidayList.id)
      } else {
        toast.error('Delete failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Delete failed: ' + error.message)
    }
  }

  const handleSaveHoliday = async (values) => {
    if (!selectedHolidayList) {
      toast.error('Please open a holiday list first')
      return
    }

    const start = new Date(selectedHolidayList.startDate)
    const end = new Date(selectedHolidayList.endDate)
    const selected = new Date(values.date)
    if (selected < start || selected > end) {
        toast.error('Holiday date must be within the selected holiday list period.')
        setIsSubmittingHoliday(false)
        return
      }

      const duplicate = holidays.find((h) => h.date === values.date && (!isEditingHoliday || h.id !== selectedHoliday?.id))
      if (duplicate) {
        toast.error('A holiday with that date already exists in this list.')
        setIsSubmittingHoliday(false)
        return
      }
    setIsSubmittingHoliday(true)
    try {
      const payload = {
        holidayListId: selectedHolidayList.id,
        date: values.date,
        description: values.description.trim(),
      }
      let result
      if (isEditingHoliday && selectedHoliday) {
        result = await updateHolidayAction(selectedHoliday.id, payload)
      } else {
        result = await createHolidayAction(payload)
      }

      if (result.success) {
        toast.success(`Holiday ${isEditingHoliday ? 'updated' : 'added'} successfully`)
        setIsHolidayModalOpen(false)
        setSelectedHoliday(null)
        loadHolidays(selectedHolidayList.id)
      } else {
        toast.error('Save failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Save failed: ' + error.message)
    } finally {
      setIsSubmittingHoliday(false)
    }
  }

  const holidayListRows = useMemo(
    () => holidayLists.map((item) => ({
      ...item,
      startDate: item.startDate ? format(new Date(item.startDate), 'yyyy-MM-dd') : '',
      endDate: item.endDate ? format(new Date(item.endDate), 'yyyy-MM-dd') : '',
      actions: (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleManageHolidays(item)}>
            <CalendarDays className="h-4 w-4" /> Manage
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleEditList(item)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="gap-2 border-red-600 text-red-600 hover:bg-red-50" onClick={() => handleDeleteList(item)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      ),
      statusDisplay: (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
          {item.status}
        </span>
      ),
    })),
    [holidayLists]
  )

  const holidayColumns = [
    { key: 'date', label: 'Date', width: '140px' },
    { key: 'day', label: 'Day', width: '90px' },
    { key: 'description', label: 'Description', width: 'auto' },
    { key: 'actions', label: 'Actions', width: '260px' },
  ]

  const holidayRows = useMemo(
    () => holidays.map((item) => ({
      ...item,
      date: item.date ? format(new Date(item.date), 'yyyy-MM-dd') : '',
      day: item.date ? format(new Date(item.date), 'EEE') : '',
      actions: (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleEditHoliday(item)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="gap-2 border-red-600 text-red-600 hover:bg-red-50" onClick={() => handleDeleteHoliday(item)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      ),
    })),
    [holidays]
  )

  const listColumns = [
    { key: 'id', label: 'ID', width: '70px' },
    { key: 'name', label: 'List Name', width: 'auto' },
    { key: 'startDate', label: 'Start Date', width: '130px' },
    { key: 'endDate', label: 'End Date', width: '130px' },
    { key: 'statusDisplay', label: 'Status', width: '110px' },
    { key: 'actions', label: 'Actions', width: '360px' },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">Holiday List Management</h1>
        </div>

        <div className="flex flex-wrap gap-3 sm:items-center">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleAddList}>
            <Plus className="h-4 w-4" /> Add Holiday List
          </Button>
        </div>
      </div>

      <div>
        <SearchFilter
          fields={[
            { label: 'List Name', value: 'name' },
            { label: 'ID', value: 'id' },
            { label: 'Status', value: 'status' },
          ]}
          onSearch={handleSearch}
          onShowAll={handleShowAll}
        />
      </div>

      <div className="space-y-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <DataGrid
            columns={listColumns}
            data={holidayListRows}
            onRowClick={(row) => { setSelectedHolidayList(row); setSelectedRowId(row.id) }}
            selectedRowId={selectedRowId}
          />
        </div>
        <div className="text-sm text-muted-foreground">Total Holiday Lists: {holidayLists.length}</div>
      </div>

      <FormModal
        open={isListModalOpen}
        onOpenChange={setIsListModalOpen}
        title={isEditingList ? 'Edit Holiday List' : 'Add Holiday List'}
        description={isEditingList ? 'Update the holiday list and week offs.' : 'Create a new holiday list for the selected company.'}
        onCancel={() => {
          setIsListModalOpen(false)
          setSelectedHolidayList(null)
          setIsEditingList(false)
        }}
        isLoading={isSubmittingList}
        saveLabel={isEditingList ? 'Update List' : 'Create List'}
        formId="holiday-list-form"
        showDelete={isEditingList}
        onDelete={handleDeleteList}
        deleteLabel="Delete List"
        deleteIsDanger
      >
        <HolidayListForm
          initialData={isEditingList ? selectedHolidayList : null}
          onSubmit={handleSaveList}
          onCancel={() => setIsListModalOpen(false)}
          isSubmitting={isSubmittingList}
          formId="holiday-list-form"
        />
      </FormModal>

      <Dialog open={isManageModalOpen} onOpenChange={setIsManageModalOpen}>
        <DialogContent className="max-w-5xl bg-white border border-gray-200 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Manage Holidays</DialogTitle>
            <DialogDescription>
              {selectedHolidayList ? `${selectedHolidayList.name} — ${format(new Date(selectedHolidayList.startDate), 'yyyy-MM-dd')} to ${format(new Date(selectedHolidayList.endDate), 'yyyy-MM-dd')}` : 'Select a holiday list to view holidays.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-3 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>Holiday list holidays</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleAddHoliday}>
                  <PlusCircle className="h-4 w-4" /> Add Holiday
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setIsImportModalOpen(true)}>
                  <Download className="h-4 w-4" /> Import Holidays
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <DataGrid columns={holidayColumns} data={holidayRows} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FormModal
        open={isHolidayModalOpen}
        onOpenChange={setIsHolidayModalOpen}
        title={isEditingHoliday ? 'Edit Holiday' : 'Add Holiday'}
        description={selectedHolidayList ? `Holiday list period: ${format(new Date(selectedHolidayList.startDate), 'yyyy-MM-dd')} to ${format(new Date(selectedHolidayList.endDate), 'yyyy-MM-dd')}` : ''}
        onCancel={() => {
          setIsHolidayModalOpen(false)
          setSelectedHoliday(null)
          setIsEditingHoliday(false)
        }}
        formId="holiday-form"
        isLoading={isSubmittingHoliday}
        saveLabel={isEditingHoliday ? 'Update Holiday' : 'Add Holiday'}
      >
        <HolidayForm
          initialData={isEditingHoliday ? selectedHoliday : null}
          onSubmit={handleSaveHoliday}
          onCancel={() => setIsHolidayModalOpen(false)}
          isSubmitting={isSubmittingHoliday}
          minDate={selectedHolidayList ? format(new Date(selectedHolidayList.startDate), 'yyyy-MM-dd') : undefined}
          maxDate={selectedHolidayList ? format(new Date(selectedHolidayList.endDate), 'yyyy-MM-dd') : undefined}
          formId="holiday-form"
        />
      </FormModal>

      <ImportHolidaysModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        holidayList={selectedHolidayList}
        existingHolidays={holidays}
        onSuccess={() => {
          if (selectedHolidayList?.id) {
            loadHolidays(selectedHolidayList.id)
          }
        }}
      />
    </div>
  )
}
