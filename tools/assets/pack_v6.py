"""Package full Cycles frames, light previews and embedded WebP specimens."""
import argparse
from hashlib import sha256
import json
from pathlib import Path

from PIL import Image

from pack_v3 import ROOT, denoise, pack_model

WORK = ROOT / '.asset-build'
PUBLIC = ROOT / 'public/v6'
PROFILES = ('carbonless', 'foil', 'labels', 'microflute', 'vellum', 'deckle', 'coated-board', 'honeycomb')
SHOTS = ('passage', 'store', 'balcony')


def catalog_record(path, image):
    return {
        'file': str(path.relative_to(PUBLIC)), 'width': image.width, 'height': image.height,
        'bytes': path.stat().st_size, 'sha256': sha256(path.read_bytes()).hexdigest(),
    }


def frame(key, source, filter_noise):
    full = PUBLIC / 'renders' / f'{key}.webp'
    thumb = PUBLIC / 'renders' / f'{key}-thumb.webp'
    with Image.open(source) as raw:
        image = denoise(raw) if filter_noise else raw.convert('RGB')
        image.save(full, 'WEBP', quality=91 if key in SHOTS else 93, method=6)
        record = catalog_record(full, image)
        preview = image.copy()
        preview.thumbnail((1200, 780) if key in SHOTS else (740, 540), Image.Resampling.LANCZOS)
        preview.save(thumb, 'WEBP', quality=86, method=6)
        record['preview'] = catalog_record(thumb, preview)
        return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--denoise', action='store_true')
    parser.add_argument('--work', type=Path, default=WORK)
    parser.add_argument('--available', action='store_true', help='Pack completed output while renders are running')
    options = parser.parse_args()
    for key in ('models', 'renders'):
        (PUBLIC / key).mkdir(parents=True, exist_ok=True)
    manifest_path = PUBLIC / 'asset-manifest.json'
    old = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
    old_models = {entry['id']: entry for entry in old.get('assets', [])}
    old_frames = {Path(entry['file']).stem: entry for entry in old.get('renders', [])}
    models, frames = [], []
    for key in PROFILES:
        source = options.work / 'v6-models' / f'{key}.glb'
        target = PUBLIC / 'models' / source.name
        if options.available and not source.is_file():
            continue
        if key in old_models and target.is_file() and target.stat().st_mtime >= source.stat().st_mtime:
            entry = old_models[key]
        else:
            entry = pack_model(source, target)
        models.append(entry)
    for key in (*SHOTS, *PROFILES):
        source = options.work / 'v6-renders' / f'{key}.png'
        target = PUBLIC / 'renders' / f'{key}.webp'
        if options.available and not source.is_file():
            continue
        if (key in old_frames and target.is_file() and
                (PUBLIC / 'renders' / f'{key}-thumb.webp').is_file() and target.stat().st_mtime >= source.stat().st_mtime):
            entry = old_frames[key]
        else:
            entry = frame(key, source, options.denoise)
        frames.append(entry)
    manifest_path.write_text(json.dumps({'version': 6, 'assets': models, 'renders': frames}, indent=2) + '\n')
    print(f'{len(models)} specimens and {len(frames)} full-size Cycles frames')


if __name__ == '__main__':
    main()
