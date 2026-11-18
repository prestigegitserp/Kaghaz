"""Metric paper specimens, with geometry shared by Cycles and the live catalog."""
import math
from pathlib import Path
import random

import bpy

import build_v3 as g

ROOT = Path(__file__).resolve().parents[2]
TEXTURES = ROOT / '.asset-build/v6-textures'


def substrate(name, strength, art=None):
    previous = g.TEX
    g.TEX = TEXTURES
    try:
        return g.material(name + (' / ink' if art else ' / substrate'), texture=name, diffuse=art, normal=strength)
    finally:
        g.TEX = previous


def materials():
    return {
        'form': substrate('form', .43, 'form-art'),
        'rose': substrate('rose', .53),
        'canary': substrate('canary', .48),
        'navy': substrate('navy', .66),
        'coated': substrate('coated', .32),
        'label': substrate('coated', .46, 'label-art'),
        'draft': substrate('coated', .38, 'draft-art'),
        'print': substrate('coated', .48, 'board-art'),
        'liner': substrate('liner', .72),
        'flute': substrate('flute', .73),
        'cotton': substrate('cotton', 1.0),
        'rag': substrate('rag', .91),
        'core': substrate('board-core', .84),
        'gold': g.material('Satin die-stamped gold foil', (.63, .37, .103), .24, .90),
        'silver': g.material('Cool stamped foil', (.53, .59, .62), .25, .87),
        'vellum': g.material('Semi-transparent drafting vellum', (.86, .89, .84), .44),
    }


def paper(name, w, d, x, y, z, mat, angle=0, lift=0, thickness=.00026, part='paper'):
    def surface(u, v):
        return g.crease(u, v) + lift * (v ** 4 * (.27 + .73 * u ** 2))

    obj = g.panel(name, (x, y, z), (w, d), mat, surface, part, grid=(19, 23), thickness=thickness)
    obj.rotation_euler.z = angle
    return obj


def ncr(m):
    for i in range(19):
        light = m[['canary', 'rose', 'coated'][i // 7]]
        g.box('Pressure-bonded copy stack', (-.016 + .00023 * i, .015, .001 + i * .00048),
              (.202, .273, .00042), light, .00006, -.12)
    paper('Canary copy lifted by the fold', .204, .279, .041, .013, .012, m['canary'], -.23, .031)
    paper('Pink second copy', .204, .275, .018, .027, .014, m['rose'], -.10, .019)
    paper('Printed original', .207, .281, -.026, -.004, .018, m['form'], .17, .045)
    g.box('Glued top edge', (-.05, .134, .021), (.198, .0045, .0045), m['coated'], .0007, .17)


def foil(m):
    for i in range(17):
        g.box('Dyed card loose stack', (-.076, .029, .0004 + i * .00077), (.173, .108, .00069),
              m['navy'], .00012, -.27 + math.sin(i) * .017)
    g.box('Pearl board with cool foil', (.052, -.042, .014), (.151, .108, .0015), m['coated'], .00018, .28)
    g.box('Deep teal foil sample', (-.067, .032, .016), (.164, .104, .0022), m['navy'], .00030, -.23)
    for x, y, z, angle, surface in [(-.064, .031, .01728, -.23, m['gold']), (.054, -.042, .0148, .28, m['silver'])]:
        def point(u, v):
            return (x + u * math.cos(angle) - v * math.sin(angle),
                    y + u * math.sin(angle) + v * math.cos(angle), z)
        border = [(-.067, -.042), (.067, -.042), (.067, .042), (-.067, .042), (-.067, -.042)]
        g.ribbon('Continuous debossed foil keyline', [point(u, v) for u, v in border], .00039, surface)
        for row in range(-3, 4):
            wave = [point(-.051 + i * .0024, row * .0077 + .005 * math.sin(i * .157 + row * .64))
                    for i in range(43)]
            g.ribbon('Stamped foil contour', wave, .00034, surface)
        for offset in [-.048, .035]:
            g.ribbon('Short stamped mark', [point(offset, -.033), point(offset + .015, -.033)], .00062, surface)


def tube_wall(name, x, y, inner, outer, height, bottom, side, end, core):
    steps = 96
    for r, material, flip in [(outer, side, False), (inner, core, True)]:
        vertices = [(r * math.cos(i * math.tau / steps), r * math.sin(i * math.tau / steps), z)
                    for z in (0, height) for i in range(steps + 1)]
        size = steps + 1
        faces = [(i, i + 1, i + 1 + size, i + size) for i in range(steps)]
        if flip:
            faces = [face[::-1] for face in faces]
        obj = g.mesh(name + ' wall', vertices, faces, material,
                     lambda i, _: ((i % size) / steps, i // size), at=(x, y, bottom))
        for face in obj.data.polygons:
            face.use_smooth = True
    for z in (bottom, bottom + height):
        vertices = [(r * math.cos(i * math.tau / steps), r * math.sin(i * math.tau / steps), 0)
                    for r in (inner, outer) for i in range(steps)]
        faces = [(i, i + steps, (i + 1) % steps + steps, (i + 1) % steps) for i in range(steps)]
        if z == bottom:
            faces = [face[::-1] for face in faces]
        g.mesh(name + ' exposed windings', vertices, faces, end,
               lambda i, _: (.5 + vertices[i][0] / (.002 + 2 * outer),
                             .5 + vertices[i][1] / (.002 + 2 * outer)), at=(x, y, z))


def labels(m):
    tube_wall('Thermal label roll', -.073, .023, .025, .068, .077, .001, m['coated'], g.m['ring'], m['liner'])
    tube_wall('Adhesive liner roll', .085, .054, .022, .047, .048, .001, m['liner'], g.m['ring'], m['flute'])
    for start in (-2.0, -.95, .10, 1.15, 2.20, 3.25):
        n = 18
        vertices = [(-.073 + .0684 * math.cos(start + i * .96 / n),
                     .023 + .0684 * math.sin(start + i * .96 / n), z)
                    for z in (.009, .070) for i in range(n + 1)]
        faces = [(i, i + 1, i + n + 2, i + n + 1) for i in range(n)]
        label = g.mesh('Die-cut label along curved roll', vertices, faces, m['label'],
                       lambda i, _: ((i % (n + 1)) / n, i // (n + 1)))
        for face in label.data.polygons:
            face.use_smooth = True
    g.panel('Continuous siliconized liner', (.034, -.058, .004), (.211, .074), m['canary'],
            lambda u, v: .039 * (1 - u) ** 7 + .004 * math.sin(u * 6), 'paper', grid=(35, 12), thickness=.00032)
    for index, x in enumerate([-.020, .052, .124]):
        lift = .029 if index == 2 else .003
        paper('Individual die-cut label', .063, .064, x, -.058, .010 + (.009 if index == 0 else 0),
              m['label'], .01, lift, .00024)


def wave_core(m, at, w, d, peak, pitch, angle):
    n = 128
    vertices = [(u * w - w / 2, side * d / 2, .00035 + peak * (.50 + .48 * math.cos(u * w / pitch * math.tau)))
                for side in [-1, 1] for u in (i / n for i in range(n + 1))]
    faces = [(i, i + 1, i + n + 2, i + n + 1) for i in range(n)]
    wall = g.mesh('Continuous corrugating medium', vertices, faces, m['flute'],
                  lambda i, _: ((i % (n + 1)) / n, i // (n + 1)), 'core', at)
    wall.rotation_euler.z = angle
    wall.modifiers.new('Medium caliper', 'SOLIDIFY').thickness = .00025
    for face in wall.data.polygons:
        face.use_smooth = True
    x, y, z = at
    g.box('Lower kraft liner', (x, y, z + .00015), (w, d, .0003), m['liner'], .00008, angle)
    g.box('Upper kraft liner', (x, y, z + peak + .00064), (w, d, .00042), m['liner'], .00010, angle, 'lid')


def corrugated(m):
    for i in range(5):
        wave_core(m, (-.016, .012 + .009 * i, .003 + .0052 * i), .281 - i * .019, .197 - i * .022,
                  .0042, .0089, -.24 + i * .046)
    wave_core(m, (.039, -.039, .031), .155, .095, .0028, .0054, .19)
    paper('Scored loose kraft liner', .201, .119, -.018, .067, .028, m['liner'], -.34, .051, .0006)


def vellum(m):
    shader = m['vellum'].node_tree.nodes.get('Principled BSDF')
    shader.inputs['Alpha'].default_value = .29
    shader.inputs['IOR'].default_value = 1.38
    m['vellum'].surface_render_method = 'BLENDED'
    g.box('Drawing support', (-.016, .017, .002), (.239, .275, .004), m['navy'], .0015, -.11)
    paper('Drafting drawing visible through tracing stock', .222, .253, -.016, .017, .005,
          m['draft'], -.11, .002)
    paper('Thin translucent tracing sheet', .20, .248, .063, -.002, .011, m['vellum'], -.31, .044, 0)
    paper('Second tracing sheet with raised corner', .222, .256, .005, .032, .013,
          m['vellum'], .28, .024, 0, 'lid')


def deckled_sheet(name, size, at, seed, material, raised, angle):
    nx, ny = 44, 58
    rng = random.Random(seed)
    vertices, uv = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            edge_x = rng.uniform(-.0034, .0034) * abs(2 * u - 1) ** 12
            edge_y = rng.uniform(-.0036, .0036) * abs(2 * v - 1) ** 12
            falloff = max(abs(2 * u - 1), abs(2 * v - 1)) ** 7
            up = raised * (u * v) ** 3 + falloff * .0016 * math.sin(v * 37 + u * 27)
            vertices.append(((u - .5) * size[0] + edge_x, (v - .5) * size[1] + edge_y, up))
            uv.append((u, v))
    faces = [(j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i)
             for j in range(ny) for i in range(nx)]
    obj = g.mesh(name, vertices, faces, material, lambda i, _: uv[i], 'paper', at)
    obj.rotation_euler.z = angle
    obj.modifiers.new('Handformed caliper', 'SOLIDIFY').thickness = .00072
    for face in obj.data.polygons:
        face.use_smooth = True


def cotton(m):
    deckled_sheet('Tinted rag sheet', (.244, .206), (.014, -.024, .004), 324, m['rag'], .019, -.31)
    deckled_sheet('Ivory cotton sheet', (.226, .214), (-.025, .014, .008), 611, m['cotton'], .036, .23)
    deckled_sheet('Heavy paper fragment', (.138, .132), (.072, .058, .012), 606, m['cotton'], .024, -.39)


def board(m):
    for i in range(9):
        x, y, z = -.035 + .0065 * i, .014 + .0035 * i, .0026 + .00255 * i
        rotation = -.25 + i * .013
        g.box('Dense recycled inner ply', (x, y, z), (.218, .163, .0017), m['core'], .00024, rotation)
        for offset in [-.001, .001]:
            g.box('Clay coated white liner', (x, y, z + offset), (.219, .164, .00025),
                  m['coated'], .00007, rotation)
    paper('Printed top ply color control patch', .207, .154, .018, .040, .025,
          m['print'], -.15, .012, .0012)
    g.box('Reverse side gray chip', (.066, -.067, .013), (.108, .083, .0024), m['core'], .0004, .25)


def honeycomb(m):
    r = .0088
    corners = [(r * math.cos(math.pi / 6 + math.tau * i / 6), r * math.sin(math.pi / 6 + math.tau * i / 6))
               for i in range(6)]
    edges = set()
    for row in range(13):
        for col in range(18):
            x = math.sqrt(3) * r * (col + .5 * (row % 2) - 8.75)
            y = r * 1.5 * (row - 6)
            pts = [(round(x + dx, 7), round(y + dy, 7)) for dx, dy in corners]
            edges.update(tuple(sorted((pts[i - 1], pts[i]))) for i in range(6))
    vertices, faces = [], []
    for (a, b) in sorted(edges):
        position = len(vertices)
        vertices.extend((*p, z) for z in [.002, .022] for p in (a, b))
        faces.append((position, position + 1, position + 3, position + 2))
    cell = g.mesh('Open hexagonal paper core', vertices, faces, m['flute'],
                  lambda i, _: ((i % 2) * .35 + (i // 4 % 9) / 10, (i % 4) // 2), 'core')
    cell.modifiers.new('Bonded wall paper', 'SOLIDIFY').thickness = .00046
    g.box('Lower kraft facing', (0, 0, .001), (.289, .183, .0015), m['liner'], .00030)
    g.box('Partially removed upper facing', (-.021, .054, .0236), (.244, .085, .00165),
          m['liner'], .00028, -.055, 'lid')
    paper('Peel-back offcut showing adhesive side', .105, .092, .094, .034, .024,
          m['liner'], .2, .032, .0010, 'lid')


MODELS = {
    'carbonless': ncr, 'foil': foil, 'labels': labels, 'microflute': corrugated,
    'vellum': vellum, 'deckle': cotton, 'coated-board': board, 'honeycomb': honeycomb,
}


def register(key, material_set, export_to=None):
    collection = bpy.data.collections.new('Specimen ' + key)
    g.scene.collection.children.link(collection)
    g.destination = collection
    MODELS[key](material_set)
    if export_to:
        export_to.mkdir(parents=True, exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in collection.objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = next(iter(collection.objects))
        bpy.ops.export_scene.gltf(filepath=str(export_to / f'{key}.glb'), export_format='GLB',
                                  use_selection=True, export_extras=True, export_apply=True, export_animations=False)
    g.scene.collection.children.unlink(collection)
    g.collections[key] = collection
    g.destination = g.stage
    return collection
