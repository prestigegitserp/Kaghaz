"""Convert embedded PNG textures to WebP and rebuild GLB buffer views without stale bytes.
Geometry remains lossless. EXT_texture_webp is declared explicitly; no external URIs.
"""
import json,struct,io,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/v2/models'
records=[]
manifest_path=ROOT/'public/v2/asset-manifest.json'
previous={r['id']:r for r in json.loads(manifest_path.read_text()).get('assets',[])} if manifest_path.exists() else {}
for path in sorted(OUT.glob('*.glb')):
    raw=path.read_bytes();jl,jt=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+jl]);binary=raw[28+jl:]
    already_packed=all(i.get('mimeType')=='image/webp' for i in doc.get('images',[])) and 'EXT_texture_webp' in doc.get('extensionsUsed',[])
    original=previous.get(path.stem,{}).get('sourceBytes',len(raw)) if already_packed else len(raw);image_views={image['bufferView']:image for image in doc.get('images',[]) if 'bufferView'in image}
    packed=bytearray()
    for index,view in enumerate(doc.get('bufferViews',[])):
        content=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        if index in image_views and image_views[index].get('mimeType')!='image/webp':
            image=image_views[index];im=Image.open(io.BytesIO(content));stream=io.BytesIO();im.save(stream,'WEBP',quality=94 if 'normal'in image.get('name','').lower() else 89,method=6);content=stream.getvalue();image['mimeType']='image/webp'
        while len(packed)%4:packed.append(0)
        view['byteOffset']=len(packed);view['byteLength']=len(content);packed.extend(content)
    for texture in doc.get('textures',[]):
        if 'source' in texture:texture.setdefault('extensions',{})['EXT_texture_webp']={'source':texture.pop('source')}
    for key in ['extensionsUsed','extensionsRequired']:
        doc[key]=list(dict.fromkeys(doc.get(key,[])+['EXT_texture_webp']))
    doc['buffers'][0]['byteLength']=len(packed)
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);packed.extend(b'\0'*((-len(packed))%4))
    result=struct.pack('<III',0x46546c67,2,28+len(js)+len(packed))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(packed),0x004e4942)+packed
    path.write_bytes(result)
    triangles=sum((doc['accessors'][p['indices']]['count'] if 'indices'in p else doc['accessors'][p['attributes']['POSITION']]['count'])//3 for mesh in doc.get('meshes',[]) for p in mesh['primitives'])
    records.append({'id':path.stem,'file':f'models/{path.name}','bytes':len(result),'sourceBytes':original,'triangles':triangles,'materials':len(doc.get('materials',[])),'textures':len(doc.get('images',[])),'sha256':hashlib.sha256(result).hexdigest(),'units':'meters','source':'Blender 4.3.2 authored geometry','compression':'lossless geometry / embedded WebP textures'})
for path in (ROOT/'.asset-build/renders').glob('*.png'):
    with Image.open(path) as im:im.save(ROOT/'public/v2/renders'/f'{path.stem}.webp',quality=91,method=6)
(ROOT/'public/v2/asset-manifest.json').write_text(json.dumps({'version':2,'assets':records,'renders':['renders/merchant-wide.webp','renders/counter-detail.webp','renders/stock-and-roll.webp'],'sourceGeometry':'tools/assets/build_assets.py','sourceMaterials':'tools/assets/make_materials.py'},indent=2))
print(json.dumps(records,indent=2))
