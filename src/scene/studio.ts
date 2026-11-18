import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Product } from '../domain/model.ts';
import type { AuthoredAssets } from './authored.ts';
import { assetForProduct, type AssetId } from './asset-registry.ts';

import type { InspectionView } from '../domain/review.ts';

export interface StudioControl {
    dispose(): void;
    setView(id: InspectionView): void;
    setAngle(degrees: number): void;
    setSeparation(amount: number): void;
    setWrap(film:number,straps:number):void;
}

const vertical: Record<string, number> = {
    wrapper: .20, 'loose-sheets': .07, flaps: .24, fill: .075, straps: .19,
    core: .27, cover: .13, swatch: .05, label: .025, lid: .29, paper: .085,
};

export function mountStudio(host:HTMLElement, product:Product, assets:AuthoredAssets, ready:()=>void,
    asset:AssetId=assetForProduct(product.kind, product.profile)):StudioControl {
    const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'برای چرخاندن مدل سه‌بعدی، تصویر را بکشید.');
    const scene = new T.Scene();
    scene.background = new T.Color(product.profile ? '#354241' : '#3d3c35');
    const environment = product.profile ? new T.PMREMGenerator(renderer) : undefined;
    let reflections: T.WebGLRenderTarget | undefined;
    if (environment) {
        const room = new RoomEnvironment();
        reflections = environment.fromScene(room, .07);
        scene.environment = reflections.texture;
        scene.environmentIntensity = product.profile === 'foil' ? .75 : .38;
        room.dispose();
        environment.dispose();
    }
    const camera = new T.PerspectiveCamera(37, 1, .008, 11);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .17;
    controls.minDistance = .17;
    controls.maxDistance = 3.7;
    controls.maxPolarAngle = Math.PI * .495;
    controls.enablePan = false;

    const sky = new T.HemisphereLight('#d6e0e9', '#83735f', .91);
    const light = new T.DirectionalLight('#ffecd5', 3.2);
    const rim = new T.DirectionalLight('#b5cde8', 1.22);
    rim.position.set(1.5, 2.5, -2);
    Object.assign(light.shadow.camera, { left: -.94, right: .94, top: .94, bottom: -.94, near: .05, far: 6 });
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.bias = -.00045;
    scene.add(sky, light, light.target, rim);

    const floorGeometry = new T.PlaneGeometry(200, 200);
    const floorMaterial = new T.MeshStandardMaterial({ color: product.profile ? '#485752' : '#70685a', roughness: .82 });
    const floor = new T.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.012;
    floor.receiveShadow = true;
    const root = new T.Group();
    scene.add(floor, root);
    let frame=0,disposed=false,separation=0;
    const animatedMaterials=new Set<T.Material>();
    let view: InspectionView = 'whole';
    const size = new T.Vector3(.8, .25, .8);

    function draw() {
        frame = 0;
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
    }
    function invalidate(shadows = false) {
        if (disposed) return;
        if (shadows) renderer.shadowMap.needsUpdate = true;
        if (!frame) frame = requestAnimationFrame(draw);
    }
    controls.addEventListener('change', () => invalidate());
    const resize = new ResizeObserver(() => {
        const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        invalidate();
    });

    function setAngle(degrees: number) {
        const radians = T.MathUtils.degToRad(T.MathUtils.clamp(degrees, 7, 76));
        light.position.set(-2.6 * Math.cos(radians), 2.9 * Math.sin(radians), 1.55 * Math.cos(radians));
        light.intensity = T.MathUtils.lerp(3.75, 2.65, radians / 1.4);
        light.shadow.normalBias = T.MathUtils.lerp(.009, .004, radians / 1.4);
        invalidate(true);
    }
    function setView(id: InspectionView) {
        view = id;
        controls.reset();
        if (id === 'edge' && product.kind === 'roll') {
            controls.target.set(.01, size.y * .84, 0);
            camera.position.set(.31, size.y + .65, .32);
        } else if (id === 'edge') {
            controls.target.set(0, size.y * .42, .08);
            camera.position.set(.75, size.y * .56 + .22, 1.06);
        } else if (id === 'macro') {
            controls.target.set(size.x * .12, size.y * .82, size.z * .18);
            camera.position.copy(controls.target).add(new T.Vector3(.41, .29, .39));
        } else {
            controls.target.set(0, size.y * .49, 0);
            camera.position.set(.95, size.y * .49 + .81, 1.59);
        }
        controls.update();
        invalidate();
    }
    function setSeparation(value: number) {
        separation = T.MathUtils.clamp(value, 0, 1);
        root.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            const part = String(object.userData.part);
            const lift = product.profile && part === 'core' ? .115 : vertical[part] || 0;
            object.position.y = lift * separation;
        });
        invalidate(true);
    }
    function setWrap(film:number,straps:number){
        root.traverse(object=>{
            if(!(object instanceof T.Mesh))return;
            const key=String(object.userData.part);
            if(key.startsWith('film')){
                const index=Number(key.split('-')[1])||0,angle=index*Math.PI/2;
                const material=object.material as T.MeshStandardMaterial;
                material.opacity=.27*(1-film*.96);
                object.visible=film<.99;
                object.position.set(Math.sin(angle)*film*.33,film*.20,Math.cos(angle)*film*.30);
                object.rotation.y=film*(index%2===0?1:-1)*.17;
            }
            if(key==='straps'){
                object.visible=straps<.99;
                object.position.y=straps*.34;
            }
        });
        invalidate(true);
    }
    setAngle(34);
    void assets.instance(asset).then(model => {
        if (disposed) return;
        const bounds = new T.Box3().setFromObject(model), center = bounds.getCenter(new T.Vector3());
        bounds.getSize(size);
        const scale = .92 / Math.max(size.x, size.y, size.z);
        size.multiplyScalar(scale);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        if(asset==='wrapped-stock-pallet')model.traverse(object=>{
            if(!(object instanceof T.Mesh)||!String(object.userData.part).startsWith('film'))return;
            const own=(object.material as T.Material).clone();
            own.transparent=true;own.depthWrite=false;
            object.castShadow=false;
            object.material=own;animatedMaterials.add(own);
        });
        root.add(model);
        setView(view);
        setSeparation(separation);
        host.replaceChildren(renderer.domElement);
        resize.observe(host);
        ready();
    }).catch(() => {
        if (!disposed) {
            host.dataset.modelError = 'true';
            host.insertAdjacentHTML('beforeend', '<span class="render-label">بارگیری مدل انجام نشد · تصویر مرجع</span>');
        }
    });
    return {
        setAngle,setView,setSeparation,setWrap,
        dispose() {
            disposed = true;
            cancelAnimationFrame(frame);
            resize.disconnect();
            controls.dispose();
            light.shadow.dispose();
            reflections?.dispose();
            floorGeometry.dispose();
            floorMaterial.dispose();
            animatedMaterials.forEach(m=>m.dispose());
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        },
    };
}
