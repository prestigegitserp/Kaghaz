"""Blender 4.3+ authoring, metric glTF export and CPU Cycles review renders.
Coordinates: Blender Z up; glTF exporter converts to Y up. Every reusable asset
has its origin at floor center, independent of SKU identity and shop layout.
"""
import bpy, math, json, sys, random
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
TEX=ROOT/'.asset-build/textures'; OUT=ROOT/'public/v2/models'; RENDER=ROOT/'.asset-build/renders'
OUT.mkdir(parents=True,exist_ok=True);RENDER.mkdir(parents=True,exist_ok=True)
random.seed(421)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def mat(name,color=(.5,.5,.5),rough=.7,metal=0,texture=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if texture:
        nodes=m.node_tree.nodes;links=m.node_tree.links
        for suffix,socket in [('color','Base Color'),('rough','Roughness'),('normal','Normal')]:
            path=TEX/f'{texture}-{suffix}.png'
            if not path.exists():continue
            t=nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(path),check_existing=True)
            if suffix!='color':t.image.colorspace_settings.name='Non-Color'
            if suffix=='normal':n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.32 if texture in ['paper','kraft'] else .65;links.new(t.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],p.inputs[socket])
            else:links.new(t.outputs['Color'],p.inputs[socket])
    return m
def image_mat(name,path,rough=.65):
    m=mat(name,rough=rough);n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(TEX/path),check_existing=True);m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes['Principled BSDF'].inputs['Base Color']);return m
M={
 'paper':mat('Cotton paper',(1,1,1),texture='paper'),
 'kraft':mat('Kraft fibers',(1,1,1),texture='kraft'),
 'wood':mat('Rubbed walnut',(1,1,1),texture='walnut'),
 'stone':mat('Limestone',(1,1,1),texture='limestone'),
 'brick':mat('Handmade brick',(1,1,1),texture='brick'),
 'plaster':mat('Lime plaster',(1,1,1),texture='plaster'),
 'green':mat('Painted forest green',(.065,.13,.085),.58),
 'brass':mat('Aged brass',(.36,.24,.095),.42,.8),
 'steel':mat('Shelf powder coat',(.055,.072,.058),.62,.4),
 'core':mat('Cardboard inner core',(.135,.088,.043),.96),
 'strap':mat('Paper bundle strapping',(.42,.33,.16),.46),
 'edge':image_mat('Fine paper sheet edges','paper-edge.png',.94),
 'wrapper':image_mat('Printed Kaghaz wrapper','wrapper.png',.53),
 'label':image_mat('Stock handling label','stock-label.png',.84),
 'sign':image_mat('Persian merchant fascia','merchant-sign.png',.71),
 'rubber':mat('Soft rubber',(.016,.02,.015),.95),
}
CURRENT=[]
def box(name,loc,size,material,bevel=.002,rot=(0,0,0),role=''):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
    if material==M['brick']:
        # Triplanar metric UVs: horizontal brick courses at architectural scale.
        for face in o.data.polygons:
            axis=max(range(3),key=lambda i:abs(face.normal[i])); axes=(1,2) if axis==0 else (0,2) if axis==1 else (0,1)
            for loop in face.loop_indices:
                co=o.data.vertices[o.data.loops[loop].vertex_index].co
                o.data.uv_layers.active.data[loop].uv=(co[axes[0]]/1.2,co[axes[1]]/.8)
    if bevel:
        mod=o.modifiers.new('Small manufactured edge','BEVEL');mod.width=min(bevel,min(size)*.4);mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        n=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');n.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=n.name)
    if role:o['part']=role
    CURRENT.append(o);return o
def plane(name,loc,size,material,rot=(0,0,0),role=''):
    bpy.ops.mesh.primitive_plane_add(size=1,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.scale=(size[0],size[1],1);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
    if role:o['part']=role
    CURRENT.append(o);return o
def cyl(name,loc,radius,depth,material,vertices=48,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.data.materials.append(material)
    bevel=o.modifiers.new('Edge glint','BEVEL');bevel.width=.0015;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in o.data.polygons:p.use_smooth=abs(p.normal.z)<.9
    CURRENT.append(o);return o
def curve(name,points,radius,material):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material);CURRENT.append(o);return o
def ream():
    box('500-sheet block',(0,0,.026),(.210,.297,.050),M['edge'],.001,role='sheets')
    box('Thin wrapper underneath',(0,0,.001),(.215,.303,.0016),M['paper'],.0003,role='wrapper')
    plane('Printed top wrapper',(0,0,.0525),(.215,.303),M['wrapper'],role='wrapper')
    for side in [-1,1]:
        box('Folded side wrapper',(side*.106,0,.027),(.002,.303,.052),M['paper'],.0006,role='wrapper')
        for end in [-1,1]:
            box('Envelope fold',(side*.071,end*.1505,.027),(.071,.001,.051),M['paper'],.0002,rot=(0,side*.009,0),role='wrapper')
    for end in [-1,1]:
        # Tiny folded triangular seams and a green seam strip on the wrapper end.
        box('End seal',(0,end*.152,.027),(.214,.0012,.051),M['green'],.0003,role='wrapper')
        for i in range(4):box('Wrapper crease',(-.08+i*.052,end*.1528,.027),(.001,.0008,.036),M['paper'],0,rot=(0,0,(i-1.5)*.03),role='wrapper')
def pallet():
    # 1200 × 800 mm warehouse pallet: blocks, bearers and deck boards.
    for x in [-.48,0,.48]:
        for y in [-.29,0,.29]:box('Pallet bearing block',(x,y,.065),(.13,.13,.1),M['wood'],.005)
    for y in [-.29,0,.29]:box('Bottom bearer',(0,y,.018),(1.2,.115,.026),M['wood'],.003)
    for x in [-.51,-.255,0,.255,.51]:
        box('Pallet deck board',(x,0,.136),(.175,.8,.028),M['wood'],.003)
        for y in [-.29,.29]:
            for dx in [-.045,.045]:cyl('Recessed nail',(x+dx,y,.1505),.003,.001,M['steel'],12)
def bundle():
    for i in range(5):box('Flat stock layers',(0,0,.021+i*.035),(.71,.99,.034),M['edge'],.001,role='sheets')
    plane('Top sheet',(0,0,.180),(.71,.99),M['paper'],role='sheets')
    for x in [-.235,.235]:
        for z in [.004,.184]:box('Horizontal band',(x,0,z),(.024,1.005,.002),M['strap'],.0004,role='straps')
        for y in [-.501,.501]:box('Tensioned band',(x,y,.093),(.024,.002,.18),M['strap'],.0004,role='straps')
    plane('Stock label',(0,-.1,.182),(.27,.135),M['label'])
def carton(opened=True):
    w,d,h=.42,.32,.28;t=.003
    for y in [-d/2,d/2]:box('Corrugated long panel',(0,y,h/2),(w,t,h),M['kraft'],.0007,role='walls')
    for x in [-w/2,w/2]:box('Corrugated end panel',(x,0,h/2),(t,d,h),M['kraft'],.0007,role='walls')
    box('Box base',(0,0,.003),(w,d,.006),M['kraft'],.0008,role='walls')
    if opened:
        for sign in [-1,1]:
            # Flaps hinge around a realistic top edge and extend outward.
            box('Long folding flap',(0,sign*(d/2+.054),h+.036),(w,.13,t),M['kraft'],.0005,rot=(sign*.56,0,0),role='flaps')
            box('Short folding flap',(sign*(w/2+.045),0,h+.023),(.10,d*.94,t),M['kraft'],.0005,rot=(0,-sign*.45,0),role='flaps')
        for i in range(4):box('Packing paper',(0,0,.05+i*.014),(.28,.23,.012),M['paper'],.002,rot=(0,0,i*.04))
    else:
        box('Closed flap',(-w/4,0,h),(.209,d,.003),M['kraft'],.0008,role='flaps');box('Closed flap',(w/4,0,h),(.209,d,.003),M['kraft'],.0008,role='flaps')
        box('Sealing tape',(0,0,h+.002),(.045,d,.0012),M['strap'],.0003)
    plane('Shipping label',(.035,-d/2-.002,h*.51),(.22,.11),M['label'],(math.pi/2,0,0))
    for side in [-1,1]:
        # Exposed wavy corrugation at the cut top edge, visible in close inspection.
        points=[(-w/2+i*w/90,side*d/2+math.sin(i*math.pi*1.3)*.0008,h+.001) for i in range(91)]
        curve('Visible liner edge',points,.00065,M['core'])
def roll():
    radius=.32;inner=.055;h=.92;segments=96
    verts=[];faces=[];uv=[]
    for z in [0,h]:
        for r in [inner,radius]:
            for i in range(segments):a=2*math.pi*i/segments;verts.append((r*math.cos(a),r*math.sin(a),z))
    for i in range(segments):
        j=(i+1)%segments
        faces.extend([(segments+i,segments+j,3*segments+j,3*segments+i),(i,2*segments+i,2*segments+j,j),(2*segments+i,3*segments+i,3*segments+j,2*segments+j),(i,j,segments+j,segments+i)])
    mesh=bpy.data.meshes.new('Annular paper roll mesh');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Hollow industrial paper roll',mesh);bpy.context.collection.objects.link(o)
    o.data.materials.append(M['kraft']);o.data.materials.append(M['core']);CURRENT.append(o)
    for i,p in enumerate(mesh.polygons):p.material_index=1 if i%4==1 else 0;p.use_smooth=i%4 in [0,1]
    # Rings are curves, the bore remains genuinely open from both ends.
    for r in [.062,.073,.087,.105,.13,.158,.188,.219,.25,.278,.302,.316]:
        pts=[(r*math.cos(i*math.pi/48),r*math.sin(i*math.pi/48),h+.0004) for i in range(97)]
        curve('Fine winding line',pts,.00035,M['core'])
    vertices=[];faces=[]
    for iz in range(2):
        for i in range(25):
            u=i/24;vertices.append((radius+u*.32,-.055+math.sin(u*2.5)*.08,.06+iz*.74))
    for i in range(24):faces.append((i,i+1,i+26,i+25))
    mesh=bpy.data.meshes.new('Loose curved paper tail');mesh.from_pydata(vertices,[],faces);mesh.update();tail=bpy.data.objects.new('Thin free paper sheet',mesh);bpy.context.collection.objects.link(tail);tail.data.materials.append(M['kraft']);CURRENT.append(tail)
def swatch():
    colors=['#e5d7b8','#d5b67c','#af755b','#8e9b76','#6d9999','#57778c','#947e98','#4b6b57']
    for i,hexcolor in enumerate(colors):
        rgb=tuple(int(hexcolor[j:j+2],16)/255 for j in (1,3,5));material=mat('Dyed paper '+str(i),rgb,.91)
        a=(i-3.5)*.18;box('Swatch leaf '+str(i),(math.sin(a)*.085,-math.cos(a)*.085,.012+i*.0014),(.065,.205,.0012),material,.0004,rot=(0,0,a),role='swatch')
    cyl('Brass sample pivot',(0,.013,.027),.0055,.015,M['brass'],24)
def counter():
    box('Merchant counter carcass',(0,0,.42),(3.45,.79,.84),M['wood'],.012,role='case')
    box('Limestone counter surface',(0,0,.895),(3.65,.98,.075),M['stone'],.009,role='top')
    box('Kickboard',(0,-.426,.065),(3.4,.018,.11),M['green'],.002)
    for x in [-1.14,0,1.14]:
        box('Recessed front panel',(x,-.426,.46),(1.03,.018,.59),M['green'],.004)
        for z in [.18,.75]:box('Raised walnut rail',(x,-.45,z),(1.06,.035,.027),M['wood'],.003)
        for xx in [x-.52,x+.52]:box('Raised walnut stile',(xx,-.45,.465),(.027,.035,.58),M['wood'],.003)
        box('Brass detail',(x,-.474,.74),(.86,.008,.007),M['brass'],.001)
    for x in [-1.56,1.56]:
        for y in [-.32,.32]:box('Counter foot',(x,y,.033),(.1,.1,.064),M['steel'],.003)

def notebook():
    box('Sewn notebook page block',(0,0,.011),(.14,.205,.019),M['edge'],.001,role='sheets')
    for z in [.001,.023]:box('Cloth-bound cover',(0,0,z),(.147,.213,.0025),M['green'],.001,role='cover')
    box('Bound cloth spine',(-.073,0,.012),(.003,.213,.023),M['green'],.001,role='spine')
    for y in [-.065,.065]:box('Spine stitch',(-.075,y,.013),(.0007,.008,.0015),M['paper'],0,role='spine')
    for y in [-.04,-.027,-.014]:box('Foil cover lines',(.013,y,.0245),(.06,.001,.0006),M['brass'],0,role='cover')

BUILDERS={'notebook':notebook,'paper-ream':ream,'wood-pallet':pallet,'paper-bundle':bundle,'carton-open':lambda:carton(True),'carton-closed':lambda:carton(False),'kraft-roll':roll,'swatch-fan':swatch,'merchant-counter':counter}
ASSETS={}
only=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--only=')),None)
for key,fn in BUILDERS.items():
    if only and key!=only:continue
    CURRENT=[];fn();objects=list(CURRENT)
    # UV unwrap meshes lacking UVs, keeping plane label coordinates intact.
    for o in objects:
        if o.type=='MESH' and not o.data.uv_layers:
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True);o['asset_id']=key
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{key}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    for o in objects:o.hide_render=True;o.hide_set(True)
    ASSETS[key]=objects
    print('ASSET_EXPORTED',key,flush=True)

def instance(key,location=(0,0,0),rotation=0,scale=1):
    parent=bpy.data.objects.new('Instance '+key,None);bpy.context.collection.objects.link(parent)
    for source in ASSETS[key]:
        obj=source.copy();obj.data=source.data;bpy.context.collection.objects.link(obj);obj.hide_render=False;obj.hide_set(False);obj.parent=parent
    parent.location=location;parent.rotation_euler.z=rotation;parent.scale=(scale,)*3;return parent
if only:
    print('KAGHAZ_V2_ASSET_ONLY_COMPLETE',only,flush=True);sys.exit(0)
CURRENT=[]
# A real assembled review shop. Same metric fixture sizes and asset families as the web runtime.
box('Shop limestone floor',(0,0,-.07),(8.2,6.7,.12),M['stone'],.006)
box('Rear lime wall',(0,2.7,1.95),(8.2,.16,4),M['plaster'],.006)
for x in [-3.85,3.85]:box('Return wall',(x,.15,1.95),(.18,5.3,4),M['brick'],.01)
for x in [-3.55,3.55]:box('Entry brick pier',(x,-2.4,1.8),(.5,.55,3.6),M['brick'],.012)
box('Fascia beam',(0,-2.41,3.47),(7.4,.22,.75),M['green'],.006)
plane('Persian sign',(0,-2.535,3.5),(5.6,.87),M['sign'],(math.pi/2,0,0))
for sx in [-2.2,0,2.2]:
    for x in [sx-.94,sx+.94]:box('Shelf uprights',(x,2.2,1.53),(.045,.64,3.05),M['steel'],.003)
    for row in range(5):
        z=.15+row*.61;box('Shelf plank',(sx,2.2,z),(1.96,.68,.048),M['wood'],.003)
        for col in range(5):
            for layer in range(3):instance('paper-ream',(sx-.76+col*.38,2.2,z+.03+layer*.057),rotation=(random.random()-.5)*.04)
instance('merchant-counter',(-.65,-.95,0))
for i in range(4):instance('paper-ream',(-1.4,-1.02,.936+i*.055),rotation=i*.025)
instance('swatch-fan',(-.45,-1.1,.937),rotation=-.2,scale=1.5)
instance('carton-open',(.52,-.95,.937),rotation=-.13)
instance('wood-pallet',(-2.65,.6,0));instance('wood-pallet',(2.55,.7,0))
for i in range(3):instance('paper-bundle',(-2.65,.6,.16+i*.186),rotation=i*.007)
instance('kraft-roll',(2.55,.7,.16));instance('kraft-roll',(3.05,1.42,.16),scale=.72)
instance('carton-closed',(1.6,1.5,.02));instance('carton-closed',(1.63,1.5,.306),rotation=.04)
for x in [-2.2,.3,2.6]:
    box('Stock labels on shelving',(x,1.846,2.03),(.36,.007,.16),M['paper'],.001)
# Small merchant desk details: ledger and pen.
box('Ledger pages',(-1.95,-1.04,.96),(.22,.3,.036),M['edge'],.001,rot=(0,0,.12))
box('Ledger green cover',(-1.95,-1.04,.981),(.225,.31,.006),M['green'],.001,rot=(0,0,.12))
cyl('Brass pen',(-1.83,-1.13,.992),.003,.19,M['brass'],16,rot=(0,math.pi/2,.25))

def area(name,location,power,size,color,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
area('Large daylight softbox',(-3,-5,6),1450,5,(1,.93,.79),(0,0,1))
area('Cool reflected fill',(4,-1,4.8),800,4,(.77,.86,1),(0,0,1))
area('Warm rear bounce',(-1,2,3.4),400,2,(1,.81,.57),(0,-1,1))
s=bpy.context.scene;s.world.color=(.24,.24,.24);s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=240;s.cycles.use_denoising=False;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.015;s.render.film_transparent=False;s.render.image_settings.file_format='PNG';s.render.resolution_x=1200;s.render.resolution_y=820;s.render.resolution_percentage=100;s.render.threads_mode='FIXED';s.render.threads=6
s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.render.use_persistent_data=True
data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',data);bpy.context.collection.objects.link(camera);s.camera=camera
poses=[('merchant-wide',(6.7,-10.5,5.3),(-.2,.3,1.55),42),('counter-detail',(-2.8,-4.2,2.5),(-.55,-.75,1.02),54),('stock-and-roll',(2.8,-1.7,2.2),(2.45,.8,.7),48)]
for name,position,target,lens in poses:
    camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();data.lens=lens;s.render.filepath=str(RENDER/f'{name}.png');bpy.ops.render.render(write_still=True);print('REVIEW_RENDER_READY',name,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.asset-build/kaghaz-v2-authoring.blend'),compress=True)
print('KAGHAZ_V2_BLENDER_COMPLETE',flush=True)
