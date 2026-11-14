"""Original, fully synthesized background score for the BASELINE launch videos.

No samples or third-party audio: every sound is generated here from sine partials.
Usage: python3 gen_score.py <seconds> <out.wav> [bpm] [seed]
"""
import sys
import wave

import numpy as np

SR = 48000
dur = float(sys.argv[1])
out = sys.argv[2]
bpm = float(sys.argv[3]) if len(sys.argv) > 3 else 84
rng = np.random.default_rng(int(sys.argv[4]) if len(sys.argv) > 4 else 7)

n = int(dur * SR)
L = np.zeros(n)
R = np.zeros(n)
t_all = np.arange(n) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# D major colour: Dmaj9 – Bm7 – Gmaj7 – Asus
CHORDS = [
    [50, 57, 62, 66, 69, 76],
    [47, 54, 59, 62, 66, 69],
    [43, 50, 55, 59, 62, 66],
    [45, 52, 57, 62, 64, 69],
]
beat = 60.0 / bpm
bar = beat * 4


def add(sig, start, pan=0.0):
    i0 = max(0, int(start * SR))
    if i0 >= n:
        return
    seg = sig[: n - i0]
    L[i0 : i0 + len(seg)] += seg * np.sqrt(0.5 * (1 - pan))
    R[i0 : i0 + len(seg)] += seg * np.sqrt(0.5 * (1 + pan))


def pad_note(f, length):
    m = int(length * SR)
    t = np.arange(m) / SR
    env = np.minimum(1, t / 1.6) * np.minimum(1, (length - t) / 1.8).clip(0, 1)
    s = sum(np.sin(2 * np.pi * f * d * t + rng.uniform(0, 6.28)) for d in (0.997, 1.0, 1.003))
    s += 0.18 * np.sin(2 * np.pi * 2 * f * t)
    return s * env * 0.05


def pluck(f, length=2.6, vel=1.0):
    m = int(length * SR)
    t = np.arange(m) / SR
    env = np.exp(-t * 2.4) * np.minimum(1, t / 0.006)
    s = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 5)
    return s * env * 0.16 * vel


bars = int(np.ceil(dur / bar)) + 1
for b in range(bars):
    ch = CHORDS[b % 4]
    start = b * bar
    for k, m in enumerate(ch[:4]):
        add(pad_note(midi(m), bar + 1.8), start, pan=(k - 1.5) * 0.25)
    # sparse arpeggio: on beats 1, 2.5, 3, 4 (with gentle humanised timing/velocity)
    pattern = [(0, 4), (1.5, 5), (2, 3), (3, 4)]
    if b % 2 == 1:
        pattern = [(0, 5), (1, 4), (2.5, 3), (3.5, 5)]
    for pos, idx in pattern:
        when = start + pos * beat + rng.normal(0, 0.008)
        add(pluck(midi(ch[idx] + 12), vel=rng.uniform(0.75, 1.0)), when, pan=rng.uniform(-0.35, 0.35))
    # soft low root
    add(pluck(midi(ch[0] - 12), length=bar, vel=0.9) * 0.9, start)

# simple stereo room: two feedback-free taps
for d, g in ((0.173, 0.22), (0.291, 0.15)):
    k = int(d * SR)
    L[k:] += R[:-k] * g
    R[k:] += L[:-k] * g

# gentle one-pole low-pass for warmth
def lowpass(x, fc=5200):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(0, len(x), 4096):
        blk = x[i : i + 4096]
        out_blk = np.empty_like(blk)
        for j, v in enumerate(blk):
            acc = (1 - a) * v + a * acc
            out_blk[j] = acc
        y[i : i + 4096] = out_blk
    return y


try:
    from scipy.signal import lfilter  # type: ignore

    a = np.exp(-2 * np.pi * 5200 / SR)
    L = lfilter([1 - a], [1, -a], L)
    R = lfilter([1 - a], [1, -a], R)
except Exception:
    L = lowpass(L)
    R = lowpass(R)

fade_in = np.minimum(1, t_all / 0.6)
fade_out = np.clip((dur - t_all) / 2.2, 0, 1)
L *= fade_in * fade_out
R *= fade_in * fade_out
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * 0.7, R / peak * 0.7

data = (np.stack([L, R], axis=1) * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print("wrote", out, f"{dur:.2f}s")
