"""Author metric assets and photograph the v3 market in Blender 4.3+ / Cycles."""
from pathlib import Path
import argparse
import math
import random
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
TEX = ROOT / '.asset-build/v3-textures'
RENDERS = ROOT / '.asset-build/v3-renders'
MODELS = ROOT / '.asset-build/v3-models'
rng = random.Random(549)

parser = argparse.ArgumentParser()
parser.add_argument('--frames', nargs='*', default=['market', 'workshop', 'ream', 'roll', 'carton', 'bundle'])
parser.add_argument('--samples', type=int, default=52)
parser.add_argument('--scale', type=int, default=100)
parser.add_argument('--no-export', action='store_true')
args = parser.parse_args(
    sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
) if __name__ == '__main__' else parser.parse_args(['--frames', '--no-export'])

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
stage = bpy.data.collections.new('Review stage')
scene.collection.children.link(stage)
templates = bpy.data.collections.new('Source assets')
scene.collection.children.link(templates)
destination = stage


def material(name, color=(.5, .5, .5), rough=.7, metal=0, texture=None,
             diffuse=None, tiles=None, normal=.5, emission=0):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    nodes, links = value.node_tree.nodes, value.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission

    def image(key, colorspace):
        node = nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(str(TEX / (key + '.png')), check_existing=True)
        node.image.colorspace_settings.name = colorspace
        return node

    if texture or diffuse:
        links.new(image(diffuse or texture + '-color', 'sRGB').outputs['Color'], shader.inputs['Base Color'])
    if texture:
        rough_image = image(texture + '-rough', 'Non-Color')
        links.new(rough_image.outputs['Color'], shader.inputs['Roughness'])
        normal_node = nodes.new('ShaderNodeNormalMap')
        normal_node.inputs['Strength'].default_value = normal
        links.new(image(texture + '-normal', 'Non-Color').outputs['Color'], normal_node.inputs['Color'])
        links.new(normal_node.outputs['Normal'], shader.inputs['Normal'])
    if tiles:
        value['meters_per_tile'] = tiles
    return value


m = {
    'paper': material('Uncoated paper / fibers', texture='sheet', normal=.55),
    'edge': material('Compressed cut edges', diffuse='sheet-edge', rough=.86),
    'kraft': material('Recycled kraft liner', texture='kraft', normal=.65),
    'core': material('Unbleached wound core', (.21, .105, .042), .89),
    'ring': material('Concentric paper windings', diffuse='roll-ring', rough=.85),
    'wrapper': material('Satin flexo printed wrapper', texture='sheet', diffuse='press-wrapper', normal=.27),
    'label': material('Printed shipment label', diffuse='packing-label', rough=.74),
    'wood': material('Worn softwood', texture='wood', tiles=(1.22, 1.22), normal=.64),
    'brick': material('Plaster over masonry', texture='brick', tiles=(1.42, 1.42), normal=.76),
    'plaster': material('Weathered lime plaster', texture='plaster', tiles=(1.78, 1.78), normal=.53),
    'floor': material('Worn stone aggregate', texture='floor', tiles=(2.05, 2.05), normal=.55),
    'green': material('Faded pine-green enamel', (.041, .084, .067), .53),
    'wood-dark': material('Dark oil rubbed timber', (.113, .060, .033), .57),
    'steel': material('Painted steel shelving', (.054, .065, .058), .56, .28),
    'brass': material('Oxidized brass', (.41, .27, .11), .37, .65),
    'rubber': material('Black desk mat', (.055, .063, .055), .92),
    'strap': material('Woven deep green strap', (.043, .085, .059), .65),
    'tape': material('Aged amber carton tape', (.40, .23, .08), .24),
    'bulb': material('Warm diffused filament', (.99, .72, .38), emission=5),
}
palette = [material('Dyed paper ' + str(i), color, .8) for i, color in enumerate([
    (.75, .62, .39), (.34, .12, .067), (.16, .26, .14), (.17, .29, .31), (.30, .23, .34),
])]
signs = [material('Shop fascia ' + str(i), diffuse=f'fascia-{i}', rough=.62) for i in range(5)]


def mesh(name, vertices, faces, surface, uv=None, part=None, at=(0, 0, 0)):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    destination.objects.link(obj)
    obj.location = at
    data.materials.append(surface)
    layer = data.uv_layers.new()
    for polygon in data.polygons:
        for loop, vi in zip(polygon.loop_indices, polygon.vertices):
            if uv is not None:
                coord = uv(vi, polygon)
            else:
                coord = vertices[vi][:2]
            layer.data[loop].uv = coord
    if part:
        obj['part'] = part
    return obj


def box(name, at, size, surface, bevel=.0, angle=0, part=None):
    x, y, z = (d * .5 for d in size)
    vertices = [(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),
                (-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    faces = [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]

    def uv(vi, face):
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        axes = ((1,2),(0,2),(0,1))[axis]
        tiles = surface.get('meters_per_tile', [size[i] for i in axes])
        return tuple(vertices[vi][a] / tiles[i] + .5 for i, a in enumerate(axes))

    obj = mesh(name, vertices, faces, surface, uv, part, at)
    obj.rotation_euler.z = angle
    if bevel:
        mod = obj.modifiers.new('Worn edge', 'BEVEL')
        mod.width, mod.segments = min(bevel, min(size) * .42), 2
        normal = obj.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    return obj


def panel(name, at, size, surface, shape, part=None, grid=(14, 22), thickness=.00028):
    nx, ny = grid
    uv = [(i / nx, j / ny) for j in range(ny + 1) for i in range(nx + 1)]
    vertices = [((u - .5) * size[0], (v - .5) * size[1], shape(u, v)) for u, v in uv]
    faces = [(j*(nx+1)+i, j*(nx+1)+i+1, (j+1)*(nx+1)+i+1, (j+1)*(nx+1)+i)
             for j in range(ny) for i in range(nx)]
    obj = mesh(name, vertices, faces, surface, lambda i, _: uv[i], part, at)
    for face in obj.data.polygons:
        face.use_smooth = True
    if thickness:
        mod = obj.modifiers.new('Paper thickness', 'SOLIDIFY')
        mod.thickness = thickness
    return obj


def crease(u, v):
    waves = math.sin(u * 24 + v * 14) + .55 * math.sin(u * 55 - v * 28)
    edge = abs(2 * u - 1) ** 7 + abs(2 * v - 1) ** 7
    return .00037 * waves * (.25 + edge)


def ream(opened=False):
    box('500-sheet block', (0,0,.026), (.210,.297,.05), m['edge'], .00045, part='sheets')
    box('Folded underside', (0,0,.001), (.215,.302,.0015), m['wrapper'], .0003, part='wrapper')
    if opened:
        for i in range(5):
            panel('Loose curled sheet', (i*.0015, i*.001, .052+i*.00055), (.210,.297), m['paper'],
                  lambda u,v, n=i: (.009 + n * .003) * max(0, (1-u)*.85 + (1-v)*.25 - .51) ** 1.38
                       + (.016+n*.003) * max(0, u+v-.98) ** 2 + crease(u,v) * .14,
                  'loose-sheets')
        panel('Peeling printed wrapper', (.038,-.045,.057), (.215,.302), m['wrapper'],
              lambda u,v: .067 * max(0, u + .9*v - .92) ** 1.78 + crease(u,v),
              'wrapper', (20, 30))
    else:
        panel('Printed flexible wrapper', (0,0,.0523), (.215,.302), m['wrapper'],
              crease, 'wrapper', (10, 16))
    for side in [-1, 1]:
        box('Folded kraft seam', (side*.107,0,.025), (.0016,.303,.05), m['green'], .00036, part='wrapper')
        if not opened or side == 1:
            box('End fold', (0, side*.1515,.025), (.215,.0011,.05), m['green'], .0003, part='wrapper')
            for x in [-.088,.088]:
                seam = box('Creased end overlap', (x,side*.1521,.025), (.037,.0009,.045),
                           m['paper'], .0004, part='wrapper')
                seam.rotation_euler.y = x * 1.6


def carton():
    w, d, h, t = .42, .32, .275, .004
    box('Corrugated base', (0,0,t/2), (w,d,t), m['kraft'], .001)
    for side in [-1, 1]:
        box('Long liner', (0,side*(d-t)/2,h/2), (w,t,h), m['kraft'], .001)
        box('End liner', (side*(w-t)/2,0,h/2), (t,d-2*t,h), m['kraft'], .001)
        fold = panel('Long folding flap', (0,side*(d/2+.063),h+.026), (w,.142), m['kraft'],
                     lambda u,v: crease(u,v)*5, 'flaps', (12,7), thickness=t)
        fold.rotation_euler.x = side*.43
        fold = panel('Short folding flap', (side*(w/2+.047),0,h+.017), (.112,d-2*t), m['kraft'],
                     lambda u,v: crease(u,v)*4, 'flaps', (7,10), thickness=t)
        fold.rotation_euler.y = -side*.34
        points = [(-w/2+i*w/144, side*d/2+math.sin(i*1.83)*.00115, h+.0005) for i in range(145)]
        ribbon('Visible corrugation', points, .00045, m['core'], 'liner')
    for i in range(3):
        panel('Packing paper fold', (0,.005,.027+i*.013), (.31,.23), m['paper'],
              lambda u,v: (1-v)**3*.04 + math.sin(u*13+v*3)*.005, 'fill', (10,11))
    label = panel('Marked shipment label', (.045,-d/2-.001,.131), (.19,.095), m['label'],
                  lambda u,v: 0, grid=(1,1))
    label.rotation_euler.x = math.pi/2
    box('Tape remnant', (-.102,-d/2-.001,.219), (.043,.002,.085), m['tape'], .0006)


def ribbon(name, points, radius, surface, part=None):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions, data.bevel_depth, data.bevel_resolution = '3D', radius, 0
    spline = data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for pt, (x,y,z) in zip(spline.points, points):
        pt.co = (x,y,z,1)
    obj = bpy.data.objects.new(name, data)
    destination.objects.link(obj)
    obj.data.materials.append(surface)
    if part:
        obj['part'] = part
    return obj


def roll():
    outer, inner, h, n = .32, .051, .92, 100
    loops = [(outer-.001,0),(outer,.003),(outer,h-.003),(outer-.001,h),(.064,h),
             (inner,h-.004),(inner,.004),(.064,0)]
    for band, ((rx,zx),(ry,zy)) in enumerate(zip(loops, loops[1:]+loops[:1])):
        vertices = []
        for radius,z in [(rx,zx),(ry,zy)]:
            for i in range(n+1):
                a = i * 2 * math.pi/n
                wrinkle = .00052 * math.sin(a*17) + .00025 * math.sin(a*37)
                vertices.append((radius*math.cos(a),radius*math.sin(a),z+wrinkle))
        faces = [(i,i+1,i+n+2,i+n+1) for i in range(n)]
        if band in [3, 7]:
            surface, part = m['ring'], 'windings'

            def uv(i, _):
                return (vertices[i][0]/(outer*2)+.5, vertices[i][1]/(outer*2)+.5)
        else:
            surface, part = (m['core'], 'core') if 4 <= band <= 6 else (m['kraft'], 'windings')

            def uv(i, _):
                return ((i % (n+1))/n, vertices[i][2]/h)
        obj = mesh('Wound roll band', vertices, faces, surface, uv, part)
        for face in obj.data.polygons:
            face.use_smooth = band in [1,5]
    vertices = []
    for j in range(9):
        for i in range(26):
            u,v = i/25,j/8
            vertices.append((.311 + u*.35, -.049-u*.065-math.sin(u*2.9)*.105,
                             .066+v*.81+math.sin(u*5.6)*.009*v))
    faces = [(j*26+i,j*26+i+1,(j+1)*26+i+1,(j+1)*26+i) for j in range(8) for i in range(25)]
    tail = mesh('Peeled kraft sheet', vertices, faces, m['kraft'],
                lambda i,_: ((i%26)/25,(i//26)/8), 'loose-sheets')
    for face in tail.data.polygons:
        face.use_smooth = True
    tail.modifiers.new('Thin paper', 'SOLIDIFY').thickness = .0009


def bundle():
    for i in range(5):
        offset = rng.uniform(-.004,.004)
        box('Layered large-format paper', (offset,0,.020+i*.035), (.71,.99,.034), m['edge'],
            .001, part='sheets')
    panel('Loose top sheet', (0,0,.178), (.71,.99), m['paper'],
          lambda u,v: .004 * (u*v)**5, 'loose-sheets', (6,8))
    for x in [-.235,.235]:
        for z in [.003,.182]:
            box('Tensioned strapping', (x,0,z), (.021,1.004,.002), m['strap'], .0004, part='straps')
        for y in [-.501,.501]:
            box('Strap along cut edge', (x,y,.093), (.021,.002,.18), m['strap'], .0004, part='straps')
    panel('Batch label', (.085,-.182,.183), (.23,.118), m['label'], lambda u,v: 0,
          part='label', grid=(1,1))


def pallet():
    for x in [-.48,0,.48]:
        for y in [-.29,0,.29]:
            box('Heavy wood block', (x,y,.067), (.13,.13,.10), m['wood'], .004)
    for y in [-.29,0,.29]:
        box('Base runner', (0,y,.018), (1.2,.115,.028), m['wood'], .004)
        box('Upper runner', (0,y,.112), (1.2,.107,.020), m['wood'], .003)
    for x in [-.51,-.255,0,.255,.51]:
        box('Deck plank', (x,0,.136), (.175,.8,.028), m['wood'], .004)
        for y in [-.29,.29]:
            for dx in [-.041,.041]:
                box('Recessed square head', (x+dx,y,.1503), (.006,.006,.0012), m['steel'], .0004)


catalog = {
    'paper-ream': ream, 'paper-ream-open': lambda: ream(True),
    'carton-open': carton, 'kraft-roll': roll, 'paper-bundle': bundle, 'wood-pallet': pallet,
}
collections = {}
for key, build in catalog.items():
    destination = bpy.data.collections.new(key)
    templates.children.link(destination)
    collections[key] = destination
    build()
    if not args.no_export:
        MODELS.mkdir(parents=True, exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in destination.objects:
            obj['asset_id'] = key
            obj.select_set(True)
        bpy.context.view_layer.objects.active = next(iter(destination.objects))
        bpy.ops.export_scene.gltf(filepath=str(MODELS / f'{key}.glb'), export_format='GLB',
                                  use_selection=True, export_apply=True, export_extras=True,
                                  export_yup=True, export_animations=False)
        print('GLB_READY', key, flush=True)
scene.collection.children.unlink(templates)
destination = stage


def place(key, at, angle=0, scale=1, tilt=0):
    obj = bpy.data.objects.new(key, None)
    stage.objects.link(obj)
    obj.instance_type = 'COLLECTION'
    obj.instance_collection = collections[key]
    obj.location, obj.scale, obj.rotation_euler = at, (scale,)*3, (0,tilt,angle)
    return obj


def area(name, at, target, power, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.size, data.color = power, size, color
    obj = bpy.data.objects.new(name, data)
    stage.objects.link(obj)
    obj.location = at
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


def bulb(at, size):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=size, location=at)
    obj = bpy.context.object
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    stage.objects.link(obj)
    obj.data.materials.append(m['bulb'])


def counter(x, y, angle=0):
    cos, sin = math.cos(angle), math.sin(angle)
    def part(name, at, size, surface, bevel):
        px,py,pz = at
        return box(name,(x+px*cos-py*sin,y+px*sin+py*cos,pz),size,surface,bevel,angle)
    part('Merchant counter', (0,0,.45), (2.95,.760,.9), m['wood-dark'], .021)
    part('Worn limestone counter top', (0,0,.915), (3.1,.89,.08), m['floor'], .015)
    for off in [-.98,0,.98]:
        part('Recessed green panel', (off,-.39,.48), (.88,.026,.68), m['green'], .010)
        for z in [.15,.81]:
            part('Raised timber rail', (off,-.401,z), (.91,.035,.028), m['wood'], .004)
        part('Incised brass line', (off,-.41,.76), (.71,.016,.009), m['brass'], .002)


def shelf(x, y, width, angle=0, kind='paper', rows=5):
    cos, sin = math.cos(angle), math.sin(angle)
    def pos(px,py,pz):
        return (x+px*cos-py*sin,y+px*sin+py*cos,pz)
    for sign in [-1,1]:
        box('Shelving upright',pos(sign*width/2,0,1.46),(.043,.56,2.92),m['steel'],.003,angle)
    box('Shelving back',pos(0,.265,1.44),(width,.033,2.88),m['wood-dark'],0,angle)
    for row in range(rows):
        z = .28 + row*.53
        box('Scuffed shelf board',pos(0,0,z),(width,.57,.041),m['wood'],.005,angle)
        for col in range(max(1,int(width/.36))):
            dx = (-.5 + (col+.5)/max(1,int(width/.36)))*width
            if kind == 'paper':
                for stack in range(2+rng.randrange(3)):
                    # One reusable package mesh, as on the live shelves.
                    place('paper-ream',pos(dx+rng.uniform(-.014,.014),.01,z+.024+stack*.054),
                          angle+rng.uniform(-.045,.045),1.03)
            elif kind == 'mixed':
                for stack in range(4+rng.randrange(3)):
                    swatch = (row*3+col)%len(palette)
                    box('Stack of colored board',pos(dx,0,z+.045+stack*.038),
                        (.31,.43,.028),palette[swatch],.001,angle + rng.uniform(-.04,.04))
            else:
                box('Shipping carton stock',pos(dx,0,z+.149),(.32,.46,.255),m['kraft'],.007,angle)
                box('Tape over seam',pos(dx,0,z+.279),(.036,.45,.003),m['tape'],.001,angle)


def vault(y, depth, span=2.8, spring=3.25, rise=1.86, skylight=False):
    n = 48
    vertices = [(span*math.cos(i*math.pi/n), yy, spring+rise*math.sin(i*math.pi/n))
                for yy in [y,y+depth] for i in range(n+1)]
    faces = [(i,i+1,i+n+2,i+n+1) for i in range(n) if not skylight or i < 18 or i >= 30]
    roof = mesh('Continuous brick vault',vertices,faces,m['brick'],
                lambda i,_: ((i%(n+1))/n*6, vertices[i][1]/1.42))
    for face in roof.data.polygons:
        face.use_smooth = True
    roof.modifiers.new('Masonry shell', 'SOLIDIFY').thickness = .10
    if skylight:
        return
    for i in range(37):
        a = (i+.5)*math.pi/37
        arch = box('Individual arch voussoir',(span*math.cos(a),y-.04,spring+rise*math.sin(a)),
                   (.23,.31,.23),m['brick'],.015)
        arch.rotation_euler.y = -math.atan2(rise*math.cos(a),-span*math.sin(a))


def arcade():
    box('Aisle paving',(0,11,-.12),(15,34,.23),m['floor'],.008)
    for side in [-1,1]:
        box('Worn aisle curb',(2.75*side,11,.030),(.19,34,.09),m['floor'],.012)
        for row in range(4):
            y = 1.7 + row*6
            x = side*4.9
            angle = -side*math.pi/2
            box('Merchant rear wall',(side*7.04,y,1.63),(.18,6.05,3.26),m['plaster'],.01)
            box('Shop ceiling',(x,y,3.39),(4.5,5.96,.22),m['plaster'],0)
            box('Shop plank floor',(x,y,-.018),(4.14,5.9,.080),m['wood'],.008)
            box('Inset party wall',(side*5.88,y-2.92,1.63),(2.32,.16,3.28),m['plaster'],.008)
            box('Shop lintel',(side*2.98,y,3.06),(.36,5.8,.45),m['wood-dark'],.012)
            facade = panel('Persian shop sign',(side*2.758,y,3.10),(3.88,.57),
                           signs[(row+(side>0)*2)%4],lambda u,v: 0, grid=(1,1))
            facade.rotation_euler = (math.pi/2,0,angle)
            shelf(side*6.65,y-.56,3.74,angle,('paper','mixed','carton')[(row+(side>0))%3])
            shelf(side*4.12,y+2.53,1.63,0,'paper' if row%2 == 0 else 'carton',3)
            counter(side*4.62,y+.17,angle)
            place('paper-ream-open' if row==0 else 'paper-ream',(side*4.52,y+.66,.958),angle+.14,1.26)
            place('carton-open',(side*4.65,y-1.03,.955),angle-.1,1.04)
            place('wood-pallet',(side*3.42,y-1.85,.03),angle,.87)
            for k in range(3):
                place('paper-bundle',(side*3.42,y-1.85,.162+k*.152),angle,.85)
            bulb((side*4.8,y,2.91),.075)
            area('Warm counter tube',(side*5.35,y,2.92),(side*4.42,y,.62),140,1.45,(1,.75,.49))
    for y in [-1.28,4.72,10.72,16.72,22.72]:
        vault(y,5.24)
        if y < 22:
            vault(y+5.23,.78,skylight=True)
        for x in [-2.82,2.82]:
            box('Masonry pier',(x,y,1.6),(.46,.49,3.2),m['brick'],.018)
            box('Weathered pier base',(x,y,.17),(.55,.59,.34),m['floor'],.016)
        box('Pendant drop',(0,y+2.5,4.04),(.018,.018,1.14),m['steel'])
        box('Brass reflector',(0,y+2.5,3.47),(.33,.25,.063),m['brass'],.019)
        bulb((0,y+2.5,3.41),.075)
        area('Skylight above a vault seam',(-.6,y+5.62,5.33),(.7,y+5.3,.3),1150,1.82,(.82,.90,1))
    box('End of the arcade',(0,27.3,2.55),(6.45,.19,5.1),m['plaster'])
    for side in [-1,1]:
        box('Closed delivery bay',(side*4.87,25.09,1.67),(4.18,.18,3.34),m['brick'])
    box('End timber door',(0,27.18,1.4),(1.98,.12,2.8),m['wood-dark'],.01)
    end = panel('Arcade sign',(0,27.055,3.22),(2.7,.58),signs[4],lambda u,v:0,grid=(1,1))
    end.rotation_euler.x = math.pi/2
    place('wood-pallet',(-1.87,.48,0),-.11)
    place('kraft-roll',(-1.68,.48,.15),1.6,.88)
    place('carton-open',(-2.03,1.1,.17),.18,.95)
    place('wood-pallet',(1.93,1.78,0),-.12,.86)
    for i in range(3):
        place('paper-bundle',(1.93,1.78,.132+i*.158),-.12+i*.016,.86)
    for i in range(2):
        place('carton-open',(-2.24,4.47+i*.48,.012),.16+i*.30,.88)
    area('Late sun at main entrance',(-2.2,-4.5,4.55),(.3,4,.8),1530,2.0,(1,.81,.55))
    area('Daylight behind camera',(1,-3,2.8),(0,4,1.4),375,4.6,(.85,.92,1))


def workshop():
    box('Workshop floor',(0,.6,-.10),(9,9,.19),m['floor'],.012)
    box('Workshop plaster ceiling',(0,.6,3.64),(8.25,7.6,.24),m['plaster'],.008)
    for x in [-3.36,0,3.36]:
        box('Ceiling timber',(x,.21,3.42),(.10,5.8,.16),m['wood-dark'],.008)
    box('Left return wall',(-3.94,.5,1.77),(.17,6.2,3.54),m['brick'],.012)
    box('Rear lime plaster wall',(0,2.9,1.75),(7.9,.18,3.50),m['plaster'],.01)
    box('Right return wall',(3.94,1.5,1.77),(.17,4.3,3.54),m['brick'],.012)
    for x,kind in [(-2.4,'paper'),(0,'paper'),(2.4,'mixed')]:
        shelf(x,2.49,2.18,kind=kind)
    counter(-.58,-.58)
    place('paper-ream-open',(-1.37,-.67,.96),-.25,1.12)
    for i in range(3):
        place('paper-ream',(-.72,-.38,.96+i*.056),.08+i*.028)
    place('carton-open',(.1,-.51,.96),-.25)
    for i, mat in enumerate(palette):
        box('Counter board sample',(.55+i*.043,-.76,.96+i*.003),(.16,.25,.002),mat,.0005,i*.19)
    for x, y in [(-2.78,.97),(2.67,.65)]:
        place('wood-pallet',(x,y,0),.02)
    for i in range(4):
        place('paper-bundle',(-2.78,.97,.152+i*.186),i*.024)
    place('kraft-roll',(2.55,.55,.155),.32)
    place('kraft-roll',(2.96,1.06,.155),-1.5,.67)
    place('carton-open',(2.36,1.58,.03),.21)
    for y in [-.27,1.17]:
        box('Ceiling strip housing',(0,y,3.41),(2.3,.14,.075),m['steel'],.003)
        box('Opal ceiling strip',(0,y,3.367),(2.18,.06,.012),m['bulb'],.001)
    area('Window across the counter',(-2.8,-3.8,3.85),(0,.32,.9),670,2.16,(1,.79,.55))
    area('Shop overhead practical',(.5,1.7,3.37),(.7,1.05,.35),260,2.2,(1,.87,.67))
    area('Blue window bounce',(3.5,-2.3,2.72),(-.5,1.7,1.13),230,3.3,(.77,.87,1))


def tabletop(key):
    box('Stone inspection table',(0,0,-.055),(14.8,14.8,.095),m['floor'],.012)
    dims = {
        'ream':('paper-ream-open',(.02,.0,.005),-.24,1,0,.52),
        'roll':('kraft-roll',(-.05,.0,.005),-.25,.71,0,1.15),
        'carton':('carton-open',(0,.04,.005),-.17,1,0,.82),
        'bundle':('paper-bundle',(0,0,.156),-.13,.9,0,1.26),
    }
    name, pos, rotation, scale, tilt, light_scale = dims[key]
    if key=='ream':
        box('Dark cutting mat',(0,0,-.002),(.62,.54,.008),m['rubber'],.006,-.10)
        for i in range(5):
            box('Board sample below the ream',(-.13+i*.014,.06,.004+i*.0005),(.11,.154,.0008),palette[i],.0001,.21)
        box('Brass measurement rule',(.127,-.121,.004),(.17,.017,.0014),m['brass'],.0004,-.23)
        for i in range(30):
            box('Scale division',(.052+i*.005,-.121-(i-15)*.00115,.0048),
                (.0003,.005 if i%5 else .009,.00012),m['rubber'],.0001,-.23)
    if key=='bundle':
        place('wood-pallet',(0,0,0),-.13,.89)
        place('paper-bundle',(0,0,.325),-.145,.9)
    if key=='roll':
        place('kraft-roll',(-.51,.37,.005),1.1,.45)
    place(name,pos,rotation,scale,tilt)
    area('Grazing macro light',(-.9*light_scale,-.3*light_scale,1.3*light_scale),
         (0,0,.18),57*light_scale,.94*light_scale,(1,.91,.81))
    area('Cool rim softbox',(.63*light_scale,.67*light_scale,1.2*light_scale),
         (0,0,.14),35*light_scale,.73*light_scale,(.78,.87,1))
    area('Front fold fill',(.43*light_scale,-.81*light_scale,.65*light_scale),
         (0,0,.10),11*light_scale,.85*light_scale,(1,.96,.90))


VIEWS = {
    'market': (arcade, (.68,-2.36,1.81),(-.73,6.8,1.73),25,(1440,900),None),
    'workshop': (workshop, (2.72,-4.75,2.29),(-.27,.70,1.31),32,(1320,880),None),
    'ream': (lambda:tabletop('ream'),(.391,-.493,.350),(.044,-.030,.068),48,(1248,832),.67),
    'roll': (lambda:tabletop('roll'),(.92,-1.24,1.33),(.04,-.036,.37),53,(1248,832),None),
    'carton': (lambda:tabletop('carton'),(.66,-.81,.62),(.027,.035,.17),53,(1248,832),None),
    'bundle': (lambda:tabletop('bundle'),(1.03,-1.78,1.08),(0,0,.28),45,(1248,832),None),
}

if args.frames:
    RENDERS.mkdir(parents=True,exist_ok=True)
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = False
scene.cycles.adaptive_threshold = .046
scene.cycles.max_bounces = 7
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 3
scene.render.threads_mode, scene.render.threads = 'FIXED', 7
scene.render.resolution_percentage = args.scale
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get('Background')
background.inputs[0].default_value = (.41,.53,.73,1)
background.inputs[1].default_value = .22
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.image_settings.file_format = 'PNG'
camera_data = bpy.data.cameras.new('Camera')
camera = bpy.data.objects.new('Camera',camera_data)
scene.collection.objects.link(camera)
scene.camera = camera

for key in args.frames:
    for obj in list(stage.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    setup, eye, aim, focal, resolution, focus = VIEWS[key]
    setup()
    camera.location = eye
    camera.rotation_euler = (Vector(aim)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.lens = focal
    camera_data.dof.use_dof = bool(focus)
    if focus:
        camera_data.dof.focus_distance = focus
        camera_data.dof.aperture_fstop = 8
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.filepath = str(RENDERS / (key+'.png'))
    bpy.ops.render.render(write_still=True)
    print('RENDER_READY', key, flush=True)
