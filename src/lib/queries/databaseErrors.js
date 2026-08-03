export function isUniqueConstraintError(error) {
  if (error?.code === 'P2002') return true

  const databaseCode = String(error?.meta?.code ?? error?.meta?.driverAdapterError?.cause?.originalCode ?? '')
  if (error?.code === 'P2010' && databaseCode === '1062') return true

  return /duplicate entry|unique constraint/i.test(String(error?.message || ''))
}
