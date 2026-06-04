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
  const preferences = { ...settings.preferences }
  delete preferences.geminiApiKey
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

export async function decomposeGoalWithAI({ apiKey, title, description }) {
  const prompt = `
You are an expert AI productivity coach. Decompose this goal into 3 to 5 clear, structured milestones.
Goal Title: "${title}"
Goal Description: "${description || 'No description provided'}"

Return ONLY valid JSON in this exact schema, do not add markdown wrapping or explanation:
{
  "milestones": [
    { "text": "Milestone description here" }
  ]
}
`

  const data = await geminiRequest({
    apiKey,
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: { temperature: 0.1 },
  })

  const text =
    data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''

  return extractJsonBlock(text)
}

export async function generateWeeklyReportAndBurnoutRisk({ apiKey, snapshot }) {
  const prompt = `
You are an expert AI Life Coach and Mental Health Predictor. Analyze this user's 7-day productivity and health log dataset.
Look at sleep hours, step counts, study duration, budget adherence, habit completion, and journal sentiments.

Correlation rules:
- Low sleep + very high study hours = High Burnout risk.
- Low spending + high mood = Healthy spending habits.
- High step count + high mood = Exercise benefits mood.

Return ONLY valid JSON in this exact schema, do not add markdown wrapping or explanation:
{
  "burnoutRisk": "Low" | "Medium" | "High" | "Critical",
  "burnoutAnalysis": "A 2-3 sentence analysis of burnout patterns and correlations.",
  "productivityReview": "A 2-3 sentence review of study hours vs. waste time.",
  "suggestions": [
    "Suggestion action 1",
    "Suggestion action 2",
    "Suggestion action 3"
  ]
}

Logs snapshot:
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

  return extractJsonBlock(text)
}

export async function generateStudyPlanWithAI({ apiKey, examDate, subjects, dailyHours }) {
  const prompt = `
You are an expert academic planner. Create a highly customized study schedule to prepare for an exam on ${examDate}.
The student is studying: ${subjects}.
They can study ${dailyHours} hours per day.

Provide a structured weekly target list and daily hour recommendations to optimize their learning and avoid burnout.
Return ONLY valid JSON in this exact schema, do not add markdown wrapping or explanation:
{
  "weeklyMilestones": [
    { "week": "Week 1", "targets": ["Target 1", "Target 2"] }
  ],
  "dailySchedule": [
    { "day": "Monday", "topic": "Subject/Topic recommendation", "hours": 2 }
  ],
  "tips": ["Tip 1", "Tip 2"]
}
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

  return extractJsonBlock(text)
}

export async function analyzeJournalSentimentWithAI({ apiKey, content }) {
  const prompt = `
You are an expert mental health analyzer. Analyze the sentiment and emotions of this journal entry content.
Journal Entry Content: "${content}"

Analyze the text and return ONLY valid JSON in this exact schema, do not add markdown wrapping or explanation:
{
  "sentiment": "Positive",
  "recurringThemes": ["Theme 1", "Theme 2"],
  "healthCheckRecommendation": "A 1-2 sentence supportive feedback/recommendation based on their emotion."
}
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

  return extractJsonBlock(text)
}

