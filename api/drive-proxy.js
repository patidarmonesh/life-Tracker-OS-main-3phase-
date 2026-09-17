// Vercel Serverless Function — Proxies Google Drive public file downloads
// Uses drive.google.com/uc which works WITHOUT API key for public files
// Server-side = no CORS issues
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Missing file ID' })
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return res.status(400).json({ error: 'Invalid file ID' })

  try {
    // Try multiple Google Drive download endpoints
    const urls = [
      `https://drive.google.com/uc?export=download&id=${id}`,
      `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    ]

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LifeOS/1.0)',
          },
        })

        if (!response.ok) continue

        const contentType = response.headers.get('content-type') || ''
        const text = await response.text()

        // Check if we got HTML (virus scan page or error) instead of JSON
        if (contentType.includes('text/html') || text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
          // Google returned an HTML page — try next URL
          continue
        }

        // Try parsing as JSON
        try {
          const data = JSON.parse(text)
          res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
          return res.status(200).json(data)
        } catch {
          // Not valid JSON — try next URL
          continue
        }
      } catch {
        continue
      }
    }

    // All approaches failed — try googleapis with env API key as last resort
    const apiKey = process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
    if (apiKey) {
      const apiRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${apiKey}`
      )
      if (apiRes.ok) {
        const data = await apiRes.json()
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
        return res.status(200).json(data)
      }
      if (apiRes.status === 403 || apiRes.status === 401) {
        return res.status(403).json({ error: 'File is not publicly accessible' })
      }
    }

    return res.status(403).json({
      error: 'Cannot access this file. Make sure it is set to "Anyone with the link" in Google Drive sharing settings.'
    })
  } catch (err) {
    console.error('Drive proxy error:', err)
    return res.status(500).json({ error: 'Server error fetching file' })
  }
}

