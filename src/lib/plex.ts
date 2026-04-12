// src/lib/plex.ts

function base() { return process.env.PLEX_URL }
function token() { return process.env.PLEX_TOKEN ?? '' }

function plexUrl(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...params, 'X-Plex-Token': token() })
  return `${base()}${path}?${q}`
}

const jsonHeaders = {
  Accept: 'application/json',
  'X-Plex-Client-Identifier': 'datenight',
  'X-Plex-Product': 'DateNight',
  'X-Plex-Version': '1.0.0',
  'X-Plex-Platform': 'Node.js',
}

export async function getMachineIdentifier(): Promise<string> {
  const res = await fetch(plexUrl('/identity'), { headers: jsonHeaders })
  const data = await res.json()
  return data.MediaContainer.machineIdentifier as string
}

export async function findMovieLibrarySectionId(): Promise<string | null> {
  const res = await fetch(plexUrl('/library/sections'), { headers: jsonHeaders })
  if (!res.ok) return null
  const data = await res.json()
  const sections = (data.MediaContainer?.Directory ?? []) as Array<{
    type: string
    key: string
    title: string
  }>
  // Prefer a section literally named "Movies" to avoid ambiguity with "Music Videos"
  const movies = sections.filter((s) => s.type === 'movie')
  return (
    movies.find((s) => s.title.toLowerCase() === 'movies')?.key ??
    movies[0]?.key ??
    null
  )
}

// The modern Plex Movie agent (tv.plex.agents.movie) stores IMDB/TMDB IDs as
// secondary GUIDs in a Guid array, not as the primary guid field. The
// /library/all?guid=imdb://... endpoint only matches the primary guid, so it
// always returns empty. Title + year search within the section is reliable.
export async function findMovieRatingKey(
  sectionId: string,
  title: string,
  year: number
): Promise<string | null> {
  try {
    const res = await fetch(
      plexUrl(`/library/sections/${sectionId}/search`, { query: title, type: '1' }),
      { headers: jsonHeaders }
    )
    if (!res.ok) return null
    const data = await res.json()
    const results = (data.MediaContainer?.Metadata ?? []) as Array<{
      ratingKey: string
      title: string
      year: number
    }>
    return results.find((m) => m.year === year)?.ratingKey ?? null
  } catch {
    return null
  }
}

async function findCollection(
  sectionId: string,
  title: string
): Promise<string | null> {
  const res = await fetch(
    plexUrl(`/library/sections/${sectionId}/collections`),
    { headers: jsonHeaders }
  )
  if (!res.ok) return null
  const data = await res.json()
  const list = (data.MediaContainer?.Metadata ?? []) as Array<{
    title: string
    ratingKey: string
  }>
  return list.find((c) => c.title === title)?.ratingKey ?? null
}

async function deleteCollection(collectionKey: string): Promise<void> {
  await fetch(plexUrl(`/library/collections/${collectionKey}`), {
    method: 'DELETE',
    headers: jsonHeaders,
  })
}

async function createCollection(
  title: string,
  sectionId: string,
  machineId: string,
  ratingKeys: string[]
): Promise<string | null> {
  const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKeys.join(',')}`
  const res = await fetch(
    plexUrl('/library/collections', {
      type: '1',
      title,
      sectionId,
      uri,
    }),
    { method: 'POST', headers: jsonHeaders }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.MediaContainer?.Metadata?.[0]?.ratingKey ?? null
}

export async function syncDateNightCollection(
  movies: Array<{ title: string; year: number }>
): Promise<void> {
  if (movies.length === 0) return

  const [machineId, sectionId] = await Promise.all([
    getMachineIdentifier(),
    findMovieLibrarySectionId(),
  ])

  if (!sectionId) return

  const ratingKeys = (
    await Promise.all(movies.map((m) => findMovieRatingKey(sectionId, m.title, m.year)))
  ).filter((k): k is string => k !== null)

  if (ratingKeys.length === 0) return

  const existingKey = await findCollection(sectionId, 'Date Night')
  if (existingKey) {
    await deleteCollection(existingKey)
  }

  await createCollection('Date Night', sectionId, machineId, ratingKeys)
}
