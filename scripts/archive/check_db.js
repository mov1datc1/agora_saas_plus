const SUPABASE_URL = "https://swmglkfbhhuifyliquon.supabase.co"
const ANON_KEY = "sb_publishable_S7hViL8SolDlbRJRopBX1A_TBBj6CC9"

async function check() {
  const headers = {
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json"
  }

  // Get total count
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/Transaction?select=id`, {
    headers: { ...headers, "Prefer": "count=exact" },
    method: 'HEAD'
  })
  const total = countRes.headers.get('content-range')
  console.log("Total Transactions:", total)

  // Get newest
  const newestRes = await fetch(`${SUPABASE_URL}/rest/v1/Transaction?select=dateAnnounced&order=dateAnnounced.desc&limit=1`, { headers })
  const newest = await newestRes.json()
  console.log("Newest Transaction:", newest)

  // Get oldest
  const oldestRes = await fetch(`${SUPABASE_URL}/rest/v1/Transaction?select=dateAnnounced&order=dateAnnounced.asc&limit=1`, { headers })
  const oldest = await oldestRes.json()
  console.log("Oldest Transaction:", oldest)

  // Count by year (roughly)
  for (let year = 2020; year <= 2026; year++) {
    const start = `${year}-01-01T00:00:00.000Z`
    const end = `${year}-12-31T23:59:59.999Z`
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Transaction?select=id&dateAnnounced=gte.${start}&dateAnnounced=lte.${end}`, {
      headers: { ...headers, "Prefer": "count=exact" },
      method: 'HEAD'
    })
    console.log(`Year ${year}:`, res.headers.get('content-range'))
  }
}

check().catch(console.error)
