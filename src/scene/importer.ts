import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
export const MAX_GLB_BYTES = 25 * 1024 * 1024;
export function inspectGLB(buffer: ArrayBuffer): {
    triangles: number;
    nodes: number;
} {
    if (buffer.byteLength > MAX_GLB_BYTES)
        throw new Error('حجم مدل باید حداکثر ۲۵ مگابایت باشد.');
    if (buffer.byteLength < 20)
        throw new Error('فایل GLB ناقص است.');
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength)
        throw new Error('فایل باید GLB نسخهٔ ۲ معتبر باشد.');
    const len = view.getUint32(12, true);
    if (len > 2 * 1024 * 1024 || len + 20 > buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a)
        throw new Error('ساختار مدل پشتیبانی نمی‌شود.');
    let data: any;
    try {
        data = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, len)));
    }
    catch {
        throw new Error('ساختار مدل خوانا نیست.');
    }
    for (const obj of [...(data.images || []), ...(data.buffers || [])])
        if (obj.uri && !String(obj.uri).startsWith('data:'))
            throw new Error('مدل باید مستقل باشد؛ تکسچرها و داده‌ها را داخل GLB قرار دهید.');
    const nodes = data.nodes?.length || 0;
    if (nodes > 600 || (data.meshes?.length || 0) > 150 || (data.images?.length || 0) > 40)
        throw new Error('مدل بیش از بودجهٔ نمایش وب جزئیات دارد.');
    let triangles = 0;
    for (const node of data.nodes || []) {
        const mesh = data.meshes?.[node.mesh];
        if (!mesh)
            continue;
        const instancing = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
        const count = instancing ? Math.max(...Object.values(instancing).map((a: any) => data.accessors?.[a]?.count || 1)) : 1;
        if (count > 1000)
            throw new Error('تعداد نمونه‌های مدل از بودجه بیشتر است.');
        for (const prim of mesh.primitives || []) {
            const ac = data.accessors?.[prim.indices ?? prim.attributes?.POSITION];
            triangles += Math.ceil((ac?.count || 0) / 3) * count;
        }
    }
    if (triangles > 250000)
        throw new Error('مدل باید حداکثر ۲۵۰ هزار مثلث داشته باشد؛ ابتدا آن را بهینه کنید.');
    return { triangles, nodes };
}
export async function loadGLB(blob: Blob, renderer: T.WebGLRenderer): Promise<{
    root: T.Group;
    triangles: number;
    textureMB: number;
}> {
    const bytes = await blob.arrayBuffer();
    const info = inspectGLB(bytes);
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}decoders/draco/`);
    loader.setDRACOLoader(draco);
    const ktx = new KTX2Loader();
    ktx.setTranscoderPath(`${import.meta.env.BASE_URL}decoders/basis/`);
    ktx.detectSupport(renderer);
    loader.setKTX2Loader(ktx);
    loader.setMeshoptDecoder(MeshoptDecoder);
    let gltf;
    try {
        gltf = await loader.parseAsync(bytes, '');
    }
    finally {
        draco.dispose();
        ktx.dispose();
    }
    const root = gltf.scene;
    const box = new T.Box3().setFromObject(root);
    const size = box.getSize(new T.Vector3());
    if (!Number.isFinite(size.length()) || size.length() < .00001) {
        disposeImported(root);
        throw new Error('مدل هندسهٔ قابل نمایش ندارد.');
    }
    let textureBytes = 0;
    const textures = new Set<T.Texture>();
    root.traverse(o => {
        if (o instanceof T.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
                for (const value of Object.values(mat))
                    if (value instanceof T.Texture && !textures.has(value)) {
                        textures.add(value);
                        const image = value.image;
                        textureBytes += (image?.width || 0) * (image?.height || 0) * 4 * 1.333;
                    }
            }
        }
    });
    if (textureBytes > 80 * 1024 * 1024) {
        disposeImported(root);
        throw new Error('حافظهٔ تکسچر مدل بیش از ۸۰ مگابایت است؛ تکسچرها را بهینه کنید.');
    }
    return { root, triangles: info.triangles, textureMB: textureBytes / 1024 / 1024 };
}
export function disposeImported(root: T.Object3D): void {
    const textures = new Set<T.Texture>();
    root.traverse(o => {
        if (o instanceof T.Mesh) {
            o.geometry.dispose();
            for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
                for (const v of Object.values(material))
                    if (v instanceof T.Texture)
                        textures.add(v);
                material.dispose();
            }
        }
    });
    textures.forEach(t => { (t.image as ImageBitmap)?.close?.(); t.dispose(); });
    root.removeFromParent();
}
