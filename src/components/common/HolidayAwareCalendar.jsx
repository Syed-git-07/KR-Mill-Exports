'use client'

import { useEffect, useMemo, useState } from 'react'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { getAllHolidayDatesAction } from '@/app/actions/holiday-list'
import { getDateShiftListAction } from '@/app/actions/date-shift-list'

export default function HolidayAwareCalendar({
  onSelect,
  disabled,
  tableName,
  onMonthChange,
  month,
  defaultMonth,
  ...props
}) {
  const selectedMonth = props.selected instanceof Date ? props.selected : undefined
  const initialCalendarMonth = defaultMonth || selectedMonth
  const [holidayDates, setHolidayDates] = useState([])
  const [occupiedDates, setOccupiedDates] = useState([])
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
      return undefined
    }

    let active = true
    const fromDate = format(startOfMonth(visibleMonth), 'yyyy-MM-dd')
    const toDate = format(endOfMonth(visibleMonth), 'yyyy-MM-dd')

    getDateShiftListAction(tableName, fromDate, toDate).then((result) => {
      if (!active) return
      if (!result.success) {
        setOccupiedDates([])
        return
      }

      const dates = (result.data?.entries || [])
        .filter((entry) => entry.hasData)
        .map((entry) => String(entry.entry_date).split('T')[0])
      setOccupiedDates([...new Set(dates)])
    })

    return () => { active = false }
  }, [tableName, visibleMonth])

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
            ? 'An entry exists for at least one shift'
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
        <div className="flex items-center gap-2 px-3 pb-3 text-xs text-gray-600">
          <span aria-hidden="true" className="size-3 rounded-full bg-green-100 ring-1 ring-green-300" />
          Entry exists for at least one shift
        </div>
      )}
    </div>
  )
}
