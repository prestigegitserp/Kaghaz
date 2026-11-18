"""Pack modern showroom renders and the printed GLB used in live booths."""
import argparse
import json

from PIL import Image

from pack_v3 import ROOT, denoise, pack_model

WORK = ROOT / '.asset-build'
PUBLIC = ROOT / 'public/v4'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--denoise', action='store_true')
    options = parser.parse_args()
    (PUBLIC/'models').mkdir(parents=True,exist_ok=True)
    (PUBLIC/'renders').mkdir(parents=True,exist_ok=True)
    models = [pack_model(src,PUBLIC/'models'/src.name) for src in sorted((WORK/'v4-models').glob('*.glb'))]
    renders=[]
    for key in ['hall','sample-table','fold-counter','ream']:
        with Image.open(WORK/'v4-renders'/f'{key}.png') as raw_image:
            image=denoise(raw_image) if options.denoise else raw_image
            target=PUBLIC/'renders'/f'{key}.webp'
            image.save(target,'WEBP',quality=89,method=6)
            if key=='ream':
                thumbnail=image.copy()
                thumbnail.thumbnail((480,324),Image.Resampling.LANCZOS)
                thumbnail.save(PUBLIC/'renders/ream-thumb.webp','WEBP',quality=83,method=5)
            renders.append({'file':f'renders/{target.name}','width':image.width,'height':image.height,'bytes':target.stat().st_size})
    (PUBLIC/'asset-manifest.json').write_text(json.dumps({'version':4,'assets':models,'renders':renders},indent=2)+'\n')
    print([model['bytes'] for model in models],[(r['file'],r['bytes']) for r in renders])


if __name__ == '__main__':
    main()
