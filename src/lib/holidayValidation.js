import { isHoliday } from '@/lib/queries/holidayListQueries'
import { parseStrictDate } from '@/lib/strictDate'

export async function assertWorkingDate(date) {
  const validatedDate = parseStrictDate(date, 'Production date')
  const holiday = await isHoliday(validatedDate)
  if (holiday) {
    throw new Error(`${validatedDate.toISOString().slice(0, 10)} is a holiday: ${holiday.description || 'Holiday'}. Production entry is not allowed.`)
  }

  return validatedDate
}
