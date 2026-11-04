"""Builds timeline.json (subtitle timings + lip-sync envelopes) and final_audio.wav
(Uzbek voice lines + synthesized background music + SFX)."""
import json, subprocess, numpy as np, wave
SR, FPS, DUR = 48000, 30, 30.0
N = int(SR * DUR)
script = json.load(open("script.json"))
lines = script["lines"]

def read_wav(p):
    with wave.open(p) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a

START, GAP = 0.55, 0.27
t = START
voice = {"M": np.zeros(N, np.float32), "S": np.zeros(N, np.float32)}
tl = []
for i, l in enumerate(lines):
    a = read_wav(f"audio/line{i:02d}.wav")
    s = int(t * SR)
    voice[l["who"]][s:s + len(a)] += a[: N - s]
    d = len(a) / SR
    tl.append({"i": i, "who": l["who"], "text": l["text"], "start": round(t, 3), "end": round(t + d, 3)})
    t += d + GAP
print("speech ends at", round(t - GAP, 2))

# lip-sync envelopes per frame
env = {}
hop = SR // FPS
for k, v in voice.items():
    fr = v[: (N // hop) * hop].reshape(-1, hop)
    rms = np.sqrt((fr ** 2).mean(1))
    rms = np.clip(rms / (np.percentile(rms[rms > 0.005], 90) + 1e-9), 0, 1.2) if (rms > 0.005).any() else rms
    env[k] = [round(float(x), 3) for x in rms]

# ---------------- music ----------------
tt = np.arange(N) / SR
BPM = 118; beat = 60 / BPM
def note(m): return 440 * 2 ** ((m - 69) / 12)
music = np.zeros(N, np.float32)
prog = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]  # Am F C G
bar = beat * 4
def adsr(n, a=0.01, r=0.2):
    e = np.ones(n, np.float32); ai = int(a * SR); ri = int(r * SR)
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
# pad
for b in range(int(DUR / bar) + 1):
    ch = prog[b % 4]; s = int(b * bar * SR); n = min(int(bar * SR), N - s)
    if n <= 0: break
    seg = tt[:n]
    sig = sum(np.sin(2 * np.pi * note(m) * seg) + 0.3 * np.sin(2 * np.pi * note(m) * 2.003 * seg) for m in ch)
    music[s:s + n] += 0.035 * sig * adsr(n, 0.3, 0.4)
    # bass
    for q in range(4):
        bs = s + int(q * beat * SR); bn = min(int(beat * SR * 0.9), N - bs)
        if bn <= 0: continue
        f = note(ch[0] - 12); x = tt[:bn]
        music[bs:bs + bn] += 0.10 * np.tanh(2 * np.sin(2 * np.pi * f * x)) * np.exp(-x * 4)
    # arp pluck (8ths)
    for q in range(8):
        ps = s + int(q * beat / 2 * SR); pn = min(int(0.3 * SR), N - ps)
        if pn <= 0: continue
        m = ch[[0, 1, 2, 3, 2, 1, 3, 2][q]] + 12; x = tt[:pn]
        music[ps:ps + pn] += 0.035 * np.sign(np.sin(2 * np.pi * note(m) * x)) * np.exp(-x * 14)
# drums
rng = np.random.default_rng(1)
for k in range(int(DUR / beat) + 1):
    s = int(k * beat * SR)
    if s >= N: break
    n = min(int(0.25 * SR), N - s); x = tt[:n]
    if k >= 8 or True:
        music[s:s + n] += 0.22 * np.sin(2 * np.pi * (50 + 120 * np.exp(-x * 30)) * x) * np.exp(-x * 9)  # kick
    hs = s + int(beat / 2 * SR); hn = min(int(0.05 * SR), N - hs)
    if hn > 0:
        music[hs:hs + hn] += 0.04 * rng.standard_normal(hn) * np.exp(-tt[:hn] * 80)
    if k % 2 == 1:
        cn = min(int(0.18 * SR), N - s)
        music[s:s + cn] += 0.07 * rng.standard_normal(cn) * np.exp(-tt[:cn] * 22)  # clap/snare
# simple highpass on noise-ish content skipped; fade in/out
fade = np.ones(N, np.float32); fade[: int(0.4 * SR)] = np.linspace(0, 1, int(0.4 * SR)); fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
music *= fade
# sidechain duck under voice
vs = np.abs(voice["M"] + voice["S"])
k = int(0.12 * SR); sm = np.convolve(vs, np.ones(k) / k, mode="same")
duck = 1 - 0.55 * np.clip(sm / 0.05, 0, 1)
music *= duck

# ---------------- sfx ----------------
sfx = np.zeros(N, np.float32)
def whoosh(at, d=0.6, g=0.12):
    s = int(at * SR); n = min(int(d * SR), N - s); x = np.linspace(0, 1, n)
    nz = rng.standard_normal(n).astype(np.float32)
    # crude band movement via moving-average of varying length
    out = np.convolve(nz, np.ones(6) / 6, mode="same") * np.sin(np.pi * x) ** 2
    sfx[s:s + n] += g * out
def pop(at, f=880, g=0.12):
    s = int(at * SR); n = min(int(0.18 * SR), N - s); x = tt[:n]
    sfx[s:s + n] += g * np.sin(2 * np.pi * f * (1 + 0.6 * np.exp(-x * 40)) * x) * np.exp(-x * 25)
def sparkle(at, g=0.05):
    for j, m in enumerate([84, 88, 91, 96, 100]):
        s = int((at + j * 0.06) * SR); n = min(int(0.5 * SR), N - s); x = tt[:n]
        sfx[s:s + n] += g * np.sin(2 * np.pi * note(m) * x) * np.exp(-x * 7)
T = {l["i"]: l for l in tl}
whoosh(0.05, 0.5)
whoosh(T[1]["start"] - 0.35)            # to browser scene
sparkle(T[2]["start"] + 0.9)            # launch
whoosh(T[3]["start"] - 0.35)            # features
c0 = T[4]["start"]; cd = T[4]["end"] - c0
for j in range(4): pop(c0 + 0.15 + j * cd * 0.22, 700 + j * 120)
whoosh(T[5]["start"] - 0.35)            # devices
pop(T[6]["start"] + T[6]["end"] - T[6]["start"] - 1.6, 1100)
whoosh(T[7]["start"] - 0.35)            # CTA
pop(T[7]["start"] + 0.9, 1300, 0.15)    # click
sparkle(T[8]["start"] + 0.2)

mix = (voice["M"] + voice["S"]) * 1.0 + music * 0.9 + sfx
mix = np.tanh(mix * 1.1) * 0.92
st = np.stack([mix, mix], 1)
with wave.open("build/final_audio.wav", "w") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
json.dump({"brand": script["brand"], "domain": script["domain"], "fps": FPS, "duration": DUR,
           "lines": tl, "env": env}, open("build/timeline.json", "w"))
print(json.dumps(tl, ensure_ascii=False, indent=0)[:1500])
