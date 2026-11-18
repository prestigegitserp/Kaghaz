"""Prepare local web PBR maps and print graphics for the v3 Blender source."""
import argparse
import os
from pathlib import Path
from urllib.request import urlretrieve

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.asset-build'
MAPS = WORK / 'v3-textures'
PUBLIC = ROOT / 'public/v3/materials'
FONT_ROOT = Path(os.environ.get('KAGHAZ_FONT_DIR', '/usr/share/fonts/truetype/noto'))
SIZE = 768
RNG = np.random.default_rng(1729)
MAPS.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)

SCANS = {
    'brick': ('rough_plaster_brick', (.98, .94, .88)),
    'plaster': ('rough_plaster_03', (1.13, 1.09, 1.01)),
    'floor': ('concrete_floor_02', (.91, .87, .80)),
    'wood': ('old_wood_floor', (.94, .88, .77)),
}


def save(key, image, quality=88, web=False):
    image.save(MAPS / f'{key}.png')
    if web:
        image.save(PUBLIC / f'{key}.webp', quality=quality, method=5)


def rgb_array(image):
    return np.asarray(image.convert('RGB'), dtype=np.float32)


def byte_image(values):
    return Image.fromarray(np.uint8(np.clip(values, 0, 255)))


def fetch_scans():
    directory = WORK / 'scans'
    directory.mkdir(parents=True, exist_ok=True)
    for key, (asset, _) in SCANS.items():
        for suffix in ('diff', 'nor_gl', 'arm'):
            remote = f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{asset}/{asset}_{suffix}_1k.jpg'
            target = directory / f'{key}-{suffix}.jpg'
            if not target.exists():
                temporary = target.with_suffix('.download')
                urlretrieve(remote, temporary)
                temporary.replace(target)


def scan_materials():
    for key, (_, tone) in SCANS.items():
        def read(suffix, limit):
            with Image.open(WORK / 'scans' / f'{key}-{suffix}.jpg') as source:
                image = source.convert('RGB')
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
            return image

        save(f'{key}-color', byte_image(rgb_array(read('diff', 1024)) * tone), 83, True)
        save(f'{key}-normal', read('nor_gl', 1024), 85, True)
        arm = read('arm', 512)
        save(f'{key}-arm', arm, 85, True)
        save(f'{key}-rough', arm.getchannel('G'))
        save(f'{key}-ao', arm.getchannel('R'))


def cloud(size):
    noise = RNG.integers(0, 256, (size, size), dtype=np.uint8)
    small = Image.fromarray(noise)
    return np.array(small.resize((SIZE, SIZE), Image.Resampling.BICUBIC), dtype='float32') / 255 - .5


def fibrous(base, contrast, count, length):
    fibers = Image.new('L', (SIZE, SIZE), 128)
    draw = ImageDraw.Draw(fibers)
    for _ in range(count):
        x, y = RNG.integers(0, SIZE, 2)
        dx = RNG.integers(1, length + 1)
        dy = RNG.integers(-2, 3)
        draw.line((x, y, x + dx, y + dy), fill=int(RNG.integers(70, 183)), width=1)
    grain = (np.array(fibers.filter(ImageFilter.GaussianBlur(.42)), dtype='float32') - 128) / 64
    field = cloud(13) * .55 + cloud(57) * .23 + cloud(220) * .13 + grain * .38
    shade = field[..., None] * contrast + RNG.normal(0, .65, (SIZE, SIZE, 1))
    color = byte_image(np.asarray(base) + shade)
    y, x = np.gradient(field)
    normal = np.stack((-x * .8, -y * .8, np.ones_like(x)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return color, byte_image((normal / 2 + .5) * 255), field


def worn(image, amount):
    uniform = RNG.normal(0, amount, (image.height, image.width, 1))
    return byte_image(rgb_array(image) + uniform)


def print_materials():
    for key, base, contrast, count, length, rough in [
        ('sheet', (236, 232, 218), 23, 38000, 5, 186),
        ('kraft', (169, 114, 63), 47, 54000, 10, 212),
    ]:
        color, normal, field = fibrous(base, contrast, count, length)
        save(f'{key}-color', color, 90)
        save(f'{key}-normal', normal)
        save(f'{key}-rough', byte_image(rough + field * 53))

    edge = RNG.normal(0, 4.3, (SIZE, 1)) + cloud(63) * 5
    edge += np.sin(np.arange(SIZE)[:, None] * (2 * np.pi / 3.5)) * 6.2
    save('sheet-edge', byte_image(np.asarray((222, 218, 200)) + edge[..., None]))
    yy, xx = np.mgrid[-1:1:complex(SIZE), -1:1:complex(SIZE)]
    radius, angle = np.hypot(xx, yy), np.arctan2(yy, xx)
    rings = 6.2 * np.sin(radius * 890 - angle) + 3 * np.sin(radius * 790 * 1.063 - angle)
    rings += cloud(115) * 10 + RNG.normal(0, 1.7, rings.shape)
    save('roll-ring', byte_image(np.asarray((204, 157, 106)) + rings[..., None]))

    wrapper = Image.new('RGB', (768, 1086), '#e9e2cb')
    draw = ImageDraw.Draw(wrapper)
    draw.rectangle((0, 0, 768, 395), fill='#203c35')
    draw.rectangle((0, 400, 768, 414), fill='#bf9857')
    for i in range(7):
        draw.arc((240 + i * 24, 110 + i * 20, 935 + i * 12, 640 + i * 12), 162, 335, fill='#678071', width=1)

    def fa(size):
        return ImageFont.truetype(str(FONT_ROOT / 'NotoNaskhArabic-Bold.ttf'), size)

    def en(size):
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size)

    draw.text((384, 205), 'کاغذ بهارستان', font=fa(79), fill='#f8edcd', anchor='mm', direction='rtl')
    draw.text((384, 322), 'BAHARESTAN   /   PAPER WORKS', font=en(23), fill='#e1c890', anchor='mm')
    draw.text((384, 597), 'A4  /  80', font=en(106), fill='#263f33', anchor='mm', stroke_width=1)
    draw.text((384, 731), 'تحریر بدون پوشش', font=fa(60), fill='#435147', anchor='mm', direction='rtl')
    draw.line((88, 817, 680, 817), fill='#7b7964', width=1)
    draw.text((384, 884), '۵۰۰ برگ   ·   ۲۱۰ × ۲۹۷ میلی‌متر', font=fa(35), fill='#435147', anchor='mm', direction='rtl')
    draw.text((384, 1003), 'UNCOATED   /   500 SHEETS', font=en(21), fill='#435147', anchor='mm')
    save('press-wrapper', worn(wrapper, 2.6), 90, True)

    label = Image.new('RGB', (768, 384), '#dcd2b9')
    draw = ImageDraw.Draw(label)
    draw.rectangle((20, 20, 747, 363), outline='#516050', width=3)
    draw.text((690, 80), 'انبار راستهٔ کاغذ', font=fa(59), fill='#33473c', anchor='rm', direction='rtl')
    draw.line((57, 134, 708, 134), fill='#637062', width=2)
    draw.text((155, 207), 'KRAFT', font=en(34), fill='#33473c', anchor='mm')
    draw.text((155, 266), 'LOT 014', font=en(22), fill='#33473c', anchor='mm')
    for x in range(335, 699, 7):
        if RNG.random() > .23:
            draw.rectangle((x, 193, x + int(RNG.integers(2, 6)), 292), fill='#414741')
    for x in [71, 101]:
        draw.line((x, 309, x, 282), fill='#414741', width=3)
        draw.line((x - 8, 288, x, 279, x + 8, 288), fill='#414741', width=3)
    save('packing-label', worn(label, 2.1))

    for index, (name, subtitle, ground) in enumerate((
        ('کاغذ بهارستان', 'تحریر، چاپ و فروش عمده', '#263d33'),
        ('تجارت کاغذ', 'مقوا و گلاسه', '#543a2b'),
        ('انبار سپیدار', 'پخش کاغذ و مقوا', '#293c40'),
        ('بسته‌بندی مهر', 'کرافت و کارتن', '#604a31'),
        ('راستهٔ کاغذ', 'بهارستان  ·  تهران', '#4e3728'),
    )):
        sign = Image.new('RGB', (1024, 256), ground)
        draw = ImageDraw.Draw(sign)
        draw.rectangle((12, 12, 1011, 243), outline='#b99459', width=2)
        draw.rectangle((19, 19, 1004, 236), outline='#766848', width=1)
        draw.text((512, 110), name, font=fa(92), fill='#f5e7c4', anchor='mm', direction='rtl')
        draw.text((512, 205), subtitle, font=fa(32), fill='#d4b47b', anchor='mm', direction='rtl')
        save(f'fascia-{index}', worn(sign, 2.8))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--fetch', action='store_true', help='Download the four CC0 source materials')
    if parser.parse_args().fetch:
        fetch_scans()
    scan_materials()
    print_materials()
    print('Prepared v3 scans, paper microstructure and print graphics.')
