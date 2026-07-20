'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { getAllHolidayDatesAction } from '@/app/actions/holiday-list'

export default function HolidayAwareCalendar({ onSelect, disabled, ...props }) {
  const [holidayDates, setHolidayDates] = useState([])

  useEffect(() => {
    let active = true
    getAllHolidayDatesAction().then((result) => {
      if (active && result.success) setHolidayDates(result.data || [])
    })
    return () => { active = false }
  }, [])

  const holidaySet = useMemo(
    () => new Set(holidayDates.map((value) => String(value).split('T')[0])),
    [holidayDates]
  )
  const isHoliday = (day) => holidaySet.has(format(day, 'yyyy-MM-dd'))
  const HolidayDayButton = ({ day, modifiers, ...buttonProps }) => (
    <CalendarDayButton
      {...buttonProps}
      day={day}
      modifiers={modifiers}
      aria-disabled={modifiers.holiday || undefined}
      title={modifiers.holiday ? 'Holiday - production work is not allowed' : buttonProps.title}
    />
  )

  return (
    <Calendar
      {...props}
      disabled={disabled}
      modifiers={{ ...(props.modifiers || {}), holiday: isHoliday }}
      modifiersClassNames={{ ...(props.modifiersClassNames || {}), holiday: 'bg-red-100 text-red-700 line-through font-semibold cursor-not-allowed hover:bg-red-200 hover:text-red-800' }}
      components={{ ...(props.components || {}), DayButton: HolidayDayButton }}
      onSelect={(day, ...args) => {
        if (day && isHoliday(day)) {
          toast.error(`${format(day, 'dd-MMM-yyyy')} is a holiday. Production entry is not allowed.`)
          return
        }
        onSelect?.(day, ...args)
      }}
    />
  )
}
