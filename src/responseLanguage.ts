const DIRECTIVE_HEADER = '[Response Language Directive]'
const PREFERRED_LANGUAGE_PREFIX = '- Preferred reply language right now: '

type ScriptBucket =
  | 'korean'
  | 'japanese'
  | 'chinese'
  | 'arabic'
  | 'cyrillic'
  | 'devanagari'
  | 'thai'
  | 'hebrew'
  | 'greek'
  | 'latin'

const DIRECTIVE_BLOCK_RE = /\[Response Language Directive\]\r?\n(?:- .*(?:\r?\n|$))+/g

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

function stripExistingDirective(text: string): string {
  return text.replace(DIRECTIVE_BLOCK_RE, '').trim()
}

function extractExplicitPreferredLanguage(text: string): string | null {
  const match = text.match(/- Preferred reply language right now:\s*(.+)/)
  return match?.[1]?.trim() || null
}

function detectBucketForChar(char: string): ScriptBucket | null {
  if (/\p{Script=Hangul}/u.test(char)) return 'korean'
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char)) return 'japanese'
  if (/\p{Script=Han}/u.test(char)) return 'chinese'
  if (/\p{Script=Arabic}/u.test(char)) return 'arabic'
  if (/\p{Script=Cyrillic}/u.test(char)) return 'cyrillic'
  if (/\p{Script=Devanagari}/u.test(char)) return 'devanagari'
  if (/\p{Script=Thai}/u.test(char)) return 'thai'
  if (/\p{Script=Hebrew}/u.test(char)) return 'hebrew'
  if (/\p{Script=Greek}/u.test(char)) return 'greek'
  if (/\p{Script=Latin}/u.test(char)) return 'latin'
  return null
}

function detectFirstSubstantialBucket(text: string): ScriptBucket | null {
  for (const char of text) {
    const bucket = detectBucketForChar(char)
    if (bucket) return bucket
  }
  return null
}

function getBucketCounts(text: string): Record<ScriptBucket, number> {
  const hangul = countMatches(text, /\p{Script=Hangul}/gu)
  const hiragana = countMatches(text, /\p{Script=Hiragana}/gu)
  const katakana = countMatches(text, /\p{Script=Katakana}/gu)
  const han = countMatches(text, /\p{Script=Han}/gu)
  const hasJapaneseKana = hiragana + katakana > 0

  return {
    korean: hangul,
    japanese: hiragana + katakana + (hasJapaneseKana ? han : 0),
    chinese: hasJapaneseKana ? 0 : han,
    arabic: countMatches(text, /\p{Script=Arabic}/gu),
    cyrillic: countMatches(text, /\p{Script=Cyrillic}/gu),
    devanagari: countMatches(text, /\p{Script=Devanagari}/gu),
    thai: countMatches(text, /\p{Script=Thai}/gu),
    hebrew: countMatches(text, /\p{Script=Hebrew}/gu),
    greek: countMatches(text, /\p{Script=Greek}/gu),
    latin: countMatches(text, /\p{Script=Latin}/gu),
  }
}

function resolveLatinLanguageLabel(text: string): string {
  const englishSignalCount = countMatches(
    text,
    /\b(the|and|is|are|to|of|in|for|with|you|your|please|can|could|would|what|how|why|when|where|thanks|hello|hi)\b/gi
  )
  const latinCount = countMatches(text, /\p{Script=Latin}/gu)
  const asciiLatinCount = countMatches(text, /[A-Za-z]/g)

  if (englishSignalCount > 0 || (latinCount > 0 && asciiLatinCount / latinCount > 0.85)) {
    return 'English'
  }

  return 'the same dominant Latin-script language as the user'
}

function languageLabelForBucket(bucket: ScriptBucket, text: string): string {
  switch (bucket) {
    case 'korean':
      return 'Korean'
    case 'japanese':
      return 'Japanese'
    case 'chinese':
      return 'Chinese'
    case 'arabic':
      return 'Arabic'
    case 'cyrillic':
      return 'the same dominant Cyrillic-script language as the user'
    case 'devanagari':
      return 'the same dominant Devanagari-script language as the user'
    case 'thai':
      return 'Thai'
    case 'hebrew':
      return 'Hebrew'
    case 'greek':
      return 'Greek'
    case 'latin':
      return resolveLatinLanguageLabel(text)
  }
}

export function detectPreferredReplyLanguage(text: string): string {
  const explicitLanguage = extractExplicitPreferredLanguage(text)
  if (explicitLanguage) return explicitLanguage

  const cleaned = stripExistingDirective(text)
  const counts = getBucketCounts(cleaned)
  const ranked = Object.entries(counts)
    .filter((entry): entry is [ScriptBucket, number] => entry[1] > 0)
    .sort((a, b) => b[1] - a[1])

  if (ranked.length === 0) {
    return 'the same language as the user'
  }

  const [topBucket, topCount] = ranked[0]
  const [, secondCount = 0] = ranked[1] ?? []
  const shouldUseTieBreak = secondCount > 0
    && (Math.abs(topCount - secondCount) <= 2 || topCount < secondCount * 1.15)

  const resolvedBucket = shouldUseTieBreak
    ? detectFirstSubstantialBucket(cleaned) ?? topBucket
    : topBucket

  return languageLabelForBucket(resolvedBucket, cleaned)
}

export function buildResponseLanguageDirective(text: string): string {
  const preferredLanguage = detectPreferredReplyLanguage(text)

  return `${DIRECTIVE_HEADER}
- Match the language of the user's latest instruction.
- If the user mixes multiple languages, reply in the language that appears more.
- If the mix is close, follow the language used in the first substantial sentence.
- Apply this same rule to casual chat, workflow answers, reviewer feedback, revisions, and follow-up turns.
${PREFERRED_LANGUAGE_PREFIX}${preferredLanguage}`
}
