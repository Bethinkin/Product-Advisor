export interface Utterance {
  speaker?: string;
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface Chunk {
  chunkIndex: number;
  startChar: number;
  endChar: number;
  startTimestampMs?: number;
  endTimestampMs?: number;
  speaker?: string;
  text: string;
}

// Approximate token count using a 4-chars-per-token heuristic. Good enough
// for chunk sizing; precise tokenizers add cost without changing outcomes here.
function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
}

// Splits a sequence of utterances into chunks ~targetTokens long with overlap.
// Never splits inside a single utterance.
export function chunkUtterances(
  utterances: Utterance[],
  opts: ChunkOptions = {},
): Chunk[] {
  const target = opts.targetTokens ?? 700;
  const overlap = opts.overlapTokens ?? 100;
  const chunks: Chunk[] = [];

  let cursor = 0;
  let chunkIndex = 0;
  let charOffset = 0;
  const utteranceOffsets: number[] = [];
  for (const u of utterances) {
    utteranceOffsets.push(charOffset);
    charOffset += renderUtterance(u).length + 1;
  }
  const totalChars = charOffset;

  while (cursor < utterances.length) {
    let tokens = 0;
    let end = cursor;
    while (end < utterances.length && tokens < target) {
      tokens += approxTokens(renderUtterance(utterances[end]));
      end++;
    }
    const slice = utterances.slice(cursor, end);
    if (slice.length === 0) break;

    const text = slice.map(renderUtterance).join("\n");
    const startChar = utteranceOffsets[cursor];
    const endChar =
      end < utteranceOffsets.length
        ? utteranceOffsets[end] - 1
        : totalChars;
    const startTimestampMs = slice[0].startMs;
    const endTimestampMs = slice[slice.length - 1].endMs;
    const speakers = Array.from(new Set(slice.map((u) => u.speaker).filter(Boolean)));

    chunks.push({
      chunkIndex,
      startChar,
      endChar,
      startTimestampMs,
      endTimestampMs,
      speaker: speakers.length === 1 ? speakers[0] : undefined,
      text,
    });
    chunkIndex++;

    if (end >= utterances.length) break;

    // Step back for overlap.
    let backTokens = 0;
    let stepBack = end - 1;
    while (stepBack > cursor && backTokens < overlap) {
      backTokens += approxTokens(renderUtterance(utterances[stepBack]));
      stepBack--;
    }
    cursor = Math.max(stepBack + 1, cursor + 1);
  }

  return chunks;
}

function renderUtterance(u: Utterance): string {
  if (u.speaker) return `${u.speaker}: ${u.text}`;
  return u.text;
}
