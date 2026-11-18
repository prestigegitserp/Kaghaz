"""Pack embedded textures and produce the v3 public assets and byte manifest."""
import argparse
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.asset-build'
PUBLIC = ROOT / 'public/v3'
FRAMES = ('market', 'workshop', 'ream', 'roll', 'carton', 'bundle')


def pack_model(source, target):
    data = source.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc, body = json.loads(data[20:20 + size]), data[28 + size:]
    images = {image['bufferView']: image for image in doc.get('images', [])}
    packed = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        offset = view.get('byteOffset', 0)
        chunk = body[offset:offset + view['byteLength']]
        if index in images:
            image = images[index]
            with Image.open(BytesIO(chunk)) as pixels:
                name = image.get('name', '')
                if 'press-wrapper' not in name:
                    pixels.thumbnail((768, 768), Image.Resampling.LANCZOS)
                stream = BytesIO()
                pixels.save(stream, format='WEBP', quality=87 if 'normal' in name else 88, method=5)
                chunk = stream.getvalue()
            image['mimeType'] = 'image/webp'
        packed.extend(b'\0' * (-len(packed) % 4))
        view.update(byteOffset=len(packed), byteLength=len(chunk))
        packed.extend(chunk)
    for texture in doc.get('textures', []):
        texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': texture.pop('source')}
    for field in ['extensionsUsed', 'extensionsRequired']:
        doc.setdefault(field, []).append('EXT_texture_webp')
    packed.extend(b'\0' * (-len(packed) % 4))
    doc['buffers'][0]['byteLength'] = len(packed)
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    result = (struct.pack('<IIIII', 0x46546C67, 2, 28 + len(js) + len(packed), len(js), 0x4E4F534A)
              + js + struct.pack('<II', len(packed), 0x004E4942) + packed)
    target.write_bytes(result)
    triangles = sum(doc['accessors'][p['indices']]['count'] // 3
                    for mesh in doc['meshes'] for p in mesh['primitives'])
    return {
        'id': source.stem, 'file': f'models/{target.name}', 'units': 'meters',
        'bytes': len(result), 'sourceBytes': len(data), 'triangles': triangles,
        'sha256': sha256(result).hexdigest(),
    }


def denoise(image):
    import numpy as np
    import oidn

    srgb = np.array(image.convert('RGB'), dtype=np.float32) / 255
    linear = np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4)
    linear = np.ascontiguousarray(linear, dtype=np.float32)
    width, height = image.size
    filtered = np.empty_like(linear)
    device = oidn.NewDevice()
    oidn.CommitDevice(device)
    rt = oidn.NewFilter(device, 'RT')
    try:
        oidn.SetSharedFilterImage(rt, 'color', linear, oidn.FORMAT_FLOAT3, width, height)
        oidn.SetSharedFilterImage(rt, 'output', filtered, oidn.FORMAT_FLOAT3, width, height)
        oidn.CommitFilter(rt)
        oidn.ExecuteFilter(rt)
        if (error := oidn.GetDeviceError(device)):
            raise RuntimeError(f'Open Image Denoise failed ({error})')
    finally:
        oidn.ReleaseFilter(rt)
        oidn.ReleaseDevice(device)
    linear = np.clip(filtered * .92 + linear * .08, 0, 1)
    srgb = np.where(linear <= .0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - .055)
    return Image.fromarray(np.uint8(np.clip(np.round(srgb * 255), 0, 255)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--denoise', action='store_true', help='Apply Open Image Denoise to review PNGs')
    options = parser.parse_args()
    (PUBLIC / 'models').mkdir(parents=True, exist_ok=True)
    (PUBLIC / 'renders').mkdir(parents=True, exist_ok=True)
    sources = sorted((WORK / 'v3-models').glob('*.glb'))
    models = [pack_model(source, PUBLIC / 'models' / source.name) for source in sources]
    renders = []
    for key in FRAMES:
        source = WORK / 'v3-renders' / f'{key}.png'
        target = PUBLIC / 'renders' / f'{key}.webp'
        if not source.exists():
            continue
        with Image.open(source) as raw_image:
            image = denoise(raw_image) if options.denoise else raw_image
            image.save(target, 'WEBP', quality=87 if key in ('market', 'workshop') else 89, method=6)
            renders.append({'file': f'renders/{target.name}', 'width': image.width, 'height': image.height,
                            'bytes': target.stat().st_size})
            if key in ('ream', 'roll', 'carton', 'bundle'):
                image.thumbnail((480, 320), Image.Resampling.LANCZOS)
                image.save(PUBLIC / 'renders' / f'{key}-thumb.webp', 'WEBP', quality=82, method=5)
    (PUBLIC / 'asset-manifest.json').write_text(
        json.dumps({'version': 3, 'assets': models, 'renders': renders}, indent=2) + '\n')
    print(f"{len(models)} models: {sum(m['bytes'] for m in models):,} bytes. {len(renders)} rendered views.")


if __name__ == '__main__':
    main()
