// Identificador anônimo do navegador (views de stories de visitantes).
// Não identifica a pessoa: é só um UUID aleatório salvo localmente.
const KEY = 'anon_session_id'

export function getAnonymousSessionId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

// Stories já vistos neste navegador (anel cinza)
const SEEN_KEY = 'seen_stories'

export function getSeenStories() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function markStorySeen(id) {
  try {
    const seen = getSeenStories()
    seen.add(id)
    // guarda só os 300 mais recentes
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)))
  } catch {
    /* armazenamento indisponível: ignora */
  }
}
