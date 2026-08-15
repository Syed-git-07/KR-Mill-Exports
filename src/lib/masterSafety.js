export const MASTER_DELETE_DISABLED_MESSAGE =
  'Permanent deletion is disabled to protect setup and production history. Deactivate the record instead.'

export function disabledMasterDeleteResult() {
  throw new Error(MASTER_DELETE_DISABLED_MESSAGE)
}
