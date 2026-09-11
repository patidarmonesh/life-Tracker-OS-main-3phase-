// Vercel Serverless Function — Proxies Gemini API calls
// Keeps the API key server-side so shared pages work on any device
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Try multiple env var names for the Gemini API key
  const apiKey = process.env.GEMINI_API_KEY
    || process.env.VITE_GEMINI_API_KEY
    || process.env.GOOGLE_AI_KEY
    || ''

  if (!apiKey) {
    return res.status(500).json({
      error: 'Gemini API key not configured on server. Set GEMINI_API_KEY in Vercel Environment Variables.'
    })
  }

  try {
    const { prompt } = req.body
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt' })
    }

    // Limit prompt length to prevent abuse
    if (prompt.length > 10000) {
      return res.status(400).json({ error: 'Prompt too long (max 10000 chars)' })
    }

    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      }
    )

    const data = await geminiRes.json()

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: data?.error?.message || `Gemini API error: ${geminiRes.status}`
      })
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const finishReason = data?.candidates?.[0]?.finishReason || 'STOP'

    return res.status(200).json({ text, finishReason })
  } catch (err) {
    console.error('Gemini proxy error:', err)
    return res.status(500).json({ error: 'Server error calling Gemini API' })
  }
}
