const API_KEY_STORAGE_KEY = 'vega-deepseek-api-key'

export function getApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setApiKey(key: string) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim())
  } catch {
    // ignore storage errors
  }
}

function extractJsonArray(content: string): string[] {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const raw = fenced ? fenced[1] : trimmed
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('翻译结果不是有效的 JSON 数组')
  }
  const parsed = JSON.parse(raw.slice(start, end + 1))
  if (!Array.isArray(parsed)) {
    throw new Error('翻译结果不是数组')
  }
  return parsed.map((item) => String(item ?? ''))
}

export async function translateLyrics(
  lines: string[],
  targetLanguage: string,
  apiKey: string,
): Promise<string[]> {
  const numberedLyrics = lines
    .map((line, index) => `${index + 1}. ${line}`)
    .join('\n')

  const response = await fetch('/api/deepseek/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional lyrics translator. Translate song lyrics faithfully, keep the original meaning and natural wording. Do not add explanations.',
        },
        {
          role: 'user',
          content:
            `Translate the following lyrics to ${targetLanguage}. Keep the same number of lines. Return ONLY a JSON array of translated strings, no markdown, no extra text.\n\n${numberedLyrics}`,
        },
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`翻译请求失败 (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('翻译响应中没有找到内容')
  }

  const translations = extractJsonArray(content)
  if (translations.length < lines.length) {
    throw new Error(`翻译行数不匹配：期望 ${lines.length} 行，实际 ${translations.length} 行`)
  }

  return translations
}
