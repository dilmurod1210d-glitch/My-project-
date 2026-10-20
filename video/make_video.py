import math, subprocess, wave, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DUR = 1080, 1920, 30, 30.0
D = __import__("os").path.dirname(__import__("os").path.abspath(__file__)) + "/"
OUT = sys.argv[1]
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
YELLOW, GREEN, WHITE, NAVY = (255, 214, 64), (122, 201, 67), (255, 255, 255), (12, 52, 130)

_fonts = {}
def font(size, bold=True):
    k = (size, bold)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(BOLD if bold else REG, size)
    return _fonts[k]

# ---------- background ----------
def make_bg():
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    top, bot = np.array([10, 45, 120]), np.array([40, 150, 235])
    t = np.clip(y * 0.85 + x * 0.15, 0, 1)[..., None]
    arr = (top * (1 - t) + bot * t).astype(np.uint8)
    img = Image.fromarray(arr).convert("RGBA")
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for i, (a, b) in enumerate([(-200, 700), (300, 1500), (700, 1900)]):
        d.polygon([(a, H), (a + 900, 0), (a + 1250, 0), (a + 350, H)], fill=(255, 255, 255, 14 + 6 * i))
    return Image.alpha_composite(img, ov)
BG = make_bg()

# soft floating particles
rng = np.random.default_rng(3)
PARTS = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(6, 22), rng.uniform(20, 60), rng.uniform(0, 6.28)) for _ in range(26)]

# ---------- assets ----------
box = Image.open(D + "box_rgba.png")
def glow(img, rad=40, color=(255, 255, 255), alpha=150):
    pad = rad * 2
    g = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    a = img.split()[3]
    m = Image.new("L", g.size, 0); m.paste(a, (pad, pad))
    m = m.filter(ImageFilter.GaussianBlur(rad)).point(lambda v: min(255, int(v * alpha / 255 * 1.6)))
    g = Image.new("RGBA", g.size, color + (0,)); g.putalpha(m)
    g.alpha_composite(img, (pad, pad))
    return g
BOX_BIG = glow(box.resize((int(box.width * 1.45), int(box.height * 1.45)), Image.LANCZOS))
BOX_SMALL = glow(box.resize((int(box.width * 1.2), int(box.height * 1.2)), Image.LANCZOS), 30)

_txt = {}
def text_img(s, size, color=WHITE, bold=True, shadow=True):
    k = (s, size, color, bold)
    if k in _txt:
        return _txt[k]
    f = font(size, bold)
    l, t, r, b = f.getbbox(s)
    w, h = r - l + 20, b - t + 20
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shadow:
        sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((10 - l + 3, 10 - t + 5), s, font=f, fill=(0, 20, 60, 150))
        im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4)))
    d.text((10 - l, 10 - t), s, font=f, fill=color)
    _txt[k] = im
    return im

def pill(s, size, bg, fg=WHITE, padx=34, pady=18):
    k = ("pill", s, size, bg, fg)
    if k in _txt:
        return _txt[k]
    f = font(size)
    l, t, r, b = f.getbbox(s)
    w, h = r - l + padx * 2, b - t + pady * 2
    im = Image.new("RGBA", (w + 16, h + 16), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((8, 12, w + 8, h + 12), h // 2, fill=(0, 20, 60, 110))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((8, 8, w + 8, h + 8), h // 2, fill=bg)
    d.text((8 + padx - l, 8 + pady - t), s, font=f, fill=fg)
    _txt[k] = im
    return im

def person_icon(color, kid=False, cane=False):
    s = 1.0
    im = Image.new("RGBA", (220, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((75, 20, 145, 90), fill=color)
    d.rounded_rectangle((55, 100, 165, 230), 45, fill=color)
    d.rounded_rectangle((70, 200, 100, 290), 14, fill=color)
    d.rounded_rectangle((120, 200, 150, 290), 14, fill=color)
    if cane:
        d.line((185, 150, 185, 292), fill=(120, 80, 40), width=12)
        d.arc((160, 130, 205, 175), 180, 360, fill=(120, 80, 40), width=12)
    return im

# ---------- helpers ----------
def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3

def put(frame, img, cx, cy, alpha=1.0, scale=1.0, dy=0):
    if alpha <= 0.01:
        return
    if abs(scale - 1) > 0.01:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BILINEAR)
    if alpha < 0.99:
        img = img.copy()
        a = img.split()[3].point(lambda v: int(v * alpha))
        img.putalpha(a)
    frame.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2 + dy)))

def appear(t, start, dur=0.6, rise=60):
    """alpha and y-offset for an element appearing at `start`."""
    e = ease((t - start) / dur)
    return e, (1 - e) * rise

def scene_alpha(t, a, b, fade=0.45):
    if t < a or t > b:
        return 0.0
    return min(1.0, (t - a) / fade if a > 0 else 1.0, (b - t) / fade if b < DUR else 1.0)

SCENES = [(0, 4.6), (4.4, 10.2), (10.0, 15.8), (15.6, 21.2), (21.0, 25.8), (25.6, 30.0)]

VITS = ["Витамин A", "Витамин B2", "Витамин B3", "Витамин B5", "Витамин B6", "Витамин B9",
        "Витамин B12", "Витамин C", "Витамин D3", "Витамин E", "L-карнитин", "L-аргинин",
        "Селен", "Калий йодид", "Темир", "Кальций", "Рух", "Магний"]

def draw_scene(i, t, layer):
    if i == 0:
        lines = ["Ҳар бир кун", "куч ва ғайрат", "талаб қилади…"]
        for k, s in enumerate(lines):
            a, dy = appear(t, 0.2 + k * 0.55)
            put(layer, text_img(s, 96), W / 2, 640 + k * 130, a, dy=dy)
        a, dy = appear(t, 2.4)
        put(layer, pill("Организмингизга ёрдам керакми?", 46, YELLOW, NAVY), W / 2, 1120, a, dy=dy)
    elif i == 1:
        lt = t - 4.4
        a, dy = appear(lt, 0.0)
        put(layer, text_img("MEGAVIT", 54, WHITE), W / 2, 250, a, dy=dy)
        e = ease(lt / 1.2)
        float_y = math.sin(lt * 1.6) * 10
        put(layer, BOX_BIG, W / 2, 890 + float_y, e, scale=0.75 + 0.25 * e)
        a, dy = appear(lt, 1.0)
        put(layer, text_img("ВИТАТЕН", 130, WHITE), W / 2, 1500, a, dy=dy)
        a, dy = appear(lt, 1.5)
        put(layer, text_img("мультивитаминли сироп", 56, YELLOW), W / 2, 1620, a, dy=dy)
    elif i == 2:
        lt = t - 10.0
        a, dy = appear(lt, 0.0)
        put(layer, text_img("18 та", 120, YELLOW), W / 2, 330, a, dy=dy)
        put(layer, text_img("витамин ва минерал", 70, WHITE), W / 2, 460, a, dy=dy)
        for k, s in enumerate(VITS):
            col, row = k % 2, k // 2
            a, dy = appear(lt, 0.5 + k * 0.12, 0.4, 30)
            put(layer, pill(s, 38, (255, 255, 255), NAVY, 26, 12), W / 2 + (-230 if col == 0 else 230), 600 + row * 92, a, dy=dy)
        e = ease((lt - 3.2) / 0.5)
        if e > 0:
            pop = 1 + 0.15 * math.sin(min(1, (lt - 3.2) / 0.5) * math.pi)
            put(layer, pill("ШАКАРСИЗ", 70, GREEN, WHITE, 50, 22), W / 2, 1470, e, scale=pop)
    elif i == 3:
        lt = t - 15.6
        a, dy = appear(lt, 0.0)
        put(layer, text_img("Ўзбекистонда", 96, WHITE), W / 2, 400, a, dy=dy)
        put(layer, text_img("ишлаб чиқарилган", 80, YELLOW), W / 2, 520, a, dy=dy)
        items = ["✔ Сертификатланган маҳсулот", "✔ Замонавий ишлаб чиқариш", "✔ Қатъий сифат назорати"]
        for k, s in enumerate(items):
            a, dy = appear(lt, 0.9 + k * 0.6, 0.5, 40)
            put(layer, pill(s, 48, (255, 255, 255), NAVY, 40, 22), W / 2, 760 + k * 170, a, dy=dy)
        a, dy = appear(lt, 2.9)
        put(layer, text_img("«MEGAVITFARM» МЧЖ · Андижон вилояти", 38, WHITE, bold=False), W / 2, 1330, a, dy=dy)
    elif i == 4:
        lt = t - 21.0
        a, dy = appear(lt, 0.0)
        put(layer, text_img("Бутун оила учун", 100, WHITE), W / 2, 380, a, dy=dy)
        people = [("Аёллар", (238, 112, 40), False), ("Эркаклар", (30, 110, 200), False), ("Кексалар", (122, 170, 60), True)]
        for k, (name, c, cane) in enumerate(people):
            a, dy = appear(lt, 0.6 + k * 0.45, 0.5, 50)
            x = W / 2 + (k - 1) * 330
            card = _txt.get(("card", k))
            if card is None:
                card = Image.new("RGBA", (290, 470), (0, 0, 0, 0))
                ImageDraw.Draw(card).rounded_rectangle((0, 0, 289, 469), 40, fill=(255, 255, 255, 235))
                ic = person_icon(c, cane=cane)
                card.alpha_composite(ic, (35, 40))
                tl = text_img(name, 44, NAVY, shadow=False)
                card.alpha_composite(tl, ((290 - tl.width) // 2, 375))
                _txt[("card", k)] = card
            put(layer, card, x, 900, a, dy=dy)
        a, dy = appear(lt, 2.3)
        put(layer, text_img("ишончли танлов", 64, YELLOW), W / 2, 1300, a, dy=dy)
    elif i == 5:
        lt = t - 25.6
        e = ease(lt / 0.9)
        put(layer, BOX_SMALL, W / 2, 720 + math.sin(lt * 1.6) * 8, e, scale=0.85 + 0.15 * e)
        a, dy = appear(lt, 0.5)
        put(layer, text_img("ВИТАТЕН", 110, WHITE), W / 2, 1230, a, dy=dy)
        a, dy = appear(lt, 0.9)
        put(layer, text_img("бутун оиланинг ҳар кунги ёрдамчиси", 44, WHITE, bold=False), W / 2, 1330, a, dy=dy)
        e2 = ease((lt - 1.4) / 0.5)
        if e2 > 0:
            pulse = 1 + 0.03 * math.sin(lt * 5)
            put(layer, pill("Дорихоналарда сўранг!", 58, YELLOW, NAVY, 50, 24), W / 2, 1460, e2, scale=pulse)

DISC1 = text_img("Дори воситаси эмас.", 30, WHITE, bold=False)
DISC2 = text_img("Қўллашдан олдин мутахассис билан маслаҳатлашинг.", 30, WHITE, bold=False)

def render(t):
    fr = BG.copy()
    pl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pl)
    for (x, y, r, sp, ph) in PARTS:
        yy = (y - t * sp) % H
        xx = x + math.sin(t * 0.7 + ph) * 20
        pd.ellipse((xx - r, yy - r, xx + r, yy + r), fill=(255, 255, 255, 38))
    fr.alpha_composite(pl)
    for i, (a, b) in enumerate(SCENES):
        sa = scene_alpha(t, a, b)
        if sa <= 0:
            continue
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw_scene(i, t, layer)
        if sa < 0.99:
            layer.putalpha(layer.split()[3].point(lambda v: int(v * sa)))
        fr.alpha_composite(layer)
    put(fr, DISC1, W / 2, 1720)
    put(fr, DISC2, W / 2, 1762)
    return fr.convert("RGB")

# ---------- music ----------
def make_music(path):
    sr = 44100
    n = int(sr * DUR)
    tt = np.arange(n) / sr
    out = np.zeros(n)
    def note(f):
        return 440 * 2 ** ((f - 69) / 12)
    chords = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]]  # C Am F G
    cl = DUR / 8
    for ci in range(8):
        ch = chords[ci % 4]
        s, e = int(ci * cl * sr), int(min(DUR, (ci + 1) * cl + 0.6) * sr)
        seg = tt[s:e] - ci * cl
        env = np.minimum(1, seg / 0.8) * np.minimum(1, np.maximum(0, (cl + 0.6 - seg) / 0.8))
        for m in ch:
            f = note(m)
            out[s:e] += 0.05 * env * (np.sin(2 * np.pi * f * seg) + 0.3 * np.sin(2 * np.pi * 2 * f * seg + 0.3))
        # arpeggio (piano-like plucks)
        arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 24, ch[3] + 12]
        step = cl / 6
        for k, m in enumerate(arp):
            st = int((ci * cl + k * step) * sr)
            ln = min(int(1.6 * sr), n - st)
            if ln <= 0:
                continue
            x = np.arange(ln) / sr
            f = note(m)
            out[st:st + ln] += 0.07 * np.exp(-x * 3) * (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(4 * np.pi * f * x) * np.exp(-x * 5))
    # simple reverb-ish echo
    for dl, g in [(0.23, 0.3), (0.41, 0.18)]:
        k = int(dl * sr)
        out[k:] += g * out[:-k]
    fade = np.minimum(1, tt / 1.0) * np.minimum(1, (DUR - tt) / 2.0)
    out *= fade
    out = out / np.max(np.abs(out)) * 0.6
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((out * 32767).astype(np.int16).tobytes())

if __name__ == "__main__":
    make_music(D + "music.wav")
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", D + "music.wav",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                          "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT],
                         stdin=subprocess.PIPE)
    for f in range(int(DUR * FPS)):
        p.stdin.write(render(f / FPS).tobytes())
    p.stdin.close(); p.wait()
    for ts in [2.5, 8, 14, 19.5, 24.5, 29]:
        render(ts).save(D + f"preview_{ts}.png")
