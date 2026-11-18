"""Recreate original substrate relief, paper colors and product graphics."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.asset-build/v6-textures'
SIZE = 1536
LATIN = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
ARABIC = '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf'


def noise(rng, width, height):
    values = np.uint8(np.clip(rng.normal(127, 37, (height, width)), 0, 255))
    small = Image.fromarray(values).resize((SIZE, SIZE), Image.Resampling.BICUBIC)
    return (np.asarray(small, dtype=np.float32) - 127) / 65


def material(name, rgb, roughness, seed, grain=.7, weave=0, tone=1):
    rng = np.random.default_rng(seed)
    grain_field = noise(rng, 620, 820) * .55 + noise(rng, 184, 710) * .37
    cloudy = noise(rng, 25, 32) * .32 + noise(rng, 91, 125) * .21
    trace = Image.new('L', (SIZE, SIZE), 128)
    draw = ImageDraw.Draw(trace)
    for x, y, length, tilt, contrast in zip(rng.integers(0, SIZE, 24000), rng.integers(0, SIZE, 24000),
                                           rng.integers(3, 17, 24000), rng.integers(-6, 6, 24000),
                                           rng.integers(57, 199, 24000)):
        draw.line((int(x), int(y), int(x + length), int(y + tilt)), fill=int(contrast))
    fibers = (np.asarray(trace.filter(ImageFilter.GaussianBlur(.65)), dtype=np.float32) - 128) / 46
    position = np.arange(SIZE, dtype=np.float32) * np.pi * 2 / SIZE
    texture = np.sin(position[None, :] * 100 + noise(rng, 22, 22)) * np.sin(position[:, None] * 134)
    height = grain_field * .23 + fibers * .52 + cloudy * .31 + weave * texture
    dy, dx = np.gradient(height * grain)
    normal = np.stack([-dx, dy, np.ones_like(dx)], axis=2)
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    rgb_map = np.array(rgb) + (cloudy * 5 + grain_field * 4 + fibers * 9 + texture * weave * 6)[:, :, None] * tone
    Image.fromarray(np.uint8(np.clip(rgb_map, 0, 255))).save(OUT / f'{name}-color.png')
    Image.fromarray(np.uint8((normal * .5 + .5) * 255)).save(OUT / f'{name}-normal.png')
    Image.fromarray(np.uint8(np.clip(roughness * 255 + height * 12, 0, 255))).save(OUT / f'{name}-rough.png')


def type_at(draw, at, label, fill, size, rtl=False, anchor=None):
    draw.text(at, label, font=ImageFont.truetype(ARABIC if rtl else LATIN, size), fill=fill,
              direction='rtl' if rtl else 'ltr', anchor=anchor)


def form_art():
    frame = Image.open(OUT / 'form-color.png').resize((1100, 1430))
    ink = '#294754'
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle((65, 62, 1035, 185), radius=12, fill=ink)
    type_at(d, (1000, 117), 'برگهٔ گردش سفارش', '#f6f3e8', 57, True, 'rm')
    type_at(d, (91, 105), 'NCR / 01', '#f6f3e8', 29)
    for i, name in enumerate(['شرح کالا', 'اندازه', 'گرماژ', 'تعداد']):
        type_at(d, (998 - 255 * i, 285), name, ink, 33, True, 'rm')
    for y in range(335, 1125, 65):
        d.line((81, y, 1015, y), fill='#637d80', width=2)
    for x in [81, 292, 483, 686, 1015]:
        d.line((x, 322, x, 1050), fill='#637d80', width=2)
    d.rectangle((82, 1181, 1015, 1305), outline=ink, width=3)
    type_at(d, (984, 1230), 'اصل • کپی صورتی • کپی زرد', ink, 33, True, 'rm')
    frame.save(OUT / 'form-art.png')


def label_art():
    frame = Image.open(OUT / 'coated-color.png').resize((940, 680))
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle((25, 25, 914, 651), radius=37, outline='#89978b', width=4)
    d.rounded_rectangle((60, 58, 880, 224), radius=22, fill='#1f4242')
    type_at(d, (842, 141), 'ردیابی بسته', '#f6f2df', 67, True, 'rm')
    type_at(d, (97, 140), 'LOT 06', '#f3e9cf', 37, False, 'lm')
    x = 109
    for digit in '437210782320571042320710423054203':
        width = int(digit) % 4 + 2
        d.rectangle((x, 321, x + width * 3, 511), fill='#252c2b')
        x += width * 3 + 7
    type_at(d, (119, 548), '056 · 081 · 440', '#414d47', 38)
    frame.save(OUT / 'label-art.png')


def grid_art():
    frame = Image.open(OUT / 'coated-color.png').resize((1200, 1300))
    d = ImageDraw.Draw(frame)
    for x in range(56, 1150, 37):
        d.line((x, 55, x, 1243), fill='#9bb2ad', width=2)
    for y in range(56, 1244, 37):
        d.line((56, y, 1160, y), fill='#9bb2ad', width=2)
    d.rounded_rectangle((222, 282, 944, 990), radius=94, outline='#345a59', width=11)
    d.ellipse((459, 516, 707, 764), outline='#345a59', width=7)
    d.line((160, 640, 1031, 640), fill='#b96753', width=4)
    d.line((583, 171, 583, 1129), fill='#b96753', width=4)
    type_at(d, (102, 1160), 'PLAN 06  /  1:2', '#344c48', 40)
    frame.save(OUT / 'draft-art.png')


def board_art():
    frame = Image.open(OUT / 'coated-color.png').resize((1240, 880))
    d = ImageDraw.Draw(frame)
    d.rectangle((39, 39, 1201, 841), outline='#3c5a53', width=7)
    d.rectangle((73, 72, 1168, 225), fill='#385a54')
    type_at(d, (1123, 150), 'رویهٔ پوشش‌دار', '#faf3df', 69, True, 'rm')
    for i, color in enumerate(('#262a28', '#13748a', '#bc5078', '#dfad30', '#965345')):
        d.rectangle((86 + i * 182, 328, 246 + i * 182, 682), fill=color)
    type_at(d, (100, 735), 'PRINT SURFACE  /  350 g/m²', '#33413c', 45)
    frame.save(OUT / 'board-art.png')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    materials = (
        ('form', (224, 225, 208), .77, 61, .44, .0, .64),
        ('rose', (215, 155, 149), .75, 62, .47, .0, .83),
        ('canary', (234, 203, 132), .76, 63, .55, .0, .72),
        ('navy', (35, 68, 78), .68, 64, .71, .11, .50),
        ('coated', (240, 236, 219), .39, 65, .40, .0, .42),
        ('liner', (176, 132, 85), .87, 66, 1.05, .0, 1.52),
        ('flute', (124, 80, 50), .93, 67, 1.12, .0, 1.37),
        ('cotton', (225, 217, 193), .85, 68, 1.03, .39, .93),
        ('rag', (163, 187, 176), .93, 69, 1.15, .28, 1.10),
        ('board-core', (130, 124, 107), .94, 70, 1.04, .05, 1.44),
        ('worktop', (55, 65, 64), .61, 71, .36, .0, .62),
    )
    for args in materials:
        material(*args)
    form_art()
    label_art()
    grid_art()
    board_art()
    finish = ROOT / 'public/v6/materials'
    finish.mkdir(parents=True, exist_ok=True)
    with Image.open(ROOT / 'public/v4/materials/plaster-color.webp') as source:
        base = ImageEnhance.Color(source.convert('RGB')).enhance(.40)
        Image.blend(base, Image.new('RGB', base.size, '#dedacf'), .64).save(
            finish / 'plaster-color.webp', 'WEBP', quality=88, method=6)


if __name__ == '__main__':
    main()
