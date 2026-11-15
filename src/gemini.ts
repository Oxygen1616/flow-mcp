import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { HOME_DIR } from "./chrome.js";

const run = promisify(execFile);
const FFMPEG = process.env.FLOW_MCP_FFMPEG ?? "ffmpeg";
const KEY_FILE = join(HOME_DIR, "gemini-key");
const MODEL = process.env.FLOW_MCP_GEMINI_TTS ?? "gemini-2.5-flash-preview-tts";

// Gemini's prebuilt voices. Flow draws on the same set, so a narration made here matches one made in Flow.
export const GEMINI_VOICES = [
  { name: "Zephyr", description: "bright" }, { name: "Puck", description: "upbeat" },
  { name: "Charon", description: "informative" }, { name: "Kore", description: "firm" },
  { name: "Fenrir", description: "excitable" }, { name: "Leda", description: "youthful" },
  { name: "Orus", description: "firm" }, { name: "Aoede", description: "breezy" },
  { name: "Callirrhoe", description: "easy-going" }, { name: "Autonoe", description: "bright" },
  { name: "Enceladus", description: "breathy" }, { name: "Iapetus", description: "clear" },
  { name: "Umbriel", description: "easy-going" }, { name: "Algieba", description: "smooth" },
  { name: "Despina", description: "smooth" }, { name: "Erinome", description: "clear" },
  { name: "Algenib", description: "gravelly" }, { name: "Rasalgethi", description: "informative" },
  { name: "Laomedeia", description: "upbeat" }, { name: "Achernar", description: "soft" },
  { name: "Alnilam", description: "firm" }, { name: "Schedar", description: "even" },
  { name: "Gacrux", description: "mature" }, { name: "Pulcherrima", description: "forward" },
  { name: "Achird", description: "friendly" }, { name: "Zubenelgenubi", description: "casual" },
  { name: "Vindemiatrix", description: "gentle" }, { name: "Sadachbia", description: "lively" },
  { name: "Sadaltager", description: "knowledgeable" }, { name: "Sulafat", description: "warm" },
];

// A key is one unbroken run of characters - older AI Studio keys start "AIza", newer ones "AQ" (2026-10). Anything
// shorter or still holding template text is not a key.
export const geminiKey = (): string | undefined => {
  const key = (process.env.GEMINI_API_KEY ?? (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, "utf8") : "")).trim();
  if (!key || key.length < 20 || /^(YOUR|PASTE|<|\$)/i.test(key) || /_KEY|KEY_HERE|EXAMPLE/i.test(key)) return undefined;
  return key;
};

// Saves the user's key from the panel straight to a file only they can read. It never passes through Claude - that is
// why there is no MCP tool for it. The key is checked with Google BEFORE anything is written, so a mistyped or
// placeholder key can never replace one that works. The check lists models with the key in a header (never in the URL)
// and spends no text-to-speech quota.
export async function saveGeminiKey(raw: string): Promise<{ saved: true; ending: string }> {
  const key = raw.trim();
  // Only the shape is checked here (Google moved new keys from "AIza..." to "AQ..." in October 2026, and a prefix
  // check refused them); whether the key WORKS is decided by Google itself just below.
  if (!/^[A-Za-z0-9._~+/=-]{20,512}$/.test(key) || /^(YOUR|PASTE|<|\$)/i.test(key) || /_KEY|KEY_HERE|EXAMPLE/i.test(key)) {
    throw new Error("That doesn't look like a Google AI Studio key. Copy the whole key from aistudio.google.com/apikey, with no spaces.");
  }
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": key } }).catch(() => null);
  if (!res) throw new Error("Couldn't reach Google to check the key. Check your internet connection and try again.");
  if (!res.ok) throw new Error("Google didn't accept that key. Copy it again from aistudio.google.com/apikey. Your previous key, if any, is unchanged.");
  mkdirSync(dirname(KEY_FILE), { recursive: true });
  writeFileSync(KEY_FILE, key, { mode: 0o600 });
  chmodSync(KEY_FILE, 0o600);
  return { saved: true, ending: key.slice(-4) };
}

interface TtsPart {
  inlineData?: { mimeType?: string; data?: string };
}

function requireKey(): string {
  const key = geminiKey();
  if (!key) {
    const placeholder = existsSync(KEY_FILE) && readFileSync(KEY_FILE, "utf8").trim().length > 0;
    throw new Error(
      (placeholder
        ? `The key file still holds placeholder text, not a key.\n\n`
        : `No Gemini key yet.\n\n`) +
        `1. Open aistudio.google.com/apikey and click "Create API key".\n` +
        `2. Copy the whole key (older keys start with AIza, newer ones with AQ).\n` +
        `3. Paste it into Flow Studio: Voice tab -> Google AI Studio key -> Save key. It is checked with Google and saved\n` +
        `   only on this computer - never paste it into a chat.`,
    );
  }
  return key;
}

function buildStylePrompt(text: string, style?: string, multiParagraph = false): string {
  if (!style || !style.trim()) {
    return multiParagraph
      ? `Read clearly and naturally, leaving a distinct 1-second silent pause between each paragraph:\n\n${text}`
      : text;
  }
  const cleaned = style.trim().replace(/^(?:say|read(?:\s+it)?|speak)\s+/i, "").replace(/[:.\s]+$/, "");
  if (multiParagraph) {
    return `Read ${cleaned}. Leave a distinct 1-second silent pause between each paragraph:\n\n${text}`;
  }
  return `Read ${cleaned}: ${text}`;
}

async function fetchGeminiPcm(prompt: string, voice: string, key: string): Promise<{ pcm: Buffer; rate: number }> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: TtsPart[] } }[];
    };
    if (!res.ok) {
      const msg = body.error?.message ?? "no detail";
      if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
        const matchSec = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
        const waitMs = matchSec ? Math.ceil(Number(matchSec[1]) * 1000) + 1500 : attempt * 15000;
        await new Promise((r) => setTimeout(r, Math.min(waitMs, 65000)));
        continue;
      }
      throw new Error(`Gemini TTS refused this take (${res.status}): ${msg}`);
    }
    const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      throw new Error("Gemini returned no audio for this line.");
    }
    const rate = Number(part.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
    return { pcm: Buffer.from(part.inlineData.data, "base64"), rate };
  }
  throw new Error("Gemini TTS exhausted retries.");
}

async function encodePcmToTarget(pcm: Buffer, rate: number, target: string): Promise<{ output: string; duration: number }> {
  const raw = target.replace(/\.\w+$/, "") + ".pcm";
  writeFileSync(raw, pcm);
  await run(FFMPEG, [
    "-y", "-f", "s16le", "-ar", String(rate), "-ac", "1", "-i", raw,
    "-af", "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", target,
  ]);
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", target]);
  const duration = Number(stdout.trim());
  writeFileSync(raw, "");
  await run("rm", ["-f", raw]).catch(() => {});
  return { output: target, duration };
}

// Splits a multi-paragraph PCM buffer into `texts.length` slices aligned to natural silence valleys and text lengths.
function splitPcmByScenes(pcm: Buffer, rate: number, texts: string[]): Buffer[] {
  const count = texts.length;
  if (count <= 1) return [pcm];

  const totalSamples = Math.floor(pcm.length / 2);
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, totalSamples);
  const frameSize = Math.max(1, Math.floor(rate * 0.02)); // 20ms frame (480 samples at 24kHz)
  const numFrames = Math.floor(totalSamples / frameSize);
  if (numFrames < count * 5) {
    // Fallback to proportional sample split if clip is extremely short
    const weights = texts.map((t) => Math.max(1, t.trim().length));
    const totalW = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    return weights.map((w, idx) => {
      const startSample = Math.floor((acc / totalW) * totalSamples);
      acc += w;
      const endSample = idx === count - 1 ? totalSamples : Math.floor((acc / totalW) * totalSamples);
      return pcm.subarray(startSample * 2, endSample * 2);
    });
  }

  const rms = new Float32Array(numFrames);
  const activeCum = new Float32Array(numFrames + 1);
  const SILENCE_RMS = 380; // ~ -38.6 dBFS
  for (let f = 0; f < numFrames; f++) {
    let sumSq = 0;
    const base = f * frameSize;
    for (let i = 0; i < frameSize; i++) {
      const v = samples[base + i];
      sumSq += v * v;
    }
    const r = Math.sqrt(sumSq / frameSize);
    rms[f] = r;
    activeCum[f + 1] = activeCum[f] + (r >= SILENCE_RMS ? 1 : 0.05);
  }
  const totalActive = activeCum[numFrames] || 1;

  // Compute Rolling 160ms (8-frame) RMS for finding smooth pause midpoints
  const win = 8;
  const rollingRms = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    let c = 0;
    for (let k = Math.max(0, f - 4); k <= Math.min(numFrames - 1, f + 3); k++) {
      sum += rms[k];
      c++;
    }
    rollingRms[f] = sum / c;
  }

  const weights = texts.map((t) => Math.max(8, t.replace(/\s+/g, " ").trim().length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const splitFrames: number[] = [0];
  let cumWeight = 0;
  const minGapFrames = Math.max(15, Math.floor(numFrames / (count * 3))); // at least ~300ms per scene

  for (let i = 0; i < count - 1; i++) {
    cumWeight += weights[i];
    const targetActive = (cumWeight / totalWeight) * totalActive;
    // Find frame whose activeCum is closest to targetActive
    let targetFrame = splitFrames[i] + minGapFrames;
    for (let f = splitFrames[i] + minGapFrames; f < numFrames - (count - 1 - i) * minGapFrames; f++) {
      if (activeCum[f] >= targetActive) {
        targetFrame = f;
        break;
      }
    }

    const searchRadius = Math.max(25, Math.floor(numFrames / (count * 1.6)));
    const minF = Math.max(splitFrames[i] + minGapFrames, targetFrame - searchRadius);
    const maxF = Math.min(numFrames - (count - 1 - i) * minGapFrames, targetFrame + searchRadius);

    let bestFrame = targetFrame;
    let bestScore = Infinity;
    for (let f = minF; f <= maxF; f++) {
      const distPenalty = Math.abs(f - targetFrame) / Math.max(1, searchRadius);
      const silenceBonus = rollingRms[f] < SILENCE_RMS ? 0.15 : 1.0;
      const score = (rollingRms[f] + 20) * silenceBonus * (1 + 1.2 * distPenalty * distPenalty);
      if (score < bestScore) {
        bestScore = score;
        bestFrame = f;
      }
    }
    splitFrames.push(bestFrame);
  }
  splitFrames.push(numFrames);

  const fadeSamples = Math.min(360, Math.floor(rate * 0.015)); // 15ms click-free fade
  const slices: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const startSample = splitFrames[i] * frameSize;
    const endSample = i === count - 1 ? totalSamples : splitFrames[i + 1] * frameSize;
    const sliceLen = Math.max(frameSize, endSample - startSample);
    const outBuf = Buffer.alloc(sliceLen * 2);
    const outView = new Int16Array(outBuf.buffer, outBuf.byteOffset, sliceLen);
    for (let s = 0; s < sliceLen; s++) {
      let val = samples[Math.min(totalSamples - 1, startSample + s)];
      if (i > 0 && s < fadeSamples) val = Math.round(val * (s / fadeSamples));
      if (i < count - 1 && s >= sliceLen - fadeSamples) val = Math.round(val * ((sliceLen - 1 - s) / fadeSamples));
      outView[s] = val;
    }
    slices.push(outBuf);
  }
  return slices;
}

// Speaks a line with Gemini's TTS. Free tier, no Flow credits, no length cap, and the same voices Flow uses.
export async function speakWithGemini(text: string, voice: string, target: string, style?: string): Promise<{ output: string; duration: number }> {
  const key = requireKey();
  const prompt = buildStylePrompt(text, style, false);
  const { pcm, rate } = await fetchGeminiPcm(prompt, voice, key);
  return encodePcmToTarget(pcm, rate, target);
}

interface BatchState {
  running: boolean;
  error?: string;
  promise?: Promise<void>;
}

const activeBatches = new Map<string, BatchState>();

// Speaks an entire story's scenes in chunks with Gemini TTS, saving narration-01.m4a .. narration-NN.m4a.
// Supports polling: returns after `timeoutSeconds` with `{ finished, completed, total, files }` and continues in background.
export async function speakBatchWithGemini(opts: {
  outputDir: string;
  scenes: string[];
  voice: string;
  style?: string;
  chunkSize?: number;
  timeoutSeconds?: number;
}): Promise<{
  output_dir: string;
  finished: boolean;
  completed: number;
  total: number;
  voice: string;
  style?: string;
  files: (string | null)[];
  error?: string;
}> {
  const key = requireKey();
  const { outputDir, scenes, voice, style, chunkSize = 5, timeoutSeconds = 40 } = opts;
  mkdirSync(outputDir, { recursive: true });

  const targets = scenes.map((_, idx) => join(outputDir, `narration-${String(idx + 1).padStart(2, "0")}.m4a`));
  const isDone = (file: string) => existsSync(file) && statSync(file).size > 500;

  let state = activeBatches.get(outputDir);
  if (!state || !state.running) {
    state = { running: true };
    activeBatches.set(outputDir, state);
    state.promise = (async () => {
      try {
        const size = Math.max(1, Math.min(10, chunkSize));
        for (let start = 0; start < scenes.length; start += size) {
          const chunkTexts = scenes.slice(start, start + size);
          const chunkTargets = targets.slice(start, start + size);
          if (chunkTargets.every(isDone)) continue;

          if (chunkTexts.length === 1) {
            const prompt = buildStylePrompt(chunkTexts[0], style, false);
            const { pcm, rate } = await fetchGeminiPcm(prompt, voice, key);
            await encodePcmToTarget(pcm, rate, chunkTargets[0]);
          } else {
            const joined = chunkTexts.map((t) => t.trim()).join("\n\n. . .\n\n");
            const prompt = buildStylePrompt(joined, style, true);
            const { pcm, rate } = await fetchGeminiPcm(prompt, voice, key);
            const slices = splitPcmByScenes(pcm, rate, chunkTexts);
            for (let k = 0; k < chunkTargets.length; k++) {
              await encodePcmToTarget(slices[k], rate, chunkTargets[k]);
            }
          }
          // Gentle pacing between chunk requests to respect Google AI Studio RPM limits
          if (start + size < scenes.length) {
            await new Promise((r) => setTimeout(r, 2500));
          }
        }
      } catch (err) {
        state!.error = err instanceof Error ? err.message : String(err);
      } finally {
        state!.running = false;
      }
    })();
  }

  const deadline = Date.now() + Math.max(5, timeoutSeconds) * 1000;
  while (Date.now() < deadline && state.running && !targets.every(isDone)) {
    await new Promise((r) => setTimeout(r, 1500));
  }

  const files = targets.map((t) => (isDone(t) ? t : null));
  const completed = files.filter(Boolean).length;
  const finished = completed === scenes.length || (!state.running && Boolean(state.error));
  if (state.error && completed < scenes.length) {
    throw new Error(`Gemini batch TTS failed at ${completed}/${scenes.length} scenes: ${state.error}`);
  }

  return {
    output_dir: outputDir,
    finished: completed === scenes.length,
    completed,
    total: scenes.length,
    voice,
    style,
    files,
  };
}
