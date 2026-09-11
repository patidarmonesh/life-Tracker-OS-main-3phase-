// Vercel Serverless Function — Proxies Google Drive public file access
// This runs server-side, bypassing browser CORS restrictions
export default async function handler(req, res) {
  // CORS headers so the browser can call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Missing file ID parameter' })
  }

  // Validate file ID format (alphanumeric, hyphens, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid file ID format' })
  }

  try {
    // Fetch from Google Drive API — server-side, no CORS
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`
    const response = await fetch(driveUrl)

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'File not found' })
      }
      if (response.status === 403 || response.status === 401) {
        return res.status(403).json({ error: 'Access denied — file may not be public' })
      }
      return res.status(response.status).json({ error: `Drive API error: ${response.status}` })
    }

    const data = await response.json()
    
    // Cache for 60 seconds to reduce Drive API hits
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    return res.status(200).json(data)
  } catch (err) {
    console.error('Drive proxy error:', err)
    return res.status(500).json({ error: 'Failed to fetch file from Google Drive' })
  }
}
