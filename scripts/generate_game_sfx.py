"""Generate the Artikel Runner SFX set as 16-bit mono WAVs (stdlib only).

Usage: python scripts/generate_game_sfx.py
Writes into godot-runner/Assets/SFX/.
"""
import math
import os
import random
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "godot-runner", "Assets", "SFX")


def write_wav(name, samples):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    peak = max(1e-9, max(abs(s) for s in samples))
    norm = 0.85 / peak if peak > 0.85 else 1.0
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s * norm)) * 32767))
            for s in samples
        )
        w.writeframes(frames)
    print(f"wrote {path} ({len(samples)/SR*1000:.0f} ms)")


def env(i, n, attack=0.005, release=0.4):
    """Attack/decay envelope; release is the fraction of n spent decaying."""
    t = i / n
    a = min(1.0, (i / SR) / attack) if attack > 0 else 1.0
    r = 1.0
    rel_start = 1.0 - release
    if t > rel_start:
        r = max(0.0, 1.0 - (t - rel_start) / release)
    return a * r * r


def tone(freq, dur, vol=1.0, shape="sine", detune=0.0):
    n = int(SR * dur)
    out = []
    ph = ph2 = 0.0
    for i in range(n):
        ph += 2 * math.pi * freq / SR
        ph2 += 2 * math.pi * freq * (1 + detune) / SR
        if shape == "sine":
            s = math.sin(ph)
        elif shape == "tri":
            s = 2 / math.pi * math.asin(math.sin(ph))
        elif shape == "saw":
            s = 2 * ((ph / (2 * math.pi)) % 1.0) - 1.0
        else:
            s = math.copysign(1.0, math.sin(ph))
        if detune:
            s = 0.6 * s + 0.4 * math.sin(ph2)
        out.append(s * vol * env(i, n, 0.004, 0.55))
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] if i < len(t) else 0.0 for t in tracks) for i in range(n)]


def offset(track, sec):
    return [0.0] * int(SR * sec) + track


def coin():
    # Bright two-step ding: B5 -> E6, very short
    a = tone(988, 0.07, 0.8)
    b = offset(tone(1319, 0.11, 0.9), 0.045)
    return mix(a, b)


def correct():
    # Cheerful major arpeggio with a sparkle on top
    notes = [(523, 0.0), (659, 0.07), (784, 0.14), (1047, 0.21)]
    tracks = [offset(tone(f, 0.16, 0.7, "tri"), t) for f, t in notes]
    tracks.append(offset(tone(2093, 0.18, 0.25), 0.24))
    return mix(*tracks)


def wrong():
    # Soft descending womp (not harsh): two detuned lows
    n = int(SR * 0.34)
    out = []
    for i in range(n):
        t = i / n
        f = 240 - 90 * t
        ph = 2 * math.pi * f * i / SR
        s = 0.7 * math.sin(ph) + 0.3 * math.sin(ph * 2.01)
        out.append(s * env(i, n, 0.008, 0.5))
    return out


def whoosh():
    n = int(SR * 0.16)
    out = []
    lp = 0.0
    rnd = random.Random(7)
    for i in range(n):
        t = i / n
        # filtered noise with rising-then-falling cutoff
        cut = 0.12 + 0.5 * math.sin(math.pi * t)
        lp += cut * (rnd.uniform(-1, 1) - lp)
        out.append(lp * math.sin(math.pi * t))
    return out


def crash():
    rnd = random.Random(3)
    n = int(SR * 0.30)
    out = []
    lp = 0.0
    for i in range(n):
        lp += 0.35 * (rnd.uniform(-1, 1) - lp)
        thump = 0.8 * math.sin(2 * math.pi * (90 - 40 * i / n) * i / SR)
        out.append((0.7 * lp + thump) * env(i, n, 0.002, 0.7))
    return out


def land():
    rnd = random.Random(11)
    n = int(SR * 0.09)
    out = []
    lp = 0.0
    for i in range(n):
        lp += 0.25 * (rnd.uniform(-1, 1) - lp)
        thud = 0.6 * math.sin(2 * math.pi * 120 * i / SR)
        out.append((0.5 * lp + thud) * env(i, n, 0.001, 0.8))
    return out


def jump():
    # Quick rising chirp
    n = int(SR * 0.13)
    out = []
    ph = 0.0
    for i in range(n):
        f = 300 + 380 * (i / n)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * env(i, n, 0.003, 0.45) * 0.8)
    return out


if __name__ == "__main__":
    write_wav("coin.wav", coin())
    write_wav("correct.wav", correct())
    write_wav("wrong.wav", wrong())
    write_wav("whoosh.wav", whoosh())
    write_wav("crash.wav", crash())
    write_wav("land.wav", land())
    write_wav("jump.wav", jump())
