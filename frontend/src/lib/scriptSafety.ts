import type { JobResultsResponse, LyricLine } from "./types";

const ARABIC_TO_DEVANAGARI: Record<string, string> = {
  "ء": "", "آ": "आ", "أ": "अ", "ؤ": "व", "إ": "इ", "ئ": "य", "ا": "अ",
  "ب": "ब", "پ": "प", "ت": "त", "ٹ": "ट", "ث": "स", "ج": "ज", "چ": "च",
  "ح": "ह", "خ": "ख़", "د": "द", "ڈ": "ड", "ذ": "ज़", "ر": "र", "ڑ": "ड़",
  "ز": "ज़", "ژ": "ज़", "س": "स", "ش": "श", "ص": "स", "ض": "ज़", "ط": "त",
  "ظ": "ज़", "ع": "अ", "غ": "ग़", "ف": "फ़", "ق": "क़", "ك": "क", "ک": "क",
  "گ": "ग", "ل": "ल", "م": "म", "ن": "न", "ں": "ं", "و": "व", "ه": "ह",
  "ہ": "ह", "ھ": "ह", "ة": "ह", "ۃ": "ह", "ۀ": "ह", "ۂ": "ह", "ي": "य",
  "ی": "य", "ى": "य", "ے": "ए", "ۓ": "ए", "،": ",", "؛": ";", "؟": "?",
  "٪": "%", "٫": ".", "٬": ",", "٠": "०", "١": "१", "٢": "२", "٣": "३",
  "٤": "४", "٥": "५", "٦": "६", "٧": "७", "٨": "८", "٩": "९", "۰": "०",
  "۱": "१", "۲": "२", "۳": "३", "۴": "४", "۵": "५", "۶": "६", "۷": "७",
  "۸": "८", "۹": "९",
};

function isArabicScriptCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x0600 && codePoint <= 0x06ff) ||
    (codePoint >= 0x0750 && codePoint <= 0x077f) ||
    (codePoint >= 0x08a0 && codePoint <= 0x08ff) ||
    (codePoint >= 0xfb50 && codePoint <= 0xfdff) ||
    (codePoint >= 0xfe70 && codePoint <= 0xfeff)
  );
}

export function toHindiSafeText(text: string): string {
  let changed = false;
  let output = "";

  for (const char of text.normalize("NFKC")) {
    const mapped = ARABIC_TO_DEVANAGARI[char];
    if (mapped !== undefined) {
      output += mapped;
      changed = true;
      continue;
    }

    const codePoint = char.codePointAt(0) ?? 0;
    if (isArabicScriptCodePoint(codePoint) || char === "\u200c" || char === "\u200d") {
      changed = true;
      continue;
    }

    output += char;
  }

  if (!changed) return text;
  return output.replace(/[ \t]+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

function sanitizeLines(lines: LyricLine[]): LyricLine[] {
  return lines.map((line) => ({ ...line, text: toHindiSafeText(line.text) }));
}

export function makeResultsHindiSafe(results: JobResultsResponse): JobResultsResponse {
  const lyrics = results.lyrics
    ? { ...results.lyrics, lines: sanitizeLines(results.lyrics.lines) }
    : null;

  const metadata = { ...results.metadata };
  if (metadata.detected_language === "ur") metadata.detected_language = "hi";
  if (metadata.transcript_language_used === "ur") metadata.transcript_language_used = "hi";

  return { ...results, lyrics, metadata };
}
