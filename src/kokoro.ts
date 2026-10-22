import { execFile } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { HOME_DIR } from "./chrome.js";

const run = promisify(execFile);
const FFMPEG = process.env.FLOW_MCP_FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FLOW_MCP_FFPROBE ?? "ffprobe";
// Python with kokoro_onnx and soundfile installed. Windows usually has "python", Macs often "python3".
const PYTHON = process.env.FLOW_MCP_PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const MODEL_DIR = process.env.FLOW_MCP_KOKORO_DIR ?? join(HOME_DIR, "kokoro");
const SCRIPT = fileURLToPath(new URL("../scripts/kokoro_speak.py", import.meta.url));

// Kokoro v1.0 voices. "a" = American, "b" = British; f = female, m = male. am_puck is the one used for comedy narration.
export const KOKORO_VOICES = [
  { name: "am_puck", description: "American male, playful" }, { name: "am_michael", description: "American male, warm" },
  { name: "am_adam", description: "American male" }, { name: "am_eric", description: "American male" },
  { name: "am_fenrir", description: "American male, deep" }, { name: "am_liam", description: "American male" },
  { name: "am_onyx", description: "American male, low" }, { name: "am_echo", description: "American male" },
  { name: "am_santa", description: "American male, jolly" },
  { name: "af_heart", description: "American female, warm" }, { name: "af_bella", description: "American female" },
  { name: "af_nicole", description: "American female" }, { name: "af_sarah", description: "American female" },
  { name: "af_sky", description: "American female" }, { name: "af_nova", description: "American female" },
  { name: "af_aoede", description: "American female" }, { name: "af_kore", description: "American female" },
  { name: "af_alloy", description: "American female" }, { name: "af_jessica", description: "American female" },
  { name: "af_river", description: "American female" },
  { name: "bm_george", description: "British male" }, { name: "bm_daniel", description: "British male" },
  { name: "bm_fable", description: "British male" }, { name: "bm_lewis", description: "British male" },
  { name: "bf_emma", description: "British female" }, { name: "bf_alice", description: "British female" },
  { name: "bf_isabella", description: "British female" }, { name: "bf_lily", description: "British female" },
];

export const kokoroReady = (): boolean => existsSync(join(MODEL_DIR, "kokoro-v1.0.onnx")) && existsSync(join(MODEL_DIR, "voices-v1.0.bin"));

// Speaks a line with Kokoro on this computer: free, no key, no network, no length cap. Output matches the other
// engines (48 kHz stereo m4a, loudness-normalised), so flow_assemble can use it unchanged.
export async function speakWithKokoro(text: string, voice: string, target: string, speed = 0.85): Promise<{ output: string; duration: number }> {
  if (!kokoroReady()) {
    throw new Error(
      `Kokoro's model is not in ${MODEL_DIR}. It needs kokoro-v1.0.onnx and voices-v1.0.bin there (about 330 MB, one time).`,
    );
  }
  const stem = target.replace(/\.\w+$/, "");
  const raw = stem + ".wav";
  const textFile = stem + ".line.txt";
  writeFileSync(textFile, text, "utf8");
  try {
    await run(PYTHON, [SCRIPT, MODEL_DIR, textFile, raw, voice, String(speed)], { timeout: 300_000 }).catch((err: NodeJS.ErrnoException & { stderr?: string }) => {
      throw new Error(`Kokoro could not speak this line. Is Python with kokoro-onnx and soundfile installed? (${(err.stderr ?? err.message).trim().split("\n").pop()})`);
    });
    await run(FFMPEG, ["-y", "-i", raw, "-af", "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", target]);
  } finally {
    rmSync(textFile, { force: true });
    rmSync(raw, { force: true });
  }
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", target]);
  return { output: target, duration: Number(stdout.trim()) };
}
