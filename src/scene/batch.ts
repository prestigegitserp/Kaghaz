import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export const GEOMETRY = {
    box: new T.BoxGeometry(1, 1, 1),
    rounded: new RoundedBoxGeometry(1, 1, 1, 2, .025),
    cylinder: new T.CylinderGeometry(1, 1, 1, 24),
    openCylinder: new T.CylinderGeometry(1, 1, 1, 48, 1, true),
    sphere: new T.SphereGeometry(1, 12, 8),
    plane: new T.PlaneGeometry(1, 1),
};
type Kind = keyof typeof GEOMETRY;
const metricGeometry = new Map<string, T.BufferGeometry>();
/** Architectural brick UVs follow physical dimensions instead of stretching over each unit cube. */
function boxWithMetricUV(kind:Kind,scale:number[],tile:number[]):T.BufferGeometry {
    const key=`${kind}/${scale.join(',')}/${tile.join(',')}`;
    let geometry=metricGeometry.get(key);if(geometry)return geometry;
    geometry=GEOMETRY[kind].clone();
    const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++){
        const axis=Math.abs(n.getX(i))>.7?0:Math.abs(n.getY(i))>.7?1:2;
        const u=axis===0?p.getZ(i)*scale[2]:p.getX(i)*scale[0];
        const v=axis===1?p.getZ(i)*scale[2]:p.getY(i)*scale[1];
        uv.setXY(i,u/tile[0],v/tile[1]);
    }
    metricGeometry.set(key,geometry);return geometry;
}
interface Entry {
    matrix: T.Matrix4;
    color: T.Color;
}
/** One draw per material/geometry inside a spatial cell, not one draw per paper package. */
export class Batch {
    private entries = new Map<string, {
        geometry: T.BufferGeometry;
        material: T.Material;
        rows: Entry[];
        shadow: boolean;
    }>();
    private temp = new T.Object3D();
    constructor(readonly group: T.Group) { }
    add(kind: Kind, material: T.Material, position: number[], scale: number[], rotation: number[] = [0, 0, 0], shade = 1, shadow = true): void {
        const tile=material.userData.metricUV as number[]|undefined;
        const metric=tile&&(kind==='box'||kind==='rounded');
        const key = `${kind}/${material.uuid}/${shadow}${metric?'/'+scale.join(','):''}`;
        let bucket = this.entries.get(key);
        if (!bucket) {
            bucket = { geometry: metric?boxWithMetricUV(kind,scale,tile):GEOMETRY[kind], material, rows: [], shadow };
            this.entries.set(key, bucket);
        }
        this.temp.position.set(position[0], position[1], position[2]);
        this.temp.scale.set(scale[0], scale[1], scale[2]);
        this.temp.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
        this.temp.updateMatrix();
        bucket.rows.push({ matrix: this.temp.matrix.clone(), color: new T.Color().setScalar(shade) });
    }
    box(material: T.Material, position: number[], size: number[], rotation: number[] = [0, 0, 0], shade = 1, rounded = false, shadow = true) { this.add(rounded ? 'rounded' : 'box', material, position, size, rotation, shade, shadow); }
    finish(): T.InstancedMesh[] {
        const meshes: T.InstancedMesh[] = [];
        this.entries.forEach(b => {
            const m = new T.InstancedMesh(b.geometry, b.material, b.rows.length);
            b.rows.forEach((e, i) => { m.setMatrixAt(i, e.matrix); m.setColorAt(i, e.color); });
            m.castShadow = b.shadow;
            m.receiveShadow = true;
            m.computeBoundingSphere();
            m.matrixAutoUpdate = false;
            this.group.add(m);
            meshes.push(m);
        });
        this.entries.clear();
        return meshes;
    }
}
export function softContact(parent: T.Group, x: number, z: number, w: number, d: number, opacity = .2): T.Mesh {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, `rgba(34,25,15,${opacity})`);
    g.addColorStop(.55, `rgba(34,25,15,${opacity * .6})`);
    g.addColorStop(1, 'rgba(34,25,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new T.CanvasTexture(c);
    const material = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const m = new T.Mesh(GEOMETRY.plane, material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, .014, z);
    m.scale.set(w, d, 1);
    parent.add(m);
    m.userData.ownedContact = true;
    return m;
}
