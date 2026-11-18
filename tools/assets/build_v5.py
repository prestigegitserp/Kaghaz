"""A compact Persian paper passage with two walkable decks and reusable stock props."""
import argparse
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_v3 as g

ROOT=Path(__file__).resolve().parents[2]
GENERATED=ROOT/'.asset-build/v5-textures'
MODELS=ROOT/'.asset-build/v5-models'
RENDERS=ROOT/'.asset-build/v5-renders'
LAYOUT=json.loads((ROOT/'src/domain/passage-layout.json').read_text())
g.TEX=GENERATED
source_box=g.box
box_meshes={}
reuse_stock_geometry=False
rng=random.Random(718)


def b(name,at,size,surface,bevel=0,angle=0,part=None):
    if not reuse_stock_geometry:
        return source_box(name,at,size,surface,bevel,angle,part)
    key=(tuple(size),surface.name,bevel)
    if key in box_meshes:
        obj=bpy.data.objects.new(name,box_meshes[key])
        g.destination.objects.link(obj)
        obj.location=at
        obj.rotation_euler.z=angle
        if part:
            obj['part']=part
        return obj
    obj=source_box(name,at,size,surface,bevel,angle,part)
    bpy.context.view_layer.objects.active=obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    box_meshes[key]=obj.data
    return obj


g.box=b


def tone(color):
    rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb)


def paint(name,color,rough=.6,metal=0):
    return g.material(name,tone(color),rough,metal)


def clean_floor():
    mat=g.material('Satin ceramic passage tile',texture='tile',tiles=(2.02,2.02),normal=.47)
    return mat


floor=clean_floor()
g.TEX=ROOT/'.asset-build/v4-textures'
ply=g.material('Laminated shop counter',texture='wood',tiles=(.78,.78),normal=.55)
plaster=g.material('Painted soffit',texture='plaster',tiles=(1.6,1.6),normal=.29)
g.TEX=GENERATED
gray=paint('Satin off-white aluminium','#d4caba',.42,.23)
steel=paint('Dark powder-coated aluminium','#263c3b',.37,.57)
chrome=paint('Brush satin railing','#848983',.27,.73)
petrol=paint('Information enamel','#2d493f',.42)
black=paint('Counter case','#38403a',.64)
ivory=paint('Paper cream','#e2d9c5',.52)
opal=g.material('Diffuse fluorescent bars',tone('#fff1d1'),emission=5.2)
ink=paint('Register face','#314b45',.34)
cloth=paint('Cutting mat','#67706e',.85)
palette=[paint('Original stock hue '+str(i),hex) for i,hex in enumerate(
    ['#275c73','#ae5449','#4b6b60','#8b6840','#56517c','#8b5662','#416779','#6b624e'])]
stocks=[g.material('Stock face '+str(i),diffuse=f'stock-{i}',rough=.61) for i in range(8)]
signs=[g.material('Directory '+str(i),diffuse=f'shop-{i}',rough=.64) for i in range(8)]
brand=g.material('Passage sign',diffuse='passage-sign',rough=.60)
floor_sign=g.material('Level sign',diffuse='level-sign',rough=.59)
glass=paint('Thin smoke glass','#b0cbc5',.13,.05)
film=paint('Wrinkled PE film','#e0d8ac',.21,.02)
for mat,alpha in [(glass,.135),(film,.27)]:
    mat.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=alpha
    mat.surface_render_method='BLENDED'


def plane(name,at,size,mat,rot=0,vertical=False,part=None):
    p=g.panel(name,at,size,mat,lambda u,v:0,part,grid=(1,1),thickness=0)
    p.rotation_euler=(math.pi/2 if vertical else 0,0,rot)
    return p


def cylinder(name,at,r,d,mat,across=False,n=20):
    vertices=[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z)
        for z in (-d/2,d/2) for i in range(n)]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    obj=g.mesh(name,vertices,faces,mat,at=at)
    for f in obj.data.polygons[2:]:
        f.use_smooth=True
    if across:
        obj.rotation_euler.y=math.pi/2
    return obj


def carton_item(x,y,z,i,w=.39,d=.31,h=.21,a=0,label=True):
    b('Box side plies',(x,y,z+h/2),(w,d,h),g.m['kraft'],.006,a)
    b('Mailing tape',(x,y,z+h+.002),(w*.09,d*.995,.003),g.m['tape'],.001,a)
    if label:
        plane('Lot label',(x+math.sin(a)*d/2,y-math.cos(a)*(d/2+.0009),z+h/2),
              (w*.83,h*.71),stocks[i%8],a,True)


def bundle_artifact():
    g.pallet()
    for row in range(3):
        for x in [-.27,.27]:
            for y in [-.192,.192]:
                carton_item(x,y,.151+row*.216,0 if (row+int(x>0))%3 else 2,.512,.36,.209,.014*(row-1))
    for x in [-.31,.31]:
        for z in [.159,.799]:
            b('Tension strap',(x,0,z),(.022,.777,.003),g.m['strap'],.0007,part='straps')
        for y in [-.389,.389]:
            b('Corner strap',(x,y,.474),(.022,.003,.642),g.m['strap'],.0007,part='straps')
    for side in range(4):
        angle=side*math.pi/2
        width=1.075 if not side%2 else .755
        dist=.379 if not side%2 else .539
        pos=(math.sin(angle)*dist,-math.cos(angle)*dist,.477)
        sheet=g.panel('Creased outer stretch film',pos,(width,.647),film,
                      lambda u,v,n=side:.0038*math.sin(u*23.5+v*35+n)+.0029*math.cos(u*41-v*61)*(v-.5),
                      f'film-{side}',(20,19),0 if reuse_stock_geometry else .00043)
        sheet.rotation_euler=(math.pi/2,0,angle)


def trolley_artifact():
    b('Steel cart bed',(0,0,.157),(.612,.875,.047),steel,.018)
    for x in [-.25,.25]:
        for y in [-.34,.34]:
            cylinder('Vulcanized cart wheel',(x,y,.077),.074,.053,g.m['rubber'],True)
            cylinder('Hub rough finish',(x+(.031 if x>0 else -.031),y,.077),.031,.009,chrome,True)
    for x in [-.248,.248]:
        g.ribbon('Continuous bent cart tube',[(x,.392,.176),(x,.394,.82),(x,.413,.933),(x,.375,1.041)],.021,chrome)
    g.ribbon('Rubber grip',[(-.248,.375,1.041),(.248,.375,1.041)],.027,g.m['rubber'])
    for i in range(3):
        carton_item(-.071+(i%2)*.091,-.138+i*.015,.181+i*.193,i+1,.42,.46,.187,.04*(i-1))


def till_artifact():
    b('Calculator polymer case',(-.204,.03,.023),(.215,.295,.045),steel,.012)
    shield=b('Angled calculator display',(-.204,.123,.053),(.185,.076,.015),ink,.004)
    shield.rotation_euler.x=.15
    for row in range(5):
        for col in range(5):
            x=-.278+col*.0365
            y=.059-row*.040
            b('Calculator key',(x,y,.052),(.027,.029,.013),ivory if col<4 else palette[1],.003)
    b('Receipt pad',(.084,.085,.013),(.205,.293,.022),g.m['edge'],.004,.13)
    plane('Printed stock check slip',(.085,.085,.025),(.194,.283),stocks[2],.13)
    g.ribbon('Pen barrel',[(.148,-.072,.029),(.238,.028,.029)],.0049,steel)
    b('Hand tape dispenser',(.214,.261,.041),(.096,.165,.079),palette[1],.012,-.15)
    cylinder('Tape winding',(.218,.291,.108),.055,.046,g.m['tape'],True)


def register_asset(name,make,export):
    global reuse_stock_geometry
    collection=bpy.data.collections.new(name)
    g.scene.collection.children.link(collection)
    g.destination=collection
    reuse_stock_geometry=export
    try:
        make()
    finally:
        reuse_stock_geometry=False
    if export:
        MODELS.mkdir(parents=True,exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in collection.objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=next(iter(collection.objects))
        bpy.ops.export_scene.gltf(filepath=str(MODELS/f'{name}.glb'),export_format='GLB',
                                  use_selection=True,export_extras=True,export_apply=False,
                                  export_animations=False)
    g.scene.collection.children.unlink(collection)
    g.collections[name]=collection
    g.destination=g.stage


def shop(slot,x,z,rotation,deck):
    base=LAYOUT['decks'][deck]
    y=-z
    cos,sin=math.cos(rotation),math.sin(rotation)
    def at(a,d,h):
        return x+a*cos-d*sin,y+a*sin+d*cos,h+base
    def box(name,pos,size,mat,bevel=0,angle=0):
        return b(name,at(*pos),size,mat,bevel,rotation+angle)
    def face(name,pos,size,mat):
        return plane(name,at(*pos),size,mat,rotation,True)
    box('Clear showroom limestone floor',(0,1.96,.022),(6.14,3.95,.065),floor,.009)
    box('Painted back',(0,3.96,1.61),(6.17,.16,3.25),plaster,.017)
    box('Dark casing behind name',(0,.11,2.984),(6.16,.29,.572),palette[slot],.025)
    face('Farsi shop name',(0,-.045,3.01),(4.67,.48),signs[slot])
    for near in [-3.03,3.03]:
        box('Aluminium jamb',(near,.027,1.45),(.128,.205,2.92),steel,.015)
        box('Shop partition behind glass',(near,2.64,1.54),(.14,2.35,3.04),plaster,.01)
    # Two glazed panes to the left of the accessible opening.
    box('Counter glass base',(-.99,.016,.23),(3.83,.070,.46),steel,.01)
    for bar in [-2.91,-1.05,.93]:
        box('Thin glazed mullion',(bar,.012,1.53),(.043,.054,2.68),chrome,.004)
    face('Clear shop glazing',(-.99,-.029,1.56),(3.83,2.38),glass)
    box('Under-fascia tube',(0,.59,2.778),(5.58,.053,.039),opal,.007)
    for sx in [-1.95,0,1.95]:
        box('Shop steel back shelf',(sx,3.84,1.36),(1.84,.063,2.6),black,.012)
        for dx in [-.875,.875]:
            box('Stand painted upright',(sx+dx,3.55,1.404),(.04,.554,2.763),steel,.009)
        for row in range(6):
            h=.22+row*.419
            box('Scuffed powder-coated shelf',(sx,3.543,h),(1.78,.54,.041),ply,.006)
            for col in range(4):
                xx=sx-.65+col*.424+rng.uniform(-.015,.015)
                stock=(slot+row%3+col//3)%8
                if slot in [0,3,7] or row in [0,5]:
                    g.place(f'shelf-{stock}',at(xx,3.455,h+.025),rotation+rng.uniform(-.065,.065),
                            .89+(row%2)*.11)
                else:
                    for i in range(3+(col+row)%3):
                        box('Separated sample packets',(xx+i*.004,3.44,h+.055+i*.047),(.345,.40,.043),
                            palette[(slot+row+col)%8] if i%3==0 else ivory,.005,rng.uniform(-.048,.048))
    box('Dark checkout cabinet',(-.73,1.18,.477),(2.99,.83,.946),black,.033)
    box('Laminated counter lip',(-.73,1.18,.972),(3.08,.93,.098),ply,.019)
    for k in range(17):
        box('Vertically routed panel',(-2.04+k*.153,.745,.467),(.083,.026,.66),palette[slot],.005)
    g.place('counter-accessories',at(-.15,.97,1.027),rotation+.10,1.04)
    if slot==0:
        g.place('wrapped-stock-pallet',at(-2.124,2.45,.045),rotation+.06,.93)
        for i in range(3):
            g.place('paper-ream-open',at(-1.53,1.07,1.026+i*.054),rotation+.15*i,.99)
    elif slot in [3,7]:
        g.place('carton-open',at(-1.57,1.00,1.029),rotation+.24,1.05)
        g.place('kraft-roll',at(2.02,2.18,.042),rotation+.12,.78)
    else:
        for j in range(3):
            box('Loose paper tone fan',(-1.56+j*.144,1.15,1.029+j*.008),(.24,.37,.006),palette[(slot+j*2)%8],.002,j*.15)
    for xx in [-2.66,2.66]:
        for i in range(5):
            g.place(f'shelf-{(slot+i//2)%8}',at(xx,.74,.06+i*.215),rotation+rng.uniform(-.053,.053),.91)
    g.area('Shop fluorescent fill',at(-.25,1.50,2.733),at(-.60,1.8,.7),138,2.42,(1,.945,.88))


def station(id):
    spec=LAYOUT['stations'][id]
    x,z=spec['position'];y=-z;vertical=LAYOUT['decks'][spec['level']]
    w,d=spec['size']
    material=paint('Interactive work cabinet '+id,spec['accent'])
    b('Station powder-coated worktop',(x,y,vertical+.494),(w-.086,d-.12,.98),material,.052)
    b('Station solid edge',(x,y,vertical+1.004),(w,d,.067),ply,.026)
    if id=='roll':
        g.place('kraft-roll',(x-.046,y,vertical+1.043),.25,.56)
    elif id=='unwrap':
        for i in range(3):
            g.place('paper-ream-open',(x-.014,y-.245+i*.243,vertical+1.043),.15*i,.83)
    elif id=='fold':
        g.place('carton-open',(x+.024,y-.289,vertical+1.043),-.21,.76)
        b('Dieline sheet',(x-.027,y+.256,vertical+1.041),(.49,.46,.009),g.m['kraft'],.002,.13)
    elif id=='pallet':
        g.place('wrapped-stock-pallet',(x,y,vertical+1.028),.23,.59)
    elif id=='press':
        g.place('counter-accessories',(x,y,vertical+1.043),.23,1.12)
        for i in range(4):
            plane('Separation sample',(x,y-.348+i*.17,vertical+1.043),(.34,.164),stocks[i],.10*i)
    else:
        for i in range(7):
            b('Swatch on counter',(x+.05*((i%2)*2-1),y-.62+i*.203,vertical+1.045+i*.003),
              (.43,.224,.011),palette[(i+1)%8],.003,(-1)**i*.12)
    g.area('Worktop reflected lamp',(x*.87,y,vertical+2.96),(x,y,vertical+1.0),40,1.4,(1,.94,.88))


def passage():
    w=LAYOUT['width'];d=LAYOUT['depth'];h=LAYOUT['decks'][1]
    op=LAYOUT['opening'];half=op['halfWidth']; far=-op['far']; near=-op['near']
    b('Ground passage tile field',(0,0,-.084),(w,d,.162),floor,.017)
    for side in [-1,1]:
        span=w/2-half;cx=side*(half+span/2)
        b('Upper corridor floor',(cx,0,h-.147),(span,d,.296),floor,.019)
        b('Continuous plaster edge',(side*half,.16,h-.151),(.156,d-.4,.261),plaster,.016)
        b('Exposed thin floor fascia',(side*(half+.008),0,h-.11),(.07,d-.35,.112),petrol,.006)
        b('Exterior side casing',(side*(w/2-.1),0,LAYOUT['height']/2),(.20,d,LAYOUT['height']),plaster,.018)
        for y in [-12.13,-8.96,-5.79,-2.62,.57,3.74,6.91,10.08,13.25]:
            b('Brushed passage column',(side*2.919,y,1.63),(.165,.24,3.26),gray,.023)
            b('Recessed floor arc trim',(side*2.47,y,.013),(.078,2.95,.024),chrome,.004)
        for y in [-10.58,-8.04,-5.5,-2.96,-.42,2.12,4.66,7.20,9.74,12.13]:
            if not near<y<far:
                continue
            b('Balcony slim post',(side*(half+.015),y,h+.51),(.044,.059,1.022),steel,.006)
        middle=(near+far)/2
        b('Polished handrail',(side*(half+.018),middle,h+1.045),(.076,far-near,.057),chrome,.012)
        for index in range(8):
            pos=near+(index+.5)*(far-near)/8
            panel=plane('Balcony balustrade pane',(side*half,pos,h+.536),((far-near)/8-.045,.872),glass,math.pi/2,True)
        for y in [-11.55,-7.9,-4.23,-.55,3.13,6.81,10.49,14.17]:
            b('Recessed retail track',(side*2.67,y,h-.203),(.065,2.64,.065),steel,.006)
            b('Light strip',(side*2.67,y,h-.242),(.035,2.47,.020),opal,.003)
        b('Continuous porcelain skirting',(side*6.77,0,.188),(.106,d,.33),steel,.006)
    for low,high in [(-d/2,near),(far,d/2)]:
        b('Upper bridge over entry',(0,(low+high)/2,h-.147),(half*2+.055,high-low,.296),floor,.014)
    b('Front balcony cross rail',(0,near+.027,h+1.044),(half*2,.059,.057),chrome,.008)
    for sign in [-1,1]:
        b('Upper bridge newel',(sign*.94,far-.064,h+.511),(.056,.062,1.02),steel,.007)
        b('Return handrail',(sign*1.13,far+.017,h+1.044),(.642,.059,.059),chrome,.008)
    veil=plane('Front gallery glass',(0,near+.016,h+.536),(half*2-.06,.88),glass,0,True)
    b('Bright flat ceiling',(0,0,7.42),(w,d,.31),plaster,.035)
    for y in [-11.76,-7.40,-3.04,1.32,5.68,10.04,14.4]:
        b('Plenum transverse beam',(0,y,7.19),(w,.185,.123),gray,.022)
        b('Ceiling strip fixture',(0,y-.21,7.198),(6.21,.067,.059),opal,.012)
    b('End panel and elevator wall',(0,15.235,3.47),(16.42,.27,7.04),plaster,.064)
    b('Brushed lift panel',(-3.75,15.065,1.28),(2.21,.13,2.58),chrome,.019)
    b('Lift steel seam',(-3.75,14.992,1.29),(.016,.006,2.48),steel,.001)
    plane('End wayfinding at landing',(0,15.03,5.46),(4.81,1.02),floor_sign,0,True)
    plane('Baharestan directory',(0,14.98,2.15),(4.98,1.09),brand,0,True)
    s=LAYOUT['stairs'];length=s['low']-s['high'];tread=length/s['steps'];rise=h/s['steps']
    for i in range(s['steps']):
        actual=(i+1)*rise
        y=-s['low']+(i+.5)*tread
        b('Solid stair tread',(0,y,actual-.103),(s['width'],tread+.014,.207),floor,.007)
        b('Stair contrasting edge',(0,y-tread/2+.016,actual+.007),(s['width']-.046,.031,.015),steel,.003)
    for side in [-1,1]:
        x=side*(s['width']/2+.064)
        g.ribbon('Inclined steel support',[(x,-s['low'],.06),(x,-s['high'],h-.10)],.055,steel)
        g.ribbon('Handrail on stair',[(x,-s['low']-.13,.91),(x,-s['high']+.06,h+.96)],.026,chrome)
        for i in range(0,s['steps'],3):
            y=-s['low']+(i+.26)*tread
            z=i*rise+.114
            b('Inclined stair slim stanchion',(x,y,z+.43),(.041,.041,.90),steel,.005)
    for i,(x,z,r,level) in enumerate(LAYOUT['booths'][:8]):
        shop(i,x,z,r,level)
    for id in LAYOUT['stations']:
        station(id)
    g.place('loaded-paper-cart',(-1.84,-12.28,0),-.38,.85)
    g.place('wrapped-stock-pallet',(1.99,8.66,0),.13,.83)
    g.place('loaded-paper-cart',(-2.35,7.25,h),.28,.79)
    for y in [-10.2,-5.96,-1.7,2.57,6.82,11.08]:
        g.area('Daylight spill on balcony',(0,y,7.12),(.2,y,.79),385,3.57,(.89,.95,1))
        for x in [-3.4,3.4]:
            g.area('Fluorescent wash under mezzanine',(x,y,3.28),(x+.215,y,.64),79,2.1,(1,.93,.81))
    g.area('Street through entrance',(-.88,-16.14,3.52),(.28,-6.8,.92),508,4.21,(.84,.93,1))
    g.area('Soft end landing lamp',(1.54,11.6,5.5),(-.7,8.3,2.6),169,3.2,(1,.88,.72))


def detail():
    for obj in list(g.stage.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    b('Warehouse floor',(0,0,-.07),(7.1,8.2,.14),floor,.015)
    b('Plastered backdrop',(0,2.41,1.66),(7,.19,3.31),plaster,.026)
    g.place('wrapped-stock-pallet',(0,0,0),-.22,1)
    g.place('loaded-paper-cart',(-.94,1.06,0),.22,.95)
    g.area('Narrow fluorescent pool',(-1.2,-1.3,2.4),(0,0,.48),157,1.4,(1,.93,.81))
    g.area('Warehouse door cool fill',(1.44,-1.3,1.65),(0,0,.52),69,1.87,(.87,.95,1))


def register_stock(export=False):
    for id,build in [('wrapped-stock-pallet',bundle_artifact),('loaded-paper-cart',trolley_artifact),('counter-accessories',till_artifact)]:
        register_asset(id,build,export)
    for i in range(8):
        register_asset(f'shelf-{i}',lambda k=i:carton_item(0,0,0,k,.39,.43,.20),False)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--frames',nargs='*',default=['passage','store','balcony','stock'])
    parser.add_argument('--samples',type=int,default=64)
    parser.add_argument('--scale',type=int,default=100)
    parser.add_argument('--no-export',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    register_stock(not args.no_export)
    if any(key!='stock' for key in args.frames):
        passage()
    RENDERS.mkdir(parents=True,exist_ok=True)
    scene=g.scene
    scene.cycles.samples=args.samples
    scene.cycles.adaptive_threshold=.047
    scene.render.resolution_percentage=args.scale
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.65,.82,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.25
    scene.view_settings.look='AgX - Medium High Contrast'
    shots={
        'passage':((.36,-13.94,1.78),(-.26,-3.19,2.76),24,(1536,1000)),
        'store':((.55,-9.00,1.79),(4.6,-10.75,1.46),26,(1440,965)),
        'balcony':((-2.13,-9.34,5.48),(0,6.34,4.46),26,(1440,960)),
        'stock':((1.61,-2.17,1.42),(-.14,.025,.56),54,(1280,880)),
    }
    for key in args.frames:
        if key=='stock':
            detail()
        eye,target,lens,resolution=shots[key]
        scene.camera.location=eye
        scene.camera.rotation_euler=(Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.camera.data.lens=lens
        scene.render.resolution_x,scene.render.resolution_y=resolution
        scene.render.filepath=str(RENDERS/f'{key}.png')
        bpy.ops.render.render(write_still=True)
        print('V5_RENDER_READY',key,flush=True)


if __name__ == '__main__':
    main()
