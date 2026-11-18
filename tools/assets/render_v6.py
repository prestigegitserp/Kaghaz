"""Photograph the actual browser specimens on a physically lit inspection bench."""
import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_v3 as g
from products_v6 import MODELS, TEXTURES, materials, register

WORK = g.ROOT / '.asset-build'
FRAMES = {
    'carbonless': ((.18, -.45, .36), (0, .014, .018), 49, 8.0),
    'foil': ((.155, -.303, .245), (.0, -.007, .014), 53, 6.3),
    'labels': ((.159, -.41, .268), (.0, -.003, .035), 44, 9.0),
    'microflute': ((.087, -.36, .145), (.0, .001, .018), 47, 9.0),
    'vellum': ((.16, -.425, .37), (.011, .024, .018), 46, 8.0),
    'deckle': ((.12, -.393, .27), (.01, .008, .014), 43, 8.0),
    'coated-board': ((.135, -.369, .171), (.004, .01, .015), 52, 9.0),
    'honeycomb': ((.13, -.375, .223), (.001, .003, .013), 49, 9.0),
}


def setup_plate(key):
    old = g.TEX
    g.TEX = TEXTURES
    table = g.material('Fine grain graphite work surface', texture='worktop', tiles=(.36, .36), normal=.28)
    g.TEX = old
    g.box('Bench', (0, 0, -.022), (5, 5, .044), table, .005)
    g.place(key, (0, 0, 0), .025)
    if key in ('microflute', 'deckle', 'coated-board', 'honeycomb'):
        steel = g.material('Dark anodised rule', (.17, .19, .19), .41, .66)
        ink = g.material('Etched graduations', (.64, .62, .52), .71)
        g.box('Metric scale at close inspection', (-.006, -.124, .002), (.206, .013, .0038), steel, .0007)
        for tick in range(41):
            height = .0066 if tick % 10 == 0 else .0033
            g.box('Etched tick', (-.103 + tick * .0048, -.119 - height / 2, .00401),
                  (.00025, height, .00008), ink)
    g.area('Softbox with textile diffuser', (-.31, -.10, .44), (0, 0, .00), 19, .31, (1, .948, .863))
    g.area('Grazing strip to show material relief', (.31, .16, .13), (0, .018, .01), 8.0, .19, (.86, .93, 1))
    g.area('Front white bounce', (.02, -.47, .29), (0, 0, .03), 6.5, .40, (.94, .98, 1))
    if key == 'foil':
        g.area('Short foil reflection card', (-.14, .18, .27), (-.064, .03, .019), 10, .098, (1, .91, .72))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--frames', nargs='*', choices=MODELS, default=list(MODELS))
    parser.add_argument('--samples', type=int, default=192)
    parser.add_argument('--width', type=int, default=2304)
    parser.add_argument('--threads', type=int, default=8)
    parser.add_argument('--no-export', action='store_true')
    parser.add_argument('--preview', action='store_true')
    parser.add_argument('--models-only', action='store_true')
    parser.add_argument('--output-root', type=Path, default=WORK)
    parser.add_argument('--time-limit', type=float, default=0)
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    scene = g.scene
    scene.cycles.samples = options.samples
    scene.cycles.time_limit = options.time_limit
    scene.cycles.use_auto_tile = False
    scene.cycles.adaptive_threshold = .039 if not options.preview else .10
    scene.cycles.adaptive_min_samples = min(24, options.samples)
    scene.cycles.max_bounces = 7
    scene.cycles.transparent_max_bounces = 4
    scene.cycles.use_denoising = False
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -1.13
    scene.render.threads = options.threads
    scene.render.resolution_x, scene.render.resolution_y = options.width, round(options.width * .683)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .16
    output = options.output_root / ('v6-preview' if options.preview else 'v6-renders')
    output.mkdir(parents=True, exist_ok=True)
    material_set = materials()
    for key in options.frames:
        register(key, material_set, options.output_root / 'v6-models' if not options.no_export else None)
        if options.models_only:
            continue
        setup_plate(key)
        eye, aim, focal, aperture = FRAMES[key]
        camera = scene.camera
        camera.location = eye
        camera.rotation_euler = (Vector(aim) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.lens = focal
        camera.data.dof.use_dof = True
        camera.data.dof.focus_distance = (Vector(aim) - camera.location).length
        camera.data.dof.aperture_fstop = aperture
        scene.render.filepath = str(output / f'{key}.png')
        bpy.ops.render.render(write_still=True)
        print('V6_SPECIMEN_READY', key, flush=True)
        for obj in list(g.stage.objects):
            bpy.data.objects.remove(obj, do_unlink=True)


if __name__ == '__main__':
    main()
