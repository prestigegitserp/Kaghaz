"""Daylit showroom and a metric print package for Blender Cycles."""
import argparse
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_v3 as g

ROOT = Path(__file__).resolve().parents[2]
g.TEX = ROOT / '.asset-build/v4-textures'
LAYOUT = json.loads((ROOT / 'src/domain/hall-layout.json').read_text())
FRAMES = ROOT / '.asset-build/v4-renders'
MODELS = ROOT / '.asset-build/v4-models'
rng = random.Random(43)
b, panel, place = g.box, g.panel, g.place


def rgb(color):
    values = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v / 12.92 if v < .04045 else ((v+.055)/1.055)**2.4 for v in values)


def painted(name,color,rough=.56,metal=0):
    return g.material(name,rgb(color),rough,metal)


cement = g.material('Honed terrazzo',texture='floor',tiles=(2.2,2.2),normal=.26)
plaster = g.material('White site plaster',texture='plaster',tiles=(1.5,1.5),normal=.29)
ply = g.material('Plywood',texture='wood',tiles=(.78,.78),normal=.40)
enamel = painted('Warm white enamel','#e1ded4',.45)
steel = painted('Anodized window frames','#3c5154',.37,.35)
velvet = painted('Desk mat','#41494a',.86)
white = painted('Diffuser','#fcf4d9')
opal = g.material('Light strip',rgb('#fff1d8'),emission=4)
cast = [painted(name,color) for name,color in [
    ('Aegean green','#24746b'),('Terracotta','#ca6049'),('Corn yellow','#d9a652'),
    ('Bluish plum','#59688e'),('Saffron green','#819469'),('Mauve','#966c85'),
]]
print_material = [g.material('Press grade wrapper '+str(i),rough=.55,
                  diffuse=('wrapper','wrapper-warm')[i] if i<2 else f'wrapper-{i}') for i in range(6)]
signs = [g.material(f'Printed fascia {i}',rough=.74,diffuse=f'fascia-{i}') for i in range(12)]
paper = g.m['paper']; dark = g.m['edge']


def flat(name, at, size, material, angle=0, face=False):
    obj = panel(name,at,size,material,lambda u,v:0,grid=(1,1))
    obj.rotation_euler = (math.pi/2 if face else 0,0,angle)
    return obj


def wrapped(name, location, index=0, angle=0, size=(.210,.297,.050)):
    x,y,z = location
    w,d,h = size
    b(name,(x,y,z+h/2),(w,d,h),dark,.0013,angle,part='sheets')
    b('Printed edge band',(x,y,z+h*.51),(w+.0006,d+.0005,h*.87),cast[index%6],.0011,angle,part='wrapper')
    flat('Printed ream face',(x,y,z+h+.00085),(w+.001,d+.001),print_material[index%6],angle)
    return h



def assets():
    for key, opened in [('paper-ream-modern',False),('paper-ream-open-modern',True)]:
        collection = bpy.data.collections.new(key)
        g.scene.collection.children.link(collection)
        g.destination = collection
        if opened:
            old_wrapper,old_green = g.m['wrapper'],g.m['green']
            g.m['wrapper'],g.m['green'] = print_material[0],cast[0]
            g.ream(opened=True)
            g.m['wrapper'],g.m['green'] = old_wrapper,old_green
        else:
            wrapped('Stock A4',(0,0,0))
        if not args.no_export:
            bpy.ops.object.select_all(action='DESELECT')
            for obj in collection.objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = next(iter(collection.objects))
            MODELS.mkdir(parents=True,exist_ok=True)
            bpy.ops.export_scene.gltf(filepath=str(MODELS/f'{key}.glb'),export_format='GLB',
                                      use_selection=True,export_apply=True,export_extras=True,export_animations=False)
        g.scene.collection.children.unlink(collection)
        g.collections[key] = collection
    g.destination = g.stage


def make_repeat_stock():
    for index in range(6):
        key = f'stock-{index}'
        collection = bpy.data.collections.new(key)
        g.destination = collection
        wrapped('Ream shelf sample',(0,0,0),index)
        g.collections[key] = collection
    g.destination = g.stage


def shop(slot, x,y,r):
    c,s = math.cos(r),math.sin(r)
    def at(a,d,h):
        return (x+a*c-d*s,y+a*s+d*c,h)
    def box(name,pos,size,mat,bevel=0,err=0):
        return b(name,at(*pos),size,mat,bevel,r+err)
    primary = cast[(0,1,3,2,5,4,3,2)[slot]]
    box('Plaster back',(0,3.96,1.74),(6.16,.112,3.45),plaster,.022)
    box('Wood showroom floor',(0,1.93,.038),(6.13,3.88,.077),ply,.016)
    box('Laminated band',(0,.06,3.32),(6.10,.34,.61),primary,.062)
    panel_sign = flat('Shop name',at(0,-.134,3.33),(4.3,.52),signs[slot],r,True)
    box('Fascia frame',(0,.07,3.67),(6.18,.34,.095),enamel,.023)
    for side in [-1,1]:
        box('Open storefront post',(side*3.0,.06,1.63),(.10,.30,3.27),steel,.019)
        box('Inboard divider',(side*3.03,3.18,1.53),(.15,1.53,3.04),plaster,.014)
    box('Track',(0,1.60,3.23),(5.81,.056,.058),steel,.014)
    box('Diffuse showroom strip',(0,1.60,3.192),(5.5,.049,.034),opal,.012)
    for sx in [-1.87,0,1.87]:
        box('Painted steel shelf back',(sx,3.58,1.58),(1.69,.036,2.64),primary,.015)
        for xx in [sx-.82,sx+.82]:
            box('Steel shelf upright',(xx,3.35,1.62),(.042,.49,2.95),steel,.01)
        for row in range(5):
            z=.34+row*.53
            box('Ply shelf',(sx,3.34,z),(1.7,.55,.041),ply,.006)
            for col in range(4):
                xx=sx-.60+col*.394
                if slot in (3,7):
                    box('Kraft mailer',(xx,3.31,z+.14),(.275,.38,.226),g.m['kraft'],.013)
                    box('Tape joint',(xx,3.31,z+.257),(.029,.39,.003),g.m['tape'],.001)
                    box('Warehouse slip',(xx,3.108,z+.15),(.10,.003,.06),paper,.002)
                elif slot in (1,5,6):
                    for i in range(4+(row%2)):
                        box('Color board',(xx,3.32,z+.049+i*.035),(.325,.413,.032),
                            cast[(slot+col+row)%6],.003,rng.uniform(-.03,.03))
                else:
                    for i in range(3+(col+row)%2):
                        place(f'stock-{(slot+col+row)%6}',at(xx,3.30,z+.035+i*.064),r+rng.uniform(-.052,.052),1.22)
    box('Counter lower carcass',(-.72,1.03,.47),(2.98,.82,.92),primary,.050)
    box('Front counter toe kick',(-.72,.62,.105),(2.95,.049,.14),steel,.012)
    box('Ply counter top',(-.72,1.03,.966),(3.13,.91,.095),ply,.024)
    for j in range(18):
        box('Small fluted panel',(-2.04+j*.155,.602,.51),(.085,.009,.64),primary,.010)
    if slot in (3,7):
        place('carton-open',at(-1.39,1.01,1.017),r-.11,1.07)
        place('kraft-roll',at(1.94,2.28,.080),r+.35,.83)
        box('Stock carton',(2.28,2.68,.20),(.438,.342,.238),g.m['kraft'],.012,.125)
    elif slot in (1,5,6):
        for j in range(5):
            box('Fan deck sample',(-1.56+j*.036,1.03+j*.027,1.017+j*.004),(.16,.42,.004),cast[j],.001,j*.17)
        for j in range(4):
            box('Display folio',(-.83+j*.19, .88+j*.062,1.026+j*.008),(.33,.436,.011),cast[(j+slot)%6],.004,-j*.17)
    else:
        for j in range(4):
            place(f'stock-{(j+slot)%6}',at(-1.23,1.03,1.017+j*.052),r+j*.045,1)
        place('paper-ream-open-modern',at(-.59,1.04,1.018),r+.32,1.08)
    box('Point of sale base',(.37,.95,1.05),(.26,.21,.043),steel,.006)
    screen = box('Point of sale glass',(.37,1.030,1.141),(.272,.020,.184),velvet,.008)
    screen.rotation_euler.x = -.20
    g.area('Open shop fill',at(.4,1.45,3.16),at(-.26,1.7,.58),112,2.1,(1,.91,.83))


def station(key, i):
    spec = LAYOUT['stations'][key]
    x,z = spec['position']
    y = -z
    w,d = spec['size']
    accent = cast[i]
    b(f'{key} base',(x,y,.49),(w-.13,d-.15,.98),accent,.105)
    b(f'{key} light laminated top',(x,y,1.012),(w,d,.086),ply,.042)
    b('Lithographed workstation face',(x,y-d/2-.015,.706),(w*.72,.042,.36),enamel,.018)
    flat('Workstation legend',(x,y-d/2-.039,.707),(w*.685,.317),signs[{'samples':9,'fold':10,'proof':11}[key]],face=True)
    for j in range(max(2,int(w/.38))):
        dx = -w*.42+j*.34
        boxmat = cast[(j+i)%6]
        if key=='samples':
            for k in range(4):
                b('Pigmented sample folio',(x+dx,y-.24+k*.129,1.066+k*.015),
                  (.31,.47,.011),boxmat,.007,k*.10+j*.04)
            upright = b('Standing paper sample',(x+dx,y+.41,1.316),(.268,.014,.522),boxmat,.003)
            upright.rotation_euler.x = .13
        elif key=='fold':
            if j%3==0:
                place('carton-open',(x+dx,y-.17,1.067),j*.18,.71)
            elif j%3==1:
                b('Folded stock carton',(x+dx,y+.44,1.183),(.325,.245,.238),g.m['kraft'],.009,j*.18)
            else:
                b('Flat die-cut folio',(x+dx,y-.11,1.072),(.46,.53,.010),g.m['kraft'],.004,j*.14)
        else:
            b('Printed proof card',(x+dx,y-.08,1.073),(.30,.50,.013),boxmat,.004,rng.uniform(-.14,.14))
    if key=='proof':
        for xx in [x-.78,x+.78]:
            b('Proof lamp post',(xx,y+.41,1.439),(.025,.03,.76),steel,.006)
        b('Proof lamp housing',(x,y+.38,1.826),(1.65,.12,.12),steel,.025)
        b('Full spectrum diffuser',(x,y+.38,1.754),(1.50,.09,.028),opal,.018)
    if key=='fold':
        b('Dark cutting mat',(x-.23,y-.19,1.059),(1.17,.82,.013),velvet,.019)
        b('Sample rule',(x-.51,y-.49,1.072),(.70,.033,.009),steel,.004,-.23)
    g.area('Station display light',(x-.49,y-.86,4.77),(x,y,1.02),260,w*.65,(1,.94,.86))


def paper_installation():
    for i in range(15):
        x = (i-7)*.377
        y = 3.32 + .29*math.sin(i*.62)
        z = 4.54 + .26*math.cos(i*.56)
        panel('Suspended paper ribbon',(x,y,z),(.294,1.66),cast[i%6],
              lambda u,v,n=i: .22*math.sin((v-.5)*3.9+n*.29)+.12*(u-.5)*(v-.5),
              grid=(3,15),thickness=.0022)
        g.ribbon('Fine suspension wire',[(x,y-.64,z+.06),(x,y-.64,6.93)],.0067,steel)
    b('Install track',(0,3.31,6.94),(5.9,.058,.060),steel,.012)

def planter(x,y,seed):
    rnd = random.Random(seed)
    leaves = [painted('Ficus leaf %s'%i,color,.49) for i,color in enumerate(('#436650','#5c7b58','#768957'))]
    b('Ceramic plant trough',(x,y,.27),(.84,.67,.56),enamel,.08)
    b('Soil bed',(x,y,.550),(.74,.58,.023),velvet,.017)
    for branch in range(5):
        dx,dy=rnd.uniform(-.39,.39),rnd.uniform(-.31,.31)
        h=rnd.uniform(1.17,1.93)
        points=[(x+dx*t,y+dy*t,.56+h*t) for t in (0,.40,.76,1)]
        g.ribbon('Plant branch',points,.011,ply)
        for k in range(9):
            t=.22+k*.086
            angle=rnd.random()*math.tau
            xx,yy,zz=x+dx*t,y+dy*t,.56+h*t
            fx,fy=math.cos(angle),math.sin(angle)
            length=rnd.uniform(.13,.28);w=.053
            verts=[(xx,yy,zz),(xx+fx*length*.53+fy*w,yy+fy*length*.53-fx*w,zz+.045),
                   (xx+fx*length,yy+fy*length,zz+.055),
                   (xx+fx*length*.52-fy*w,yy+fy*length*.52+fx*w,zz+.045)]
            g.mesh('Light-catching ficus leaf',verts,[(0,1,2,3)],leaves[k%3])

def hall():
    b('Continuous terrazzo slab',(0,0,-.10),(30,29.40,.19),cement,.025)
    for x in [-9.6,9.6]:
        b('High acoustic ceiling wing',(x,0,7.25),(10.1,29.4,.27),plaster,.070)
    for x in [-6.2,6.2]:
        b('Long roof beam',(x,0,6.91),(.22,29.2,.24),steel,.015)
        b('Inset linear lights',(x,0,6.754),(.09,28.0,.033),opal,.01)
    for y in [-12,-8,-4,0,4,8,12]:
        b('Steel ceiling beam',(0,y,7.03),(28.7,.133,.215),enamel,.021)
    for x in [-4.25,-2.12,0,2.12,4.25]:
        b('Skylight mullion',(x,0,7.28),(.102,29.1,.18),steel,.022)
    for x in [-14.75,14.75]:
        b('Low plaster wall',(x,0,.79),(.18,29.3,1.58),plaster,.035)
        b('Low sill',(x,0,1.58),(.23,29.3,.106),enamel,.038)
        b('Upper transom',(x,0,6.81),(.21,29.3,.095),steel,.018)
        b('Window cross bar',(x,0,4.43),(.17,29.3,.093),steel,.01)
        for y in [-13.6,-10.26,-6.92,-3.58,-.24,3.1,6.44,9.78,13.12]:
            b('Glazed curtain wall mullion',(x,y,4.18),(.169,.101,5.05),steel,.015)
    b('Back plaster partition',(0,13.64,3.57),(29.8,.42,7.2),plaster,.11)
    b('Partition copper accent',(0,13.34,5.29),(14.9,.13,1.43),cast[0],.075)
    flat('Baharestan wayfinding',(0,13.255,5.31),(10.41,1.18),signs[8],face=True)
    for y in [-13.4,12.65]:
        for x in [-12.46,12.46]:
            b('Powder coated portal',(x,y,3.5),(.30,.38,7.0),enamel,.047)
    for x in [-10.1,10.1]:
        b('Entrance glazing top',(x,-14.65,6.91),(8.70,.21,.28),steel,.028)
        for dx in [-4,-2,0,2,4]:
            b('Entrance glazed center',(x+dx,-14.65,3.31),(.091,.14,6.62),steel,.015)
    for i, (x,z,rot) in enumerate(LAYOUT['booths'][:8]):
        shop(i,x,-z,rot)
    for key,i in [('proof',0),('fold',1),('samples',2)]:
        station(key,i)
    paper_installation()
    for x,y,seed in [(-6.62,-8.36,9),(6.65,-8.36,22),(-5.78,5.62,25),(5.82,5.62,34)]:
        planter(x,y,seed)
    brass = painted('Brushed brass aisle strip','#ab935e',.38,.36)
    for x in [-5.60,5.60]:
        b('Trade-floor directional inlay',(x,0,-.002),(.024,23.6,.006),brass,0)
    for x,y in [(-5.98,-7.10),(5.95,-7.10),(-6.1,5.52),(6.1,5.52)]:
        b('Long plywood resting bench',(x,y,.46),(1.95,.57,.109),ply,.044)
        for dx in [-.73,.73]:
            b('Bench legs',(x+dx,y,.23),(.095,.46,.46),steel,.017)
    for side in [-1,1]:
        for ix in range(4):
            x,y = side*(19.9+ix*1.45), -17.9+ix*12.75
            h = 8.4 + (ix%3)*2.2
            b('City block exterior',(x,y,h/2),(7.8,8.85,h),enamel,.19)
            for yz in [-2.9,-.96,.98,2.92]:
                for hfloor in range(1,int(h/2.45)+1):
                    b('Office window',(x-side*3.94,y+yz,hfloor*2.05),(.055,1.31,1.22),steel,.037)
    light = bpy.data.lights.new('Daylight through roof','SUN')
    light.energy,light.angle,light.color = 2.15,.09,(1,.918,.79)
    sun = bpy.data.objects.new('Sun',light)
    g.stage.objects.link(sun)
    sun.rotation_euler = (math.radians(34),math.radians(-24),math.radians(-12))
    for y in [-10,-3.2,3.6,10.4]:
        g.area('Broad skylight',(-1.4,y,7.10),(0,y,.45),940,4.98,(.81,.91,1))
    g.area('Fill from entrance',(-5,-13.4,4.32),(1,-2,1.31),1050,5.2,(1,.95,.89))
    g.area('Sunlit side glazing',(-13.46,2.1,5.42),(1,-2.2,1.37),1190,5.8,(.86,.94,1))


def macro_stage():
    for obj in list(g.stage.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    b('Ply bench with soft edge',(0,0,-.053),(.86,.76,.104),ply,.015)
    b('Gray cutting surface',(0,-.015,.001),(.57,.56,.004),velvet,.006,.16)
    place('paper-ream-open-modern',(.026,.014,.004),-.23,1.10)
    for i in range(5):
        card=b('Deck material tab',(-.173+.015*i,.056+i*.016,.007+i*.001),(.090,.157,.0013),cast[i],.0004,-i*.17)
    b('Printed measurement guide',(.154,-.122,.004),(.176,.017,.0016),steel,.0005,-.22)
    for i in range(30):
        b('Graduation',(.062+i*.005,-.102-i*.0011,.005),(.00043,.006 if i%5 else .009,.0002),enamel,0,-.22)
    g.area('Clean soft product key',(-.42,-.53,.66),(.03,0,.06),40,.42,(1,.93,.83))
    g.area('Close cool reflection',(.31,.42,.39),(0,0,.09),18,.36,(.81,.91,1))


parser = argparse.ArgumentParser()
parser.add_argument('--frames',nargs='*',default=['hall','sample-table','fold-counter','ream'])
parser.add_argument('--samples',type=int,default=68)
parser.add_argument('--scale',type=int,default=100)
parser.add_argument('--no-export',action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
assets()
if any(name!='ream' for name in args.frames):
    make_repeat_stock()
    hall()
FRAMES.mkdir(parents=True,exist_ok=True)
scene = g.scene
scene.cycles.samples = args.samples
scene.cycles.adaptive_threshold = .042
scene.render.resolution_percentage = args.scale
scene.world.node_tree.nodes.get('Background').inputs[0].default_value = (.56,.69,.86,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value = .46
scene.view_settings.look = 'AgX - Medium High Contrast'
cam = scene.camera

shots = {
    'hall': ((1.48,-12.81,2.53),(-.48,-.08,2.40),25,(1536,960)),
    'sample-table': ((-.97,-.025,2.63),(.48,4.4,1.27),38,(1376,900)),
    'fold-counter': ((.43,-4.88,2.36),(3.37,-2.43,1.16),40,(1344,880)),
    'ream': ((.38,-.506,.392),(.031,-.025,.057),47,(1280,864)),
}
for name in args.frames:
    if name == 'ream':
        macro_stage()
    eye,target,lens,resolution = shots[name]
    cam.location = eye
    cam.rotation_euler = (Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.lens = lens
    scene.render.resolution_x,scene.render.resolution_y = resolution
    scene.render.filepath = str(FRAMES / (name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('V4_RENDER_READY',name,flush=True)
