const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const GEMINI_KEY_STORAGE = 'lifeos_gemini_api_key'

function extractJsonBlock(text) {
  if (!text) return null

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

async function geminiRequest({ apiKey, contents, generationConfig = { temperature: 0.2 } }) {
  const key = apiKey?.trim()
  if (!key) {
    throw new Error('Missing Gemini API key')
  }

  const res = await fetch(GEMINI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      contents,
      generationConfig,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Gemini API request failed')
  }

  return data
}

export function getGeminiApiKey() {
  const fromStorage = localStorage.getItem(GEMINI_KEY_STORAGE)?.trim()
  if (fromStorage) return fromStorage

  return import.meta.env.VITE_GEMINI_API_KEY?.trim() || ''
}

export function saveGeminiApiKey(apiKey) {
  const cleaned = String(apiKey || '').trim()
  if (cleaned) {
    localStorage.setItem(GEMINI_KEY_STORAGE, cleaned)
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE)
  }
}

export function stripGeminiKeyFromSettings(settings) {
  if (!settings?.preferences) return settings
  const { geminiApiKey: _removed, ...preferences } = settings.preferences
  return { ...settings, preferences }
}

export async function testGeminiApiKey(apiKey) {
  return geminiRequest({
    apiKey,
    contents: [
      {
        parts: [{ text: 'Reply with exactly: OK' }],
      },
    ],
    generationConfig: { temperature: 0 },
  })
}

export async function extractBillWithGemini({
  apiKey,
  base64Data,
  mimeType = 'image/jpeg',
  allowedCategories = [],
}) {
  const prompt = `
Extract information from this bill or receipt.
Return ONLY valid JSON in this exact schema:
{
  "totalAmount": number | null,
  "merchant": string,
  "category": string,
  "date": string | null,
  "description": string,
  "rawText": string
}

Rules:
- category must be one of: ${allowedCategories.join(', ') || 'Miscellaneous'}
- if amount is missing, use null
- if date is missing, use null
- do not add markdown
- do not add explanation
`

  const data = await geminiRequest({
    apiKey,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  })

  const text =
    data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''

  return {
    rawResponse: text,
    parsed: extractJsonBlock(text),
  }
}

export async function generateDailyInsight({ apiKey, summary }) {
  const prompt = `
You are an assistant for a personal life operating system app.
Generate a short, practical daily insight in 2-4 sentences.

User summary:
${summary}

Requirements:
- be specific
- focus on actionability
- no motivational fluff
- plain text only
`

  const data = await geminiRequest({
    apiKey,
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: { temperature: 0.4 },
  })

  return (
    data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || ''
  )
}

export async function analyzeLifeOSSnapshot({ apiKey, snapshot }) {
  const prompt = `
You are analyzing a user's LifeOS data snapshot.
Return ONLY valid JSON in this schema:
{
  "overall": string,
  "finance": string,
  "study": string,
  "habits": string,
  "time": string,
  "health": string,
  "risks": string[],
  "nextActions": string[]
}

Snapshot:
${JSON.stringify(snapshot, null, 2)}
`

  const data = await geminiRequest({
    apiKey,
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: { temperature: 0.2 },
  })

  const text =
    data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''

  return {
    rawResponse: text,
    parsed: extractJsonBlock(text),
  }
}
