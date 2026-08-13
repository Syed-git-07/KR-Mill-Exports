'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/tpiEntryQueries'

export async function getTPIEntriesAction() {
  await requireUser()
  try {
    const data = await queries.getTPIEntries()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createTPIEntryAction(entryData) {
  await requireUser()
  try {
    const data = await queries.createTPIEntry(entryData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateTPIEntryAction(id, entryData) {
  await requireUser()
  try {
    const data = await queries.updateTPIEntry(id, entryData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteTPIEntryAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteTPIEntry(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchTPIEntriesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchTPIEntries(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getCountsForDropdownAction() {
  await requireUser()
  try {
    const data = await queries.getCountsForDropdown()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
