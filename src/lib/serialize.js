/**
 * Helper function to convert Prisma Decimal types to JavaScript numbers
 * This is necessary when passing data from Server Actions to Client Components
 * as Decimal objects cannot be serialized
 */
export function serializeData(data) {
  // Use JSON stringify with a custom replacer to handle Decimal objects
  return JSON.parse(JSON.stringify(data, (key, value) => {
    // Check if it's a Decimal object (has d, e, s properties)
    if (value && typeof value === 'object' && 
        typeof value.d !== 'undefined' && 
        typeof value.e !== 'undefined' && 
        typeof value.s !== 'undefined') {
      // Convert Decimal to number
      return parseFloat(value.toString())
    }
    // Check for Date objects
    if (value instanceof Date) {
      return value.toISOString()
    }
    return value
  }))
}

