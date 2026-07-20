import { isHoliday } from '@/lib/queries/holidayListQueries'

export async function assertWorkingDate(date) {
  const holiday = await isHoliday(date)
  if (holiday) {
    throw new Error(`${String(date).slice(0, 10)} is a holiday: ${holiday.description || 'Holiday'}. Production entry is not allowed.`)
  }
}
