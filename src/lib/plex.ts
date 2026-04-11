// src/lib/plex.ts

function base() { return process.env.PLEX_URL }
function token() { return process.env.PLEX_TOKEN ?? '' }

function plexUrl(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...params, 'X-Plex-Token': token() })
  return `${base()}${path}?${q}`
}

const jsonHeaders = { Accept: 'application/json' }

export async function getMachineIdentifier(): Promise<string> {
  const res = await fetch(plexUrl('/identity'), { headers: jsonHeaders })
  const data = await res.json()
  return data.MediaContainer.machineIdentifier as string
}

export async function findMovieRatingKey(
  imdbId: string
): Promise<string | null> {
  try {
    const res = await fetch(
      plexUrl('/library/all', { guid: `imdb://${imdbId}` }),
      { headers: jsonHeaders }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.MediaContainer?.Metadata?.[0]?.ratingKey ?? null
  } catch {
    return null
  }
}

async function findPlaylist(title: string): Promise<string | null> {
  const res = await fetch(plexUrl('/playlists'), { headers: jsonHeaders })
  if (!res.ok) return null
  const data = await res.json()
  const list = (data.MediaContainer?.Metadata ?? []) as Array<{
    title: string
    ratingKey: string
  }>
  return list.find((p) => p.title === title)?.ratingKey ?? null
}

async function createPlaylist(
  title: string,
  machineId: string,
  ratingKey: string
): Promise<string | null> {
  const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKey}`
  const res = await fetch(
    plexUrl('/playlists', {
      type: 'video',
      title,
      smart: '0',
      uri,
    }),
    { method: 'POST', headers: jsonHeaders }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.MediaContainer?.Metadata?.[0]?.ratingKey ?? null
}

async function clearPlaylist(playlistKey: string): Promise<void> {
  await fetch(plexUrl(`/playlists/${playlistKey}/items`), {
    method: 'DELETE',
    headers: jsonHeaders,
  })
}

async function addToPlaylist(
  playlistKey: string,
  machineId: string,
  ratingKey: string
): Promise<void> {
  const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKey}`
  await fetch(plexUrl(`/playlists/${playlistKey}/items`, { uri }), {
    method: 'PUT',
    headers: jsonHeaders,
  })
}

export async function syncDateNightPlaylist(
  movies: Array<{ imdbId: string }>
): Promise<void> {
  if (movies.length === 0) return

  const machineId = await getMachineIdentifier()

  const ratingKeys = (
    await Promise.all(movies.map((m) => findMovieRatingKey(m.imdbId)))
  ).filter((k): k is string => k !== null)

  if (ratingKeys.length === 0) return

  let playlistKey = await findPlaylist('Date Night')

  if (!playlistKey) {
    playlistKey = await createPlaylist('Date Night', machineId, ratingKeys[0])
    if (!playlistKey) return
    for (const key of ratingKeys.slice(1)) {
      await addToPlaylist(playlistKey, machineId, key)
    }
  } else {
    await clearPlaylist(playlistKey)
    for (const key of ratingKeys) {
      await addToPlaylist(playlistKey, machineId, key)
    }
  }
}
