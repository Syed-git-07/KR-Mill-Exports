const searchCollator = new Intl.Collator('en', {
  sensitivity: 'base',
  numeric: true,
})

export function normalizeSelectionSearch(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function startsAtWord(text, query) {
  return text.split(' ').some((word) => word.startsWith(query))
}

function normalizedMatchRank(term, primary, secondary) {
  if (primary === term) return 0
  if (primary.startsWith(term)) return 1
  if (startsAtWord(primary, term)) return 2
  if (secondary.some((text) => text === term)) return 3
  if (secondary.some((text) => text.startsWith(term))) return 4
  if (secondary.some((text) => startsAtWord(text, term))) return 5
  if (primary.includes(term)) return 6
  if (secondary.some((text) => text.includes(term))) return 7
  return null
}

/**
 * Lower ranks are more natural search results. The primary label always wins
 * over metadata, and prefix matches always win over contains matches.
 */
export function selectionMatchRank(query, primaryText, secondaryTexts = []) {
  const term = normalizeSelectionSearch(query)
  if (!term) return 0

  const primary = normalizeSelectionSearch(primaryText)
  const secondaryValues = Array.isArray(secondaryTexts) ? secondaryTexts : [secondaryTexts]
  const secondary = secondaryValues.map(normalizeSelectionSearch).filter(Boolean)
  return normalizedMatchRank(term, primary, secondary)
}

export function rankSelectionResults(
  items,
  query,
  { getPrimaryText, getSecondaryTexts = () => [] }
) {
  const term = normalizeSelectionSearch(query)
  if (!term) return items

  return items
    .map((item, originalIndex) => {
      const primary = normalizeSelectionSearch(getPrimaryText(item))
      const secondaryValues = getSecondaryTexts(item)
      const secondary = (Array.isArray(secondaryValues) ? secondaryValues : [secondaryValues])
        .map(normalizeSelectionSearch)
        .filter(Boolean)
      return {
        item,
        originalIndex,
        primary,
        rank: normalizedMatchRank(term, primary, secondary),
      }
    })
    .filter(({ rank }) => rank != null)
    .sort((left, right) => (
      left.rank - right.rank ||
      searchCollator.compare(left.primary, right.primary) ||
      left.originalIndex - right.originalIndex
    ))
    .map(({ item }) => item)
}
