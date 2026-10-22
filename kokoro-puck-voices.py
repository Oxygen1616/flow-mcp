from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro


MODEL_DIR = Path(r"C:\Users\Kasutaja\.flow-mcp\kokoro")
OUT_DIR = Path(r"C:\Users\Kasutaja\flow-mcp-out\FrankFeldmanComedyShort")

LINES = [
    ("puck-01.wav", "Perfect timing. You're just like Frank Feldman."),
    ("puck-02.wav", "Who?"),
    (
        "puck-03.wav",
        "The perfect man! Athlete, singer, dancer, pianist. Computer memory. Wine expert. "
        "Fixed anything. Beat traffic. Never argued. Never made a mistake.",
    ),
    ("puck-04.wav", "Wow. How did you meet him?"),
    ("puck-05.wav", "I never did. Frank died... and I married his wife."),
]

kokoro = Kokoro(str(MODEL_DIR / "kokoro-v1.0.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))
OUT_DIR.mkdir(parents=True, exist_ok=True)

for filename, text in LINES:
    samples, sample_rate = kokoro.create(text, voice="am_puck", speed=0.85, lang="en-us")
    target = OUT_DIR / filename
    sf.write(target, samples, sample_rate)
    print(f"{target}\t{len(samples) / sample_rate:.3f}s")
