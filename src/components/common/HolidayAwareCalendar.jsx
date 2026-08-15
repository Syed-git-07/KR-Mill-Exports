'use client'

import { useEffect, useMemo, useState } from 'react'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { getAllHolidayDatesAction } from '@/app/actions/holiday-list'
import { getDateShiftListAction } from '@/app/actions/date-shift-list'
import { getOccupiedDateKeys, normalizeCalendarShift } from '@/lib/dateShiftCalendar'

const occupiedDateCache = new Map()

export default function HolidayAwareCalendar({
  onSelect,
  disabled,
  tableName,
  shift,
  onMonthChange,
  month,
  defaultMonth,
  ...props
}) {
  const selectedMonth = props.selected instanceof Date ? props.selected : undefined
  const selectedShift = useMemo(() => normalizeCalendarShift(shift), [shift])
  const initialCalendarMonth = defaultMonth || selectedMonth
  const [holidayDates, setHolidayDates] = useState([])
  const [occupiedDates, setOccupiedDates] = useState([])
  const [isLoadingOccupiedDates, setIsLoadingOccupiedDates] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(
    () => month || initialCalendarMonth || new Date()
  )

  useEffect(() => {
    let active = true
    getAllHolidayDatesAction().then((result) => {
      if (active && result.success) setHolidayDates(result.data || [])
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (month) setVisibleMonth(month)
  }, [month])

  useEffect(() => {
    if (!tableName || !visibleMonth) {
      setOccupiedDates([])
      setIsLoadingOccupiedDates(false)
      return undefined
    }

    let active = true
    const fromDate = format(startOfMonth(visibleMonth), 'yyyy-MM-dd')
    const toDate = format(endOfMonth(visibleMonth), 'yyyy-MM-dd')
    const cacheKey = `${tableName}:${fromDate}:${toDate}:${selectedShift || 'all'}`
    const cachedDates = occupiedDateCache.get(cacheKey)

    if (cachedDates) {
      setOccupiedDates(cachedDates)
      setIsLoadingOccupiedDates(false)
    } else {
      // Do not leave highlights from the previously selected shift visible.
      setOccupiedDates([])
      setIsLoadingOccupiedDates(true)
    }

    getDateShiftListAction(tableName, fromDate, toDate, selectedShift).then((result) => {
      if (!active) return
      if (!result.success) {
        setOccupiedDates([])
        setIsLoadingOccupiedDates(false)
        return
      }

      const dates = getOccupiedDateKeys(result.data?.entries, selectedShift)
      occupiedDateCache.set(cacheKey, dates)
      setOccupiedDates(dates)
      setIsLoadingOccupiedDates(false)
    })

    return () => { active = false }
  }, [tableName, visibleMonth, selectedShift])

  const holidaySet = useMemo(
    () => new Set(holidayDates.map((value) => String(value).split('T')[0])),
    [holidayDates]
  )
  const occupiedSet = useMemo(() => new Set(occupiedDates), [occupiedDates])
  const isHoliday = (day) => holidaySet.has(format(day, 'yyyy-MM-dd'))
  const isOccupied = (day) => occupiedSet.has(format(day, 'yyyy-MM-dd'))
  const HolidayDayButton = ({ day, modifiers, ...buttonProps }) => (
    <CalendarDayButton
      {...buttonProps}
      day={day}
      modifiers={modifiers}
      aria-disabled={modifiers.holiday || undefined}
      title={
        modifiers.holiday
          ? 'Holiday - production work is not allowed'
          : modifiers.occupied
            ? selectedShift
              ? `An entry exists for Shift ${selectedShift}`
              : 'An entry exists for at least one shift'
            : buttonProps.title
      }
    />
  )

  return (
    <div className="bg-background">
      <Calendar
        {...props}
        {...(month ? { month } : { defaultMonth: initialCalendarMonth })}
        disabled={disabled}
        modifiers={{
          ...(props.modifiers || {}),
          occupied: isOccupied,
          holiday: isHoliday,
        }}
        modifiersClassNames={{
          ...(props.modifiersClassNames || {}),
          occupied: 'bg-green-100 text-green-800 rounded-full font-semibold hover:bg-green-200 hover:text-green-900',
          holiday: 'bg-red-100 text-red-700 line-through font-semibold cursor-not-allowed hover:bg-red-200 hover:text-red-800',
        }}
        components={{ ...(props.components || {}), DayButton: HolidayDayButton }}
        onMonthChange={(nextMonth) => {
          setVisibleMonth(nextMonth)
          onMonthChange?.(nextMonth)
        }}
        onSelect={(day, ...args) => {
          if (day && isHoliday(day)) {
            toast.error(`${format(day, 'dd-MMM-yyyy')} is a holiday. Production entry is not allowed.`)
            return
          }
          onSelect?.(day, ...args)
        }}
      />
      {tableName && (
        <div
          className="flex items-center gap-2 px-3 pb-3 text-xs text-gray-600"
          aria-live="polite"
          aria-busy={isLoadingOccupiedDates}
        >
          <span
            aria-hidden="true"
            className={`size-3 rounded-full ring-1 ${
              isLoadingOccupiedDates
                ? 'animate-pulse bg-gray-100 ring-gray-300'
                : 'bg-green-100 ring-green-300'
            }`}
          />
          {isLoadingOccupiedDates
            ? `Checking ${selectedShift ? `Shift ${selectedShift}` : 'entries'}...`
            : selectedShift
              ? `Entry exists for Shift ${selectedShift}`
              : 'Entry exists for at least one shift'}
        </div>
      )}
    </div>
  )
}
