"""Speaks one line with Kokoro (local, free, no network). Called by src/kokoro.ts.

usage: kokoro_speak.py <model_dir> <text_file> <out_wav> <voice> <speed>
The text comes from a file, never the command line, so quotes and symbols in it cannot break anything.
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


class FloatSpeed:
    """kokoro-onnx 0.4.7 builds `speed` as int32 for the newer model export, which this model rejects (it wants float32),
    and the int cast also turns 0.85 into 0 (negative durations). The session is wrapped so the speed the caller asked
    for is sent as float32; the installed package is left as it is."""

    def __init__(self, session, speed):
        self._session = session
        self._speed = np.array([speed], dtype=np.float32)

    def get_inputs(self):
        return self._session.get_inputs()

    def run(self, output_names, input_feed, *args):
        if "speed" in input_feed:
            input_feed = {**input_feed, "speed": self._speed}
        return self._session.run(output_names, input_feed, *args)


model_dir, text_file, out_wav, voice, speed = sys.argv[1:6]
text = Path(text_file).read_text(encoding="utf-8").strip()
kokoro = Kokoro(str(Path(model_dir) / "kokoro-v1.0.onnx"), str(Path(model_dir) / "voices-v1.0.bin"))
kokoro.sess = FloatSpeed(kokoro.sess, float(speed))
samples, rate = kokoro.create(text, voice=voice, speed=float(speed), lang="en-us")
sf.write(out_wav, samples, rate)
print(f"{len(samples) / rate:.3f}")
