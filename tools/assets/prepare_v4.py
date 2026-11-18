"""Prepare modern showroom PBR images and printed motifs."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SCANS = ROOT / '.asset-build/v4-scans'
WORK = ROOT / '.asset-build/v4-textures'
PUBLIC = ROOT / 'public/v4/materials'
SOURCES = {'floor': 'terrazzo_tiles', 'plaster': 'white_plaster_02', 'wood': 'plywood'}
PALETTE = ['#1c7c72', '#d0603f', '#d5a042', '#5a6c9c', '#374e51', '#8f5368']


def download(pair):
    key, suffix = pair
    source = SOURCES[key]
    path = SCANS / f'{key}-{suffix}.jpg'
    if path.exists():
        return
    remote = f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{source}/{source}_{suffix}_1k.jpg'
    staging = path.with_suffix('.partial')
    subprocess.run(['curl', '-4', '-fLsS', '--retry', '2', '--connect-timeout', '14',
                    '--max-time', '40', remote, '-o', str(staging)], check=True)
    staging.replace(path)


def scans():
    for key in SOURCES:
        for suffix in ('diff', 'nor_gl', 'arm'):
            with Image.open(SCANS / f'{key}-{suffix}.jpg') as src:
                image = src.convert('RGB')
            image.thumbnail((512, 512) if suffix == 'arm' else (1024, 1024), Image.Resampling.LANCZOS)
            name = {'diff':'color','nor_gl':'normal','arm':'arm'}[suffix]
            if key == 'floor' and suffix == 'diff':
                pixels = np.array(image, dtype='float32')
                luminance = pixels.mean(axis=2, keepdims=True)
                middle = np.median(luminance)
                toned = (luminance - middle)*.91 + (pixels-luminance)*.17 + (181,178,165)
                image = Image.fromarray(np.uint8(np.clip(toned, 0, 255)))
            image.save(WORK / f'{key}-{name}.png')
            image.save(PUBLIC / f'{key}-{name}.webp', 'WEBP', quality=85, method=5)
            if suffix == 'arm':
                image.getchannel('G').save(WORK / f'{key}-rough.png')


def print_label(path, accent):
    w, h = (480, 680)
    image = Image.new('RGB', (w, h), '#f0ead7')
    d = ImageDraw.Draw(image)
    sans = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    naskh = '/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf'
    d.rectangle((0, 0, w, 268), fill=accent)
    for i in range(9):
        d.arc((157+i*13,-124+i*14,589+i*8,273+i*16), 80, 253, fill='#dec9a8', width=1)
    d.text((30, 28), 'KAGHAZ', font=ImageFont.truetype(sans, 27), fill='white')
    d.text((448, 190), 'کاغذ بهارستان', font=ImageFont.truetype(naskh, 38), fill='#fff1d8', direction='rtl', anchor='rm')
    d.line((33, 303, 450, 303), fill='#3d504d', width=2)
    d.text((35, 334), 'A4', font=ImageFont.truetype(sans, 107), fill='#233c40')
    d.text((37, 470), '80 GSM / 500', font=ImageFont.truetype(sans, 27), fill='#3d504d')
    for x in range(38, 206, 7):
        d.rectangle((x, 560, x+(x%5+1), 607), fill='#3d504d')
    d.text((445, 595), 'تحریر', font=ImageFont.truetype(naskh, 30), fill='#3d504d', direction='rtl', anchor='rm')
    image.save(WORK / f'{path}.png')
    if path in ('wrapper','wrapper-warm'):
        image.save(PUBLIC / f'{path}.webp', 'WEBP', quality=89, method=5)


def fascia():
    font = '/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf'
    signs = [
        ('سرای سپید', 'تحریر و چاپ', '#236961'), ('خانهٔ رنگ', 'کاغذ رنگی و هنری', '#ad4f42'),
        ('کاغذ مهر', 'مقوا و گلاسه', '#414d77'), ('کرافت و کارتن', 'بسته‌بندی', '#ad6638'),
        ('نگار تحریر', 'دفتر و صحافی', '#795464'), ('نخ و کاغذ', 'کاغذ بافت‌دار', '#617146'),
        ('مقوای سپهر', 'ورق و مقوا', '#3b6574'), ('بستهٔ نو', 'جعبه و پاکت', '#876449'),
        ('بازار کاغذ بهارستان', 'تهران · خیابان ظهیرالاسلام', '#214b46'),
        ('میز نمونه‌ها', 'تحریر، گلاسه و کرافت', '#314b46'),
        ('ساخت جعبه', 'برش، خط تا، نمونه‌سازی', '#af4e36'),
        ('نور و چاپ', 'مقایسهٔ رنگ و روکش', '#216a61'),
    ]
    for i,(title,subtitle,color) in enumerate(signs):
        image = Image.new('RGB',(1024,248),'#eee9d9')
        d = ImageDraw.Draw(image)
        d.rounded_rectangle((55, 36, 177, 158), radius=9, fill=color)
        d.line((89, 73, 144, 73,144,122,89,122,89,73),fill='#f7eed8',width=3)
        d.line((101,103,132,103),fill='#f7eed8',width=3)
        d.text((975,87),title,font=ImageFont.truetype(font,69 if i<8 else 63),direction='rtl',anchor='rm',fill=color)
        d.text((975,175),subtitle,font=ImageFont.truetype(font,33),direction='rtl',anchor='rm',fill='#59645b')
        image.save(WORK/f'fascia-{i}.png')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--fetch', action='store_true')
    options = parser.parse_args()
    for path in (SCANS, WORK, PUBLIC):
        path.mkdir(parents=True, exist_ok=True)
    if options.fetch:
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(download, [(key, suffix) for key in SOURCES for suffix in ('diff','nor_gl','arm')]))
    scans()
    for i, accent in enumerate(PALETTE):
        print_label(('wrapper','wrapper-warm')[i] if i < 2 else f'wrapper-{i}', accent)
    fascia()
    print('Modern architecture scans and printed packaging prepared.')
