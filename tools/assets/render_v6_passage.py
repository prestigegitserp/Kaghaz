"""Render the v6 passage, with the same specimens used on the product pages."""
import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_v5 as passage
from products_v6 import MODELS, materials, register

g = passage.g
WORK = passage.ROOT / '.asset-build'
SHOTS = {
    'passage': ((.57, -14.95, 1.66), (-.47, -3.08, 2.28), 23.6, (3840, 2160)),
    'balcony': ((-2.07, -8.43, 5.42), (.95, 6.63, 4.40), 25.4, (2560, 1600)),
    'store': ((.98, -8.92, 1.74), (4.60, -10.90, 1.34), 29.3, (2560, 1600)),
}


def texture_mix(material, tint, factor):
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get('Principled BSDF')
    socket = shader.inputs['Base Color']
    link = socket.links[0]
    source = link.from_socket
    links.remove(link)
    mix = nodes.new('ShaderNodeMixRGB')
    mix.inputs[0].default_value = factor
    mix.inputs[2].default_value = (*tint, 1)
    links.new(source, mix.inputs[1])
    links.new(mix.outputs[0], socket)


def architect_finish():
    texture_mix(passage.plaster, (.69, .68, .60), .68)
    passage.floor.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value = .24
    passage.floor.node_tree.nodes.get('Principled BSDF').inputs['Coat Roughness'].default_value = .26
    passage.ply.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value = .18
    shader = passage.glass.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Alpha'].default_value = .099
    shader.inputs['Metallic'].default_value = .26
    shader.inputs['Roughness'].default_value = .115


def storefronts():
    b = passage.b
    layout = passage.LAYOUT
    graphite = passage.paint('Textured dark merchandise tray', '#333c3a', .67)
    white = passage.paint('Off-white shop placard', '#eae7d9', .57)
    dark = passage.paint('Door reaction mat', '#484e49', .91)
    chrome = passage.chrome
    for slot, (key, (x, z, angle, level)) in enumerate(zip(MODELS, layout['booths'])):
        sin, cos = math.sin(angle), math.cos(angle)
        deck = layout['decks'][level]

        def at(u, forward, y):
            return x + cos * u - sin * forward, -z + sin * u + cos * forward, deck + y

        b('Mounted enamel number base', at(2.31, -.056, 2.462), (.46, .047, .141), white, .011, angle)
        b('Rubber gridded threshold mat', at(2.12, .32, .043), (1.16, .49, .013), dark, .010, angle)
        for step in range(16):
            b('Brushed threshold grooves', at(1.60 + step * .067, -.07, .021),
              (.006, .111, .006), chrome, .001, angle)
        b('Neoprene sample tray', at(-.84, .925, 1.026), (.49, .41, .022), graphite, .018, angle)
        g.place(key, at(-.84, .925, 1.039), angle + .11, 1.20)
        g.area('Local downlight reveals specimen relief', at(-.88, .58, 2.69), at(-.84, .925, 1.04),
               32, .56, (1.0, .963, .89))
        b('Shop opening bottom rail', at(2.20, -.013, .028), (1.47, .046, .021), chrome, .003, angle)
        for side in [-1, 1]:
            high = .857 if side == -1 else 1.067
            b('Steel glass pull bar', at(1.01, side * .062, 1.29), (.031, .047, .318), chrome, .011, angle)
            b('Glazing corner hardware', at(-2.87, -.059, high), (.102, .020, .071), chrome, .004, angle)


def display_benches():
    matte = passage.paint('Graphite sample tray', '#3b4643', .64)
    scenes = {
        'samples': [('deckle', -.34, 1.64), ('foil', .25, 1.72)],
        'unwrap': [('carbonless', .39, 1.53)],
        'proof': [('coated-board', -.35, 1.65), ('vellum', .30, 1.54)],
        'fold': [('microflute', .29, 1.47)],
        'roll': [('labels', .35, 1.26)],
        'pallet': [('honeycomb', .45, 1.16)],
    }
    for key, parts in scenes.items():
        spec = passage.LAYOUT['stations'][key]
        x, z = spec['position']
        deck = passage.LAYOUT['decks'][spec['level']]
        for product, dy, scale in parts:
            y = -z + dy
            for obj in list(g.stage.objects):
                if obj.name.startswith(('Swatch on counter', 'Dieline sheet', 'paper-ream-open')) and \
                        abs(obj.location.x - x) < .32 and abs(obj.location.y - y) < .21 and \
                        abs(obj.location.z - deck - 1.044) < .025:
                    bpy.data.objects.remove(obj, do_unlink=True)
            passage.b('Inset sample work mat', (x, y, deck + 1.048), (.60, .423, .007), matte, .008, .03)
            g.place(product, (x, y, deck + 1.053), -.11 + dy * .15, scale)


def hall_finishing():
    b = passage.b
    porcelain = passage.paint('Warm porcelain suspended ceiling panels', '#dcd9cb', .63)
    dark_metal = passage.paint('Anodised viewport runners', '#515957', .57, .40)
    channel = passage.paint('Warm indirect line source', '#fff6e6', .47)
    channel.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value = (1, .82, .59, 1)
    channel.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = 2.35
    for i in range(12):
        y = -14.75 + 2.685 * i
        b('Perforated ceiling sound baffle', (0, y, 7.23), (5.78, 2.669, .102), porcelain, .010)
    for side in [-1, 1]:
        b('Continuous ceiling aluminium runner', (side * 2.97, 0, 7.178), (.092, 31.7, .045), dark_metal, .007)
        b('Continuous ceiling luminaire diffuser', (side * 2.925, 0, 7.150), (.038, 31.7, .022), channel, .004)
        b('Glazed balcony lower trim', (side * 1.47, .83, 3.677), (.038, 22.7, .029), dark_metal, .003)
        for y in [-11.43, -7.84, -4.25, -.66, 2.93, 6.52, 10.11]:
            b('Indirect strip under balcony lip', (side * 1.574, y, 3.309), (.038, 3.52, .02), channel, .003)
        for y in [-9.6, -5.61, -1.62, 2.37, 6.36, 10.35]:
            b('Floor expansion joint inlay', (side * 2.62, y, -.001), (.034, 3.7, .015), passage.chrome, .002)
    b('Slotted entrance drain', (0, -13.38, .006), (2.83, .162, .017), dark_metal, .008)
    for slot in range(65):
        b('Drain open slot', (-1.33 + slot * .0416, -13.38, .015), (.012, .117, .001), passage.black, .001)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--frames', nargs='*', choices=SHOTS, default=list(SHOTS))
    parser.add_argument('--threads', type=int, default=7)
    parser.add_argument('--samples', type=int, default=144)
    parser.add_argument('--width', type=int)
    parser.add_argument('--time-limit', type=float, default=0, help='Seconds of Cycles sampling per tile')
    parser.add_argument('--preview', action='store_true')
    parser.add_argument('--untiled', action='store_true')
    parser.add_argument('--output-root', type=Path, default=WORK)
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    architect_finish()
    passage.register_stock()
    material_set = materials()
    for key in MODELS:
        register(key, material_set)
    passage.passage()
    hall_finishing()
    storefronts()
    display_benches()
    # Retain the light inside each shop, with a softer spill on the public corridor.
    for obj in g.stage.objects:
        if obj.type == 'LIGHT' and obj.name.startswith('Fluorescent wash'):
            obj.data.energy *= .77
    scene = g.scene
    scene.cycles.samples = options.samples
    scene.cycles.adaptive_threshold = .080 if options.preview else .064
    scene.cycles.adaptive_min_samples = min(10, options.samples)
    scene.cycles.use_denoising = False
    scene.cycles.time_limit = options.time_limit
    scene.cycles.use_auto_tile = not options.untiled
    scene.cycles.sample_clamp_indirect = 3.2
    scene.cycles.diffuse_bounces = 2
    scene.cycles.max_bounces = 6
    scene.cycles.transparent_max_bounces = 3
    scene.render.threads = options.threads
    scene.render.use_persistent_data = True
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.62, .72, .87, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .28
    output = options.output_root / ('v6-preview' if options.preview else 'v6-renders')
    output.mkdir(parents=True, exist_ok=True)
    for key in options.frames:
        eye, aim, lens, (width, height) = SHOTS[key]
        if options.width:
            height, width = round(height * options.width / width), options.width
        camera = scene.camera
        camera.location = eye
        camera.rotation_euler = (Vector(aim) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.lens = lens
        scene.render.resolution_x, scene.render.resolution_y = width, height
        scene.render.filepath = str(output / f'{key}.png')
        bpy.ops.render.render(write_still=True)
        print('V6_PASSAGE_READY', key, flush=True)


if __name__ == '__main__':
    main()
