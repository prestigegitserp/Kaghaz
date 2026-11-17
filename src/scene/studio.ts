import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Batch } from './batch.ts';
import type { MaterialLibrary } from './materials.ts';
import type { Product } from '../domain/model.ts';
export function mountStudio(host: HTMLElement, p: Product, m: MaterialLibrary): () => void {
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.replaceChildren(renderer.domElement);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(36, 1, .01, 15);
    camera.position.set(.85, .8, 1.3);
    scene.add(new T.HemisphereLight('#f2f3ed', '#a9997f', 2.6));
    const light = new T.DirectionalLight('#fff1d6', 3.4);
    light.position.set(-2, 4, 3);
    scene.add(light);
    const root = new T.Group();
    scene.add(root);
    const b = new Batch(root);
    const color = m.color(p.color);
    if (p.kind === 'roll') {
        const side = new T.Mesh(new T.CylinderGeometry(.22, .22, .55, 64, 1, true), m.materials.kraft);
        side.position.y = .28;
        root.add(side);
        for (const y of [.005, .555]) {
            const ring = new T.Mesh(new T.RingGeometry(.035, .22, 64), m.materials.rollend);
            ring.rotation.x = y > .2 ? -Math.PI / 2 : Math.PI / 2;
            ring.position.y = y;
            root.add(ring);
        }
        const core = new T.Mesh(new T.CylinderGeometry(.035, .035, .55, 32, 1, true), m.materials.darkwood);
        core.position.y = .28;
        root.add(core);
    }
    else if (p.kind === 'box') {
        const w = .5, h = .33, d = .38, t = .008;
        b.box(m.materials.kraft, [0, .01, 0], [w, t, d]);
        for (const z of [-d / 2, d / 2])
            b.box(m.materials.kraft, [0, h / 2, z], [w, h, t]);
        for (const x of [-w / 2, w / 2])
            b.box(m.materials.kraft, [x, h / 2, 0], [t, h, d]);
        for (const sign of [-1, 1])
            b.box(m.materials.kraft, [sign * .31, h, 0], [.15, t, d], [0, 0, -sign * .35]);
    }
    else if (p.kind === 'swatch') {
        ['#d9caa9', '#c7a66e', '#af745e', '#849e8b', '#72949f', p.color].forEach((c, i) => {
            const angle = (i - 2.5) * .19;
            b.box(m.color(c), [Math.sin(angle) * .12, .08 + i * .004, -Math.cos(angle) * .12], [.13, .004, .34], [0, angle, 0]);
        });
    }
    else {
        const isReam = p.kind === 'ream', layers = isReam ? 1 : 8;
        for (let i = 0; i < layers; i++)
            b.box(i === layers - 1 ? color : m.materials.edge, [0, .04 + i * .012, 0], [.35, isReam ? .075 : .01, .49], [0, i * .01, 0]);
        if (isReam)
            b.add('plane', m.materials.ream, [0, .078, 0], [.34, .48, 1], [-Math.PI / 2, 0, 0]);
    }
    b.finish();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .15, 0);
    controls.enableDamping = true;
    controls.minDistance = .55;
    controls.maxDistance = 2.5;
    controls.maxPolarAngle = 1.55;
    controls.enablePan = false;
    let frame = 0, remaining = 0;
    const draw = () => { frame = 0; controls.update(); renderer.render(scene, camera); if (remaining-- > 0)
        frame = requestAnimationFrame(draw); };
    controls.addEventListener('change', () => { remaining = 15; if (!frame)
        frame = requestAnimationFrame(draw); });
    const resize = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight, false); camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); remaining = 1; if (!frame)
        frame = requestAnimationFrame(draw); });
    resize.observe(host);
    controls.update();
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); root.traverse(o => { if (o instanceof T.Mesh && !(o instanceof T.InstancedMesh))
        o.geometry.dispose(); if (o instanceof T.InstancedMesh)
        o.dispose(); }); renderer.dispose(); renderer.domElement.remove(); };
}
