/**
 * Translation API client
 *
 * Primary: OpenAI GPT-4o-mini (uses existing API key, cheap and reliable)
 * Fallback: LibreTranslate (if LIBRETRANSLATE_URL is set)
 *
 * Env: AI_INTEGRATIONS_OPENAI_API_KEY — OpenAI API key (already configured)
 *      LIBRETRANSLATE_URL — optional, if set uses LibreTranslate instead of OpenAI
 *      LIBRETRANSLATE_API_KEY — optional, for authenticated LibreTranslate instances
 */

const OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '';
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || '';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

// Language name lookup for prompt clarity
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', zh: 'Chinese (Simplified)',
  ar: 'Arabic', hi: 'Hindi', pt: 'Portuguese', de: 'German',
  ja: 'Japanese', ko: 'Korean',
};

// ============= Concurrency-safe rate limiter =============
// Uses an async queue so concurrent requests are serialized properly.

const RATE_LIMIT_MS = LIBRETRANSLATE_URL ? 1200 : 200;
let lastRequestTime = 0;
let queueTail: Promise<void> = Promise.resolve();

function rateLimitWait(): Promise<void> {
  // Chain onto the queue tail so concurrent callers wait in sequence
  queueTail = queueTail.then(async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    lastRequestTime = Date.now();
  });
  return queueTail;
}

// ============= OpenAI Translation =============

// Delimiter unlikely to appear in service data (avoids prompt injection via [N] patterns)
const DELIM_PREFIX = '<<<';
const DELIM_SUFFIX = '>>>';

async function translateWithOpenAI(texts: string[], target: string): Promise<string[]> {
  const targetName = LANG_NAMES[target] || target;
  const numbered = texts.map((t, i) => `${DELIM_PREFIX}${i}${DELIM_SUFFIX} ${t}`).join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: `You are a translator for a social services directory in Alberta, Canada. Translate each numbered line from English to ${targetName}. Keep proper nouns (organization names, place names like "Calgary", "Edmonton") in their original form. Each line starts with <<<N>>> where N is the line number. Return ONLY the translations in the same <<<N>>> format with no extra text.`,
        },
        { role: 'user', content: numbered },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message?.content || '';

  // Parse <<<N>>> responses back into array
  const result = [...texts]; // fallback to originals
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^<<<(\d+)>>>\s*(.+)/);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (idx >= 0 && idx < texts.length) {
        result[idx] = match[2].trim();
      }
    }
  }

  return result;
}

// ============= LibreTranslate Translation =============

async function translateWithLibreTranslate(texts: string[], source: string, target: string): Promise<string[]> {
  const body: Record<string, unknown> = {
    q: texts.length === 1 ? texts[0] : texts,
    source,
    target,
    format: 'text',
  };
  if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;

  const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LibreTranslate ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as { translatedText: string | string[] };
  const translated = Array.isArray(data.translatedText)
    ? data.translatedText
    : [data.translatedText];

  return texts.map((t, i) => translated[i] || t);
}

// ============= Public API =============

/**
 * Translate a single text string.
 * Returns the original text on failure (graceful degradation).
 */
export async function translateText(
  text: string,
  source: string,
  target: string,
): Promise<string> {
  if (!text.trim()) return text;
  const result = await translateBatch([text], source, target);
  return result[0];
}

/**
 * Translate multiple strings in a single call.
 * Uses OpenAI by default, LibreTranslate if configured.
 * Returns translations in the same order. Falls back to originals on error.
 */
export async function translateBatch(
  texts: string[],
  source: string,
  target: string,
): Promise<string[]> {
  if (texts.length === 0) return [];

  // Filter empty strings but preserve positions
  const nonEmpty = texts.map((t, i) => ({ t, i })).filter(({ t }) => t.trim());
  if (nonEmpty.length === 0) return texts;

  await rateLimitWait();

  try {
    const toTranslate = nonEmpty.map(({ t }) => t);
    let translated: string[];

    if (LIBRETRANSLATE_URL) {
      translated = await translateWithLibreTranslate(toTranslate, source, target);
    } else if (OPENAI_API_KEY) {
      translated = await translateWithOpenAI(toTranslate, target);
    } else {
      console.warn('[Translation] No translation API configured (set AI_INTEGRATIONS_OPENAI_API_KEY or LIBRETRANSLATE_URL)');
      return texts;
    }

    // Rebuild the full array preserving empty string positions
    const result = [...texts];
    nonEmpty.forEach(({ i }, idx) => {
      result[i] = translated[idx] || texts[i];
    });
    return result;
  } catch (err) {
    console.error(`[Translation] Error translating to ${target}:`, err);
    return texts; // graceful degradation — show English
  }
}
