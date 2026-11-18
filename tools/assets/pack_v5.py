"""Store the reusable passage GLBs and Cycles views in web-ready assets."""
import argparse
import json

from PIL import Image
from pack_v3 import ROOT, denoise, pack_model

WORK=ROOT/'.asset-build'
PUBLIC=ROOT/'public/v5'


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--denoise',action='store_true')
    options=parser.parse_args()
    for folder in ['models','renders']:
        (PUBLIC/folder).mkdir(parents=True,exist_ok=True)
    assets=[pack_model(file,PUBLIC/'models'/file.name)
            for file in sorted((WORK/'v5-models').glob('*.glb'))]
    renders=[]
    for key in ['passage','store','balcony','stock']:
        raw=WORK/'v5-renders'/f'{key}.png'
        if not raw.exists():
            continue
        with Image.open(raw) as frame:
            image=denoise(frame) if options.denoise else frame
            destination=PUBLIC/'renders'/f'{key}.webp'
            image.save(destination,'WEBP',quality=89,method=6)
            renders.append(dict(file=f'renders/{key}.webp',width=image.width,height=image.height,
                               bytes=destination.stat().st_size))
    (PUBLIC/'asset-manifest.json').write_text(json.dumps(dict(version=5,assets=assets,renders=renders),indent=2)+'\n')
    print([(a['id'],a['bytes']) for a in assets],len(renders),'rendered views')


if __name__=='__main__':
    main()
