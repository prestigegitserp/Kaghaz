"""Deterministic authored material sets. Color, roughness and tangent normals are separate.
These are designed surfaces, not photographic scans or measured reflectance data.
Run with a Python interpreter providing Pillow and NumPy, before build_assets.py.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/v2/materials'
SOURCE = ROOT / '.asset-build/textures'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
N = 768
rng = np.random.default_rng(260211)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def noise(scale, size=N):
    coarse = Image.fromarray((rng.random((scale, scale))*255).astype('uint8'))
    return np.asarray(coarse.resize((size, size), Image.Resampling.BICUBIC)).astype(float)/255-.5

def normal_from_height(h, strength):
    dy, dx = np.gradient(h)
    v = np.dstack((-dx*strength, -dy*strength, np.ones_like(h)))
    v /= np.linalg.norm(v, axis=2, keepdims=True)
    return ((v*.5+.5)*255).clip(0,255).astype('uint8')

manifest = {}
def save(name, rgb, height, roughness, strength=3):
    color = Image.fromarray(np.asarray(rgb).clip(0,255).astype('uint8'), 'RGB')
    rough = Image.fromarray((np.asarray(roughness).clip(0,1)*255).astype('uint8'), 'L').convert('RGB')
    normal = Image.fromarray(normal_from_height(height,strength),'RGB')
    for suffix, image in [('color',color),('rough',rough),('normal',normal)]:
        image.save(SOURCE/f'{name}-{suffix}.png', optimize=True)
        image.save(OUT/f'{name}-{suffix}.webp',quality=90 if suffix=='normal' else 86,method=6)
    manifest[name]={'color':f'materials/{name}-color.webp','normal':f'materials/{name}-normal.webp','roughness':f'materials/{name}-rough.webp','size':[N,N],'source':'authored-procedural','normalConvention':'OpenGL +Y'}

y,x = np.mgrid[0:N,0:N]/N
fine=noise(768); mid=noise(75); broad=noise(8)
fiber = fine*.2 + mid*.13 + broad*.04
paper = np.dstack([240+fiber*15,237+fiber*15,225+fiber*14])
save('paper',paper,fiber,.88+fine*.06,2.5)
fibers = noise(768)*.2+noise(90)*.22
for i in range(700):
    yy=rng.integers(N);xx=rng.integers(N); length=rng.integers(2,15)
    fibers[yy,xx:min(N,xx+length)] += rng.uniform(-.28,.28)
save('kraft',np.dstack([173+fibers*38,139+fibers*32,94+fibers*23]),fibers,.88+fine*.09,3)
grain = np.sin((x*80 + noise(9)*.28 + .16*np.sin(y*7))*math.pi)*.14
grain += np.sin((x*270+noise(12)*.8)*math.pi)*.035+noise(768)*.07
grain += noise(12)*.22
save('walnut',np.dstack([100+grain*53,69+grain*40,43+grain*24]),grain,.58+grain*.2,2.2)
plaster = noise(5)*.25+noise(30)*.1+noise(768)*.12
save('plaster',np.dstack([220+plaster*22,208+plaster*23,185+plaster*22]),plaster,.93+fine*.04,2)
stone = noise(5)*.25+noise(45)*.11+noise(768)*.08
seam=((x*4)%1<.012)|((y*4)%1<.012)
height=stone*.2-seam*.14
rgb=np.dstack([183+stone*24,176+stone*24,159+stone*22]);rgb[seam]*=.79
save('limestone',rgb,height,.64+stone*.2,9)
row=(y*18).astype(int);bx=(x*5+(row%2)*.5)%1;by=(y*18)%1
mortar=(bx<.035)|(by<.105)
brick_height=np.minimum(np.minimum(bx/.07,(1-bx)/.07),np.minimum(by/.18,(1-by)/.18)).clip(0,1)*.18+noise(768)*.04
brickgrain=noise(60)*.22+noise(768)*.12
variation=np.zeros_like(x)
for rr in range(18):
    for cc in range(6):
        mask=(row==rr)&(((x*5+(rr%2)*.5).astype(int))==cc)
        variation[mask]=rng.uniform(-9,9)
rgb=np.dstack([184+variation+brickgrain*34,151+variation+brickgrain*30,109+variation+brickgrain*24]);rgb[mortar]=[192,181,156]
save('brick',rgb,brick_height,.91+brickgrain*.1,8)

# Paper end-grain: 500 fine sheet boundaries, observed as a continuous layered edge.
edge=Image.new('RGB',(1024,256),(232,228,212));d=ImageDraw.Draw(edge)
for yy in range(256):
    a=int(rng.uniform(184,232));d.line((0,yy,1024,yy),fill=(a+10,a+7,a),width=1)
edge.save(SOURCE/'paper-edge.png');edge.save(OUT/'paper-edge.webp',quality=88)
wrapper=Image.new('RGB',(1024,1024),(233,231,219));d=ImageDraw.Draw(wrapper)
d.rectangle((0,0,292,1024),fill=(45,76,61));d.rectangle((315,60,970,64),fill=(171,149,103))
def text(pos,value,size,fill,anchor=None,rtl=False):
    d.text(pos,value,font=ImageFont.truetype(FONT,size),fill=fill,anchor=anchor,**({'direction':'rtl','language':'fa'} if rtl else {}))
text((146,88),'کاغذ',64,(240,234,212),'mt',True)
text((330,165),'A4',220,(49,75,59));text((345,445),'PREMIUM COPY PAPER',32,(93,101,81))
text((345,535),'80 g/m²',74,(63,82,64));text((345,640),'500 SHEETS',42,(112,114,91))
text((345,755),'210 × 297 mm',32,(133,132,108));text((345,856),'KAGHAZ / MATERIAL LIBRARY',20,(134,135,110))
d.line((345,825,938,825),fill=(182,177,149),width=2)
for xx in range(350,730,5):d.rectangle((xx,928,xx+int(rng.integers(1,4)),984),fill=(66,75,60))
wrapper.save(SOURCE/'wrapper.png');wrapper.save(OUT/'wrapper.webp',quality=93)
label=Image.new('RGB',(768,384),(232,224,203));d=ImageDraw.Draw(label)
d.rectangle((0,0,768,70),fill=(63,79,62));text((32,10),'KAGHAZ / MATERIAL STOCK',32,(238,233,212))
text((30,104),'PAPER & PACKAGING',36,(65,74,57));text((30,171),'HANDLE WITH CARE   /   KEEP DRY',20,(109,107,86))
for xx in range(32,456,4):d.rectangle((xx,242,xx+int(rng.integers(1,3)),341),fill=(67,72,57))
text((500,245),'80',54,(76,82,60));label.save(SOURCE/'stock-label.png');label.save(OUT/'stock-label.webp',quality=92)
sign=Image.new('RGB',(1536,256),(235,229,209));d=ImageDraw.Draw(sign);d.rectangle((12,12,1523,243),outline=(154,128,77),width=3)
text((768,12),'سرای سپید',95,(54,79,59),'mt',True);text((768,152),'کاغذ تحریر، چاپ و نشر',35,(113,119,92),'mt',True)
sign.save(SOURCE/'merchant-sign.png')
(OUT/'manifest.json').write_text(json.dumps({'version':2,'materials':manifest},indent=2))
print('KAGHAZ_V2_MATERIALS_READY',len(manifest))
