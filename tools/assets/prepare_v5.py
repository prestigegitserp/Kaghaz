"""Prepare photographed passage surfaces and original Farsi package graphics."""
import argparse
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / '.asset-build/v5-scans'
OUTPUT = ROOT / '.asset-build/v5-textures'
PUBLIC = ROOT / 'public/v5/materials'
FONT = '/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf'
LATIN = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
LABELS = [
    ('سپیدار', 'کاغذ تحریر', 'A4 / 80', '#214e63'),
    ('خانهٔ رنگ', 'کاغذ و مقوای رنگی', '50 × 70', '#ac4b46'),
    ('مهر', 'گلاسه و مقوا', '135 GSM', '#3e675c'),
    ('کرافت', 'کارتن و بسته‌بندی', 'KRAFT', '#836041'),
    ('نگار', 'دفتر و صحافی', 'A5', '#4e4b7d'),
    ('نخ و کاغذ', 'کاغذ بافت‌دار', 'TEXTURED', '#854f59'),
    ('سپهر', 'کارت ایندربرد', '300 GSM', '#32596c'),
    ('بستهٔ نو', 'پاکت و جعبه', 'PACK', '#6c6553'),
]


def texture(image,name,publish=True,quality=87):
    image.save(OUTPUT/f'{name}.png')
    if publish:
        image.save(PUBLIC/f'{name}.webp','WEBP',quality=quality,method=5)


def floor():
    for label, remote in [('color','diff'),('normal','nor_gl'),('arm','arm')]:
        with Image.open(SOURCE/f'tiles-{remote}.jpg') as raw:
            image=raw.convert('RGB')
        image.thumbnail((512,512) if label=='arm' else (1024,1024),Image.Resampling.LANCZOS)
        if label=='color':
            data=np.array(image,dtype=np.float32)
            lum=data.mean(axis=2,keepdims=True)
            image=Image.fromarray(np.uint8(np.clip((lum-np.median(lum))*.95+(data-lum)*.45+(162,157,141),0,255)))
        if label=='arm':
            rgb=np.array(image)
            rgb[:,:,1]=np.clip(rgb[:,:,1].astype('float32')*.56+18,0,255).astype('uint8')
            image=Image.fromarray(rgb)
            image.getchannel('G').save(OUTPUT/'tile-rough.png')
        texture(image,'tile-'+label,quality=88 if label=='normal' else 85)


def printed():
    for i,(name,sub,gsm,accent) in enumerate(LABELS):
        texture(sign(name,sub,accent,str(101+i)),f'shop-{i}',False)
        im=Image.new('RGB',(576,296),'#f3efe0')
        d=ImageDraw.Draw(im)
        d.rectangle((0,0,576,99),fill=accent)
        d.rectangle((0,99,576,104),fill='#bd9e67')
        d.text((548,57),name,fill='#fcf4de',font=ImageFont.truetype(FONT,47),direction='rtl',anchor='rm')
        d.text((26,123),gsm,fill='#344544',font=ImageFont.truetype(LATIN,42))
        d.text((549,185),sub,fill='#455b51',font=ImageFont.truetype(FONT,27),direction='rtl',anchor='rm')
        for x in range(28,218,5):
            d.rectangle((x,214,x+1+(x%5),250),fill='#40513f')
        d.text((548,253),f'{i+1:02d} / BAHARESTAN',fill='#6b766a',font=ImageFont.truetype(LATIN,21),anchor='rm')
        texture(im,f'stock-{i}',i<6)
    texture(sign('پاساژ کاغذ بهارستان','خیابان ظهیرالاسلام · تهران','#2f534d',''), 'passage-sign',False)
    texture(sign('طبقهٔ اول','کاغذ تخصصی · چاپ و بسته‌بندی','#9f5f43','↑'), 'level-sign',False)


def sign(title,description,accent,code):
    im=Image.new('RGB',(1100,260),accent)
    d=ImageDraw.Draw(im)
    d.rectangle((13,13,1087,247),outline='#c5ab73',width=2)
    d.text((1033,99),title,fill='#fcf3d9',font=ImageFont.truetype(FONT,79),direction='rtl',anchor='rm')
    d.text((1033,195),description,fill='#f4dfac',font=ImageFont.truetype(FONT,39),direction='rtl',anchor='rm')
    if code:
        d.rounded_rectangle((44,46,179,178),radius=8,fill='#eeead7')
        d.text((111,109),code,fill=accent,font=ImageFont.truetype(LATIN,41),anchor='mm')
    return im


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--fetch',action='store_true')
    options=parser.parse_args()
    for directory in (SOURCE,OUTPUT,PUBLIC):
        directory.mkdir(parents=True,exist_ok=True)
    if options.fetch:
        for suffix in ('diff','nor_gl','arm'):
            subprocess.run(['curl','-fLsS','--retry','2',
                f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/interior_tiles/interior_tiles_{suffix}_1k.jpg',
                '-o',str(SOURCE/f'tiles-{suffix}.jpg')],check=True)
    floor()
    printed()
