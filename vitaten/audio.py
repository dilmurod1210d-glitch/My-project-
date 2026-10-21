"""Synthesized 124 BPM house bed + SFX for the Vitaten sting. Writes audio_raw.wav (48 kHz stereo, 12.075 s).
Beat k = 0.048 + 0.4838*k s; drop on beat 5 (2.467 s)."""
import wave
import numpy as np

SR = 48000
DUR = 12.075
N = int(SR * DUR)
BEAT = 0.4838
B0 = 0.048
rng = np.random.default_rng(1210)
L = np.zeros(N)
R = np.zeros(N)


def bt(k):
    return B0 + BEAT * k


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N:
        return
    j = 0
    if i < 0:
        j, i = -i, 0
    n = min(len(sig) - j, N - i)
    if n <= 0:
        return
    s = sig[j:j + n] * gain
    L[i:i + n] += s * np.sqrt(0.5 * (1 - pan))
    R[i:i + n] += s * np.sqrt(0.5 * (1 + pan))


def tt(d):
    return np.arange(int(d * SR)) / SR


def bandnoise(d, lo, hi, seed=0):
    n = int(d * SR)
    x = np.random.default_rng(seed).standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n)
    return y / (np.abs(y).max() + 1e-9)


def lowpass(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------------- music ----------------
DROP = bt(5)

def kick():
    t = tt(0.42)
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + 0.25 * bandnoise(0.42, 1500, 6000, 3) * np.exp(-t * 180)


def hat(open_=False, seed=0):
    d = 0.22 if open_ else 0.05
    t = tt(d)
    return bandnoise(d, 7000, 16000, seed) * np.exp(-t * (16 if open_ else 90))


def clap(seed=0):
    t = tt(0.25)
    env = np.exp(-t * 22) + 0.6 * np.exp(-((t - 0.012) % 0.011) * 400) * (t < 0.03)
    return bandnoise(0.25, 900, 5000, seed) * env


def pluck_chord(notes, d, bright=1.0):
    t = tt(d)
    y = np.zeros_like(t)
    for m in notes:
        f = mtof(m)
        for h in range(1, 7):
            y += np.sin(2 * np.pi * f * h * t + h) / h ** (1.6 / bright) * np.exp(-t * (5 + h * 1.6))
    return y / len(notes)


def pad(notes, d):
    t = tt(d)
    y = np.zeros_like(t)
    for m in notes:
        for det in (-0.08, 0.0, 0.07):
            f = mtof(m + det)
            y += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t + 0.5)
    att = np.clip(t / 0.35, 0, 1)
    rel = np.clip((d - t) / 0.4, 0, 1)
    return lowpass(y, 2400) * att * rel / (len(notes) * 3)


def bass(m, d):
    t = tt(d)
    f = mtof(m)
    y = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return y * np.clip(t / 0.006, 0, 1) * np.exp(-t * 6)


# one chord per bar (4 beats): F maj9, D m9, Bb maj7, C add9
CH = [[53, 57, 60, 64, 67], [50, 57, 60, 64, 65], [46, 57, 62, 65, 69], [48, 55, 62, 64, 67]]
ROOT = [41, 38, 34, 36]

# intro pads (soft, filtered) beats 0..5
add(lowpass(pad(CH[0], DROP + 0.3), 1200), 0.0, 0.55)
for k in range(1, 5):
    add(hat(False, k), bt(k) + BEAT / 2, 0.06 + 0.015 * k, 0.3)

# riser into the drop
t = tt(1.6)
add(bandnoise(1.6, 2000, 12000, 7) * (t / 1.6) ** 3, DROP - 1.6, 0.18)

last_beat = int((DUR - B0) / BEAT) + 1
for k in range(5, last_beat + 1):
    bar = (k - 5) // 4
    c = CH[bar % 4]
    # end card section from 10.043 s: kick drops out, pad + plucks only
    endcard = bt(k) >= 10.0
    if not endcard:
        add(kick(), bt(k), 0.95)
        add(hat(True, 100 + k), bt(k) + BEAT / 2, 0.16, 0.25)
        add(hat(False, 200 + k), bt(k) + BEAT * 0.25, 0.07, -0.35)
        add(hat(False, 300 + k), bt(k) + BEAT * 0.75, 0.07, 0.35)
        if (k - 5) % 2 == 1:
            add(clap(400 + k), bt(k), 0.32, -0.1)
        add(bass(ROOT[bar % 4], BEAT * 0.45), bt(k) + BEAT / 2, 0.55)
    # chord stabs on the off-beat-and (classic house)
    add(pluck_chord(c, 0.5, 1.2), bt(k) + BEAT * 0.5, 0.22 if not endcard else 0.16, -0.2)
    if (k - 5) % 4 == 0:
        add(pad(c, BEAT * 4 + 0.4), bt(k), 0.32 if not endcard else 0.42)

# ---------------- SFX ----------------
def impact():
    t = tt(0.9)
    f = 70 * np.exp(-t * 1.5) + 30
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4) + 0.3 * bandnoise(0.9, 80, 900, 11) * np.exp(-t * 9)


def whoosh(peak, d1=0.45, d2=0.25, seed=0, lo=500, hi=9000):
    d = d1 + d2
    t = tt(d)
    x = bandnoise(d, lo, hi, seed)
    env = np.where(t < d1, (t / d1) ** 2.4, np.exp(-(t - d1) * 12))
    # sweep: blend dark → bright towards the peak
    dark = lowpass(x, 1400)
    y = dark * (1 - env) * env + x * env ** 2
    return y, peak - d1


def hit():
    t = tt(1.4)
    k = np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-t * 26)) / SR) * np.exp(-t * 5)
    body = bandnoise(1.4, 200, 5000, 21) * np.exp(-t * 14)
    tone = sum(np.sin(2 * np.pi * mtof(m) * t) for m in (65, 72, 77)) / 3 * np.exp(-t * 3)
    return k * 0.9 + body * 0.35 + tone * 0.25


def click():
    t = tt(0.03)
    return bandnoise(0.03, 2500, 9000, 31) * np.exp(-t * 400) + 0.5 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 250)


def tick(seed):
    t = tt(0.012)
    return bandnoise(0.012, 3000, 11000, seed) * np.exp(-t * 700)


def shimmer():
    t = tt(1.8)
    y = sum(np.sin(2 * np.pi * mtof(m) * t + i) * (1 + 0.4 * np.sin(2 * np.pi * (5 + i) * t)) for i, m in enumerate((84, 88, 91, 96)))
    return y / 4 * np.clip(t / 0.04, 0, 1) * np.exp(-t * 2.2) + 0.15 * bandnoise(1.8, 9000, 16000, 41) * np.exp(-t * 4)


add(impact(), 0.10, 0.55)
for i, p in enumerate((2.402, 3.370, 5.305, 10.043)):
    w, start = whoosh(p, seed=50 + i)
    add(w, start, 0.38, (-0.4, 0.4, 0.0, 0.0)[i])
add(hit(), 6.240, 0.6)
add(hit(), 8.175, 0.6)
add(click(), 2.33, 0.45, 0.1)
add(click(), 3.83, 0.45, 0.1)
tk = 4.04
i = 0
while tk <= 5.0:
    add(tick(60 + i), tk, 0.035 * (0.8 + 0.4 * rng.random()), 0.15)
    tk += 0.032 * (0.85 + 0.3 * rng.random())
    i += 1
add(shimmer(), 10.05, 0.3)

# light room reverb
ir_t = tt(1.2)
ir = np.random.default_rng(5).standard_normal(len(ir_t)) * np.exp(-ir_t * 4.5)
ir[0] = 0
for ch in (L, R):
    M = len(ch) + len(ir)
    wet = np.fft.irfft(np.fft.rfft(ch, M) * np.fft.rfft(ir, M), M)[:len(ch)]
    ch += wet * 0.012

st = np.stack([L, R], 1)
st /= np.abs(st).max() / 0.7
pcm = (np.clip(st, -1, 1) * 32767).astype('<i2')
with wave.open('audio_raw.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', N / SR, 's')
