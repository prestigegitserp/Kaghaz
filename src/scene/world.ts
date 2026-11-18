import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MaterialLibrary } from './materials.ts';
import { Batch } from './batch.ts';
import { createArchitecture } from './architecture.ts';
import { createBooth, disposeCell, type BoothCell, type Target, type Collider } from './booths.ts';
import { boothPose, type Booth, type Product, type Quality } from '../domain/model.ts';
import { loadGLB, disposeImported } from './importer.ts';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AuthoredAssets, batchPlacements } from './authored.ts';
import { LIGHTING } from './asset-registry.ts';
import { SHOTS, type ShotId } from '../domain/review.ts';
export interface WorldCallbacks {
    select: (boothId: string, productId?: string) => void;
    hover: (text: string, x: number, y: number) => void;
    pose: (x: number, z: number, yaw: number) => void;
    metrics: (metrics: {
        draws: number;
        triangles: number;
        frameMs: number;
        dpr: number;
        mode: string;
    }) => void;
    error: (text: string) => void;
}
interface Trip {
    from: T.Vector3;
    to: T.Vector3;
    fromQ: T.Quaternion;
    toQ: T.Quaternion;
    start: number;
    duration: number;
    complete?: () => void;
}
export class BazaarWorld {
    readonly renderer: T.WebGLRenderer;
    readonly scene = new T.Scene();
    readonly camera = new T.PerspectiveCamera(59, 1, .08, 85);
    readonly materials: MaterialLibrary;
    readonly assets = new AuthoredAssets();
    private pendingAssets = new WeakSet<BoothCell>();
    private readyAssets = new WeakSet<BoothCell>();
    private failedAssets = new WeakSet<BoothCell>();
    private environment: T.WebGLRenderTarget;
    private fill: T.DirectionalLight;
    private sky: T.HemisphereLight;
    private practicals: T.PointLight[] = [];
    private practicalCenter = Infinity;
    private counterLights: T.PointLight[] = [];
    private counterRow = Infinity;
    private renderPaused = false;
    private controls: OrbitControls;
    private cells: BoothCell[] = [];
    private targets: Target[] = [];
    private colliders: Collider[] = [];
    private callback: WorldCallbacks;
    private host: HTMLElement;
    private resizeObserver: ResizeObserver;
    private raycaster = new T.Raycaster();
    private mouse = new T.Vector2();
    private keys = new Set<string>();
    private frame = 0;
    private lastTime = 0;
    private idleUntil = 0;
    private trip?: Trip;
    private drag?: {
        x: number;
        y: number;
        startX: number;
        startY: number;
        moved: boolean;
        id: number;
    };
    private yaw = 0;
    private pitch = 0;
    private motion = new T.Vector2();
    private velocity = new T.Vector2();
    private mode: 'walk' | 'orbit' = 'walk';
    private quality: Quality = 'auto';
    private effective = 'balanced';
    private composer?: EffectComposer;
    private ao?: SSAOPass;
    private shadow: T.DirectionalLight;
    private selected?: string;
    private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    private imported = new Map<string, T.Group>();
    private width = 1;
    private height = 1;
    private metricsAt = 0;
    private slowFrames = 0;
    private vacancies: T.Group[] = [];
    private abort = new AbortController();
    private screenshotPending = false;
    constructor(host: HTMLElement, booths: Booth[], products: Product[], quality: Quality, callbacks: WorldCallbacks, context: WebGL2RenderingContext) {
        this.host = host;
        this.callback = callbacks;
        this.renderer = new T.WebGLRenderer({ canvas: context.canvas as HTMLCanvasElement, context });
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = T.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.domElement.setAttribute('aria-label', 'بازار سه‌بعدی؛ با کشیدن تصویر نگاه کنید و با کلیدهای جهت قدم بزنید.');
        this.renderer.domElement.tabIndex = 0;
        host.prepend(this.renderer.domElement);
        this.scene.background = new T.Color('#887d6a');
        this.scene.fog = new T.Fog('#766b59', 31, 86);
        const environmentScene = new RoomEnvironment(), pmrem = new T.PMREMGenerator(this.renderer);
        this.environment = pmrem.fromScene(environmentScene, .04);
        this.scene.environment = this.environment.texture;
        this.scene.environmentIntensity = .28;
        environmentScene.dispose(); pmrem.dispose();
        this.materials = new MaterialLibrary(() => this.invalidate());
        this.sky = new T.HemisphereLight('#e5ecf3', '#7d634b', .96);
        this.scene.add(this.sky);
        this.shadow = new T.DirectionalLight('#fff0ce', 3.5);
        this.shadow.position.set(-4.4, 8.4, 15.1);
        this.shadow.target.position.set(0, 0, -5);
        this.shadow.castShadow = true;
        this.shadow.shadow.mapSize.set(2048, 2048);
        Object.assign(this.shadow.shadow.camera, { left: -14, right: 14, top: 31, bottom: -24, near: .5, far: 55 });
        this.shadow.shadow.bias = -.0002;
        this.shadow.shadow.normalBias = .022;
        this.scene.add(this.shadow, this.shadow.target);
        const fill = this.fill = new T.DirectionalLight('#c6dce8', .56);
        fill.position.set(6, 5, -18);
        this.scene.add(fill);
        for (let i = 0; i < 3; i++) {
            const light = new T.PointLight('#ffc88e', 47, 12, 2);
            this.scene.add(light);
            this.practicals.push(light);
        }
        for (const x of [-4.68, 4.68]) {
            const light = new T.PointLight('#ffe0ab', 20, 5.3, 2);
            light.position.set(x, 2.98, 10);
            this.scene.add(light);
            this.counterLights.push(light);
        }
        this.scene.add(createArchitecture(this.materials));
        this.setBooths(booths, products);
        this.camera.position.set(.4, 1.95, 17.4);
        this.camera.lookAt(-1.8, 1.9, -3);
        this.syncAngles();
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enabled = false;
        this.controls.target.set(0, 1.7, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = .09;
        this.controls.minDistance = 1.2;
        this.controls.maxDistance = 26;
        this.controls.maxPolarAngle = Math.PI * .49;
        this.controls.minPolarAngle = .16;
        this.controls.enablePan = false;
        this.controls.addEventListener('change', () => { this.idleUntil = performance.now() + 350; this.invalidate(); });
        this.controls.addEventListener('start', () => { this.trip = undefined; });
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(host);
        this.bindEvents();
        this.setQuality(quality);
        this.resize();
        this.renderer.shadowMap.needsUpdate = true;
    }
    private syncAngles() { const e = new T.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ'); this.yaw = e.y; this.pitch = e.x; }
    private bindEvents() {
        const signal = this.abort.signal, canvas = this.renderer.domElement;
        canvas.addEventListener('pointerdown', e => {
            if (this.mode !== 'walk')
                return;
            this.trip = undefined;
            canvas.focus({ preventScroll: true });
            this.drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, id: e.pointerId };
            canvas.setPointerCapture(e.pointerId);
            this.callback.hover('', 0, 0);
        }, { signal });
        canvas.addEventListener('pointermove', e => {
            if (this.drag && this.mode === 'walk') {
                const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
                if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 5)
                    this.drag.moved = true;
                this.yaw -= dx * .0035;
                this.pitch = T.MathUtils.clamp(this.pitch - dy * .003, -.7, .82);
                this.drag.x = e.clientX;
                this.drag.y = e.clientY;
                this.camera.quaternion.setFromEuler(new T.Euler(this.pitch, this.yaw, 0, 'YXZ'));
                this.invalidate();
            }
            else
                this.pick(e.clientX, e.clientY, false);
        }, { signal });
        canvas.addEventListener('pointerup', e => {
            if (this.mode === 'walk' && this.drag && !this.drag.moved)
                this.pick(e.clientX, e.clientY, true);
            this.drag = undefined;
            this.invalidate();
        }, { signal });
        canvas.addEventListener('pointercancel', () => { this.drag = undefined; }, { signal });
        canvas.addEventListener('click', e => { if (this.mode === 'orbit')
            this.pick(e.clientX, e.clientY, true); }, { signal });
        canvas.addEventListener('wheel', e => {
            if (this.mode === 'walk') {
                e.preventDefault();
                this.camera.fov = T.MathUtils.clamp(this.camera.fov + e.deltaY * .018, 38, 73);
                this.camera.updateProjectionMatrix();
                this.invalidate();
            }
        }, { signal, passive: false });
        window.addEventListener('keydown', e => {
            if ((e.target as HTMLElement).closest('input,textarea,select,dialog') || document.querySelector('dialog[open]'))
                return;
            if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft'].includes(e.code)) {
                e.preventDefault();
                this.trip = undefined;
                this.keys.add(e.code);
                this.invalidate();
            }
            if (e.code === 'KeyE' && this.mode === 'walk') {
                const r = canvas.getBoundingClientRect();
                this.pick(r.x + r.width / 2, r.y + r.height / 2, true);
            }
            if (e.code === 'KeyR')
                this.reset();
        }, { signal });
        window.addEventListener('keyup', e => { this.keys.delete(e.code); this.invalidate(); }, { signal });
        window.addEventListener('blur', () => { this.keys.clear(); this.motion.set(0, 0); this.drag = undefined; }, { signal });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(this.frame);
                this.frame = 0;
                this.keys.clear();
                this.motion.set(0, 0);
            }
            else
                this.invalidate();
        }, { signal });
        canvas.addEventListener('webglcontextlost', e => {
            e.preventDefault();
            this.renderPaused = true;
            cancelAnimationFrame(this.frame);
            this.frame = 0;
            this.callback.error('ارتباط با پردازشگر تصویر قطع شد. کاتالوگ و رندرها همچنان در دسترس‌اند.');
        }, { signal });
        canvas.addEventListener('webglcontextrestored', () => {
            this.renderPaused = false;
            this.renderer.shadowMap.needsUpdate = true;
            this.invalidate();
        }, { signal });
    }
    private pick(x: number, y: number, select: boolean) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.set((x - rect.x) / rect.width * 2 - 1, -(y - rect.y) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.far = select ? 22 : 16;
        const hits = this.raycaster.intersectObjects(this.targets.filter(t => t.mesh.parent?.visible !== false).map(t => t.mesh), false);
        let target: Target | undefined;
        for (const hit of hits) {
            const candidate = this.targets.find(t => t.mesh === hit.object);
            if (!candidate)
                continue;
            const cell = this.cells.find(c => c.booth.id === candidate.boothId)!;
            const p = boothPose(cell.booth.slot);
            // Select only an open shop front or a product inside the same shop; never through its back wall.
            if ((p.x < 0 && this.camera.position.x < -7.4) || (p.x > 0 && this.camera.position.x > 7.4))
                continue;
            const targetPoint = hit.point;
            const segment = targetPoint.clone().sub(this.camera.position);
            const distance = segment.length();
            segment.normalize();
            const blocker = this.colliders.some(c => {
                if (!c.occludes)
                    return false;
                const min = new T.Vector3(c.minX, .05, c.minZ), max = new T.Vector3(c.maxX, c.height, c.maxZ);
                const point = new T.Ray(this.camera.position, segment).intersectBox(new T.Box3(min, max), new T.Vector3());
                return point && point.distanceTo(this.camera.position) < distance - .12;
            });
            if (!blocker) {
                target = candidate;
                break;
            }
        }
        canvasCursor(this.renderer.domElement, target ? 'pointer' : this.drag ? 'grabbing' : 'grab');
        if (!target) {
            this.callback.hover('', 0, 0);
            return;
        }
        const cell = this.cells.find(c => c.booth.id === target!.boothId)!;
        if (select)
            this.callback.select(target.boothId, target.productId);
        else
            this.callback.hover(target.productId ? 'بررسی نمونهٔ کاغذ' : cell.booth.name, x - rect.x, y - rect.y);
    }
    setBooths(booths: Booth[], products: Product[]): void {
        this.imported.forEach(disposeImported);
        this.imported.clear();
        this.cells.forEach(c => disposeCell(c));
        this.cells = [];
        this.targets = [];
        this.colliders = [];
        for (const root of this.vacancies) {
            root.traverse(o => { if (o instanceof T.InstancedMesh)
                o.dispose(); if (o instanceof T.Mesh && o.userData.vacancyOwned)
                o.geometry.dispose(); });
            root.removeFromParent();
        }
        this.vacancies = [];
        for (const booth of booths) {
            const cell = createBooth(booth, products, this.materials);
            this.cells.push(cell);
            this.scene.add(cell.root);
            this.targets.push(...cell.targets);
            this.colliders.push(...cell.colliders);
        }
        for (const slot of [8, 9])
            if (!booths.some(b => b.slot === slot)) {
                const root = new T.Group(), pose = boothPose(slot);
                root.position.set(pose.x, 0, pose.z);
                root.rotation.y = pose.rotation;
                const b = new Batch(root);
                b.box(this.materials.materials.plaster, [0, 1.9, -.13], [7.1, 3.8, .2], [], .8);
                for (let i = 0; i < 32; i++)
                    b.box(this.materials.materials.metal, [0, .1 + i * .1, .01], [6.65, .085, .06], [], .6 + i * .004);
                b.box(this.materials.materials.wood, [0, 3.5, .03], [6.8, .65, .14]);
                const sign = new T.Mesh(new T.PlaneGeometry(4.4, .6), this.materials.sign('این‌جا جای شماست', 'غرفهٔ خودتان را به راسته اضافه کنید', '#5b654e'));
                sign.position.set(0, 3.5, .11);
                sign.userData.vacancyOwned = true;
                root.add(sign);
                b.finish();
                this.scene.add(root);
                this.vacancies.push(root);
            }
        this.renderer.shadowMap.needsUpdate = true;
        this.invalidate();
    }
    setQuality(quality: Quality): void {
        this.quality = quality;
        const mobile = matchMedia('(max-width: 700px)').matches;
        const effective = quality === 'auto' ? (mobile ? 'low' : 'balanced') : quality;
        this.effective = effective;
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, effective === 'high' ? 1.6 : effective === 'low' ? .85 : 1.2));
        this.shadow.castShadow = effective !== 'low';
        this.renderer.shadowMap.enabled = effective !== 'low';
        this.composer?.dispose();
        this.ao?.dispose();
        this.composer = undefined;
        this.ao = undefined;
        if (effective === 'high') {
            this.composer = new EffectComposer(this.renderer);
            this.composer.addPass(new RenderPass(this.scene, this.camera));
            this.ao = new SSAOPass(this.scene, this.camera, this.width, this.height);
            this.ao.kernelRadius = .32;
            this.ao.minDistance = .001;
            this.ao.maxDistance = .12;
            this.composer.addPass(this.ao);
            this.composer.addPass(new OutputPass());
        }
        this.resize();
        this.renderer.shadowMap.needsUpdate = true;
        this.invalidate();
    }
    setLighting(id: string): void {
        const profile = LIGHTING.find(p => p.id === id) || LIGHTING[0];
        this.shadow.color.set(profile.key);
        this.shadow.intensity = profile.intensity;
        this.sky.intensity = profile.ambient;
        this.fill.color.set(profile.fill);
        this.fill.intensity = profile.ambient * .58;
        this.scene.environmentIntensity = profile.environment;
        this.renderer.toneMappingExposure = profile.exposure;
        this.practicals.forEach(light => { light.intensity = profile.practical; });
        this.counterLights.forEach(light => { light.intensity = profile.practical * .45; });
        this.materials.materials.lamp.emissiveIntensity = profile.practical / 26;
        this.renderer.shadowMap.needsUpdate = true;
        this.invalidate();
    }
    frameShot(id: ShotId) {
        const shot = SHOTS.find(view => view.id === id);
        if (!shot) return;
        this.setMode('walk');
        this.camera.fov = shot.fov;
        this.camera.updateProjectionMatrix();
        this.travel(new T.Vector3(...shot.camera), new T.Vector3(...shot.target), 960);
    }
    private positionPracticals() {
        const row = T.MathUtils.clamp(Math.round((10 - this.camera.position.z) / 8), 0, 4);
        if (row !== this.counterRow) {
            this.counterRow = row;
            this.counterLights.forEach(light => { light.position.z = 10 - row * 8; });
        }
        const nearest = Math.round((12.5 - this.camera.position.z) / 8);
        if (nearest === this.practicalCenter) return;
        this.practicalCenter = nearest;
        this.practicals.forEach((light, i) => {
            const bay = nearest + i - 1;
            light.visible = bay >= 0 && bay <= 6;
            light.position.set(0, 4.01, 12.5 - bay * 8);
        });
    }
    private async loadCell(cell: BoothCell): Promise<void> {
        if (this.pendingAssets.has(cell) || this.readyAssets.has(cell) || this.failedAssets.has(cell)) return;
        this.pendingAssets.add(cell);
        try {
            const pieces = await Promise.all(cell.slots.map(async slot => {
                const piece = await this.assets.instance(slot.asset, slot.asset === 'merchant-counter' ? cell.booth.accent : undefined);
                piece.position.set(...slot.position); piece.rotation.y = slot.rotation || 0; piece.scale.setScalar(slot.scale || 1);
                return piece;
            }));
            if (!this.cells.includes(cell)) {
                pieces.forEach(p => p.traverse(o => { if (o instanceof T.Mesh && o.userData.ownedMaterial) (o.material as T.Material).dispose(); }));
                return;
            }
            cell.authored.add(batchPlacements(pieces)); this.readyAssets.add(cell);
            this.renderer.shadowMap.needsUpdate = true; this.invalidate();
        } catch (error) {
            this.failedAssets.add(cell); console.warn('Authored assets unavailable; retaining geometric fallback', error);
            this.callback.error('بارگیری جزئیات کامل نشد؛ نمایش سبک و کاتالوگ در دسترس است.');
        } finally { this.pendingAssets.delete(cell); }
    }
    setMode(mode: 'walk' | 'orbit') {
        this.mode = mode;
        this.trip = undefined;
        this.keys.clear();
        this.controls.enabled = mode === 'orbit';
        if (mode === 'orbit') {
            const dir = this.camera.getWorldDirection(new T.Vector3());
            this.controls.target.copy(this.camera.position).addScaledVector(dir, 6);
            this.controls.target.y = 1.7;
            this.controls.update();
        }
        else {
            this.camera.position.y = 1.68;
            this.syncAngles();
        }
        this.invalidate();
    }
    setMotion(x: number, y: number) { this.trip = undefined; this.motion.set(x, y); this.invalidate(); }
    focusBooth(id: string) {
        const cell = this.cells.find(c => c.booth.id === id);
        if (!cell)
            return;
        this.selected = id;
        const p = boothPose(cell.booth.slot);
        const destination = new T.Vector3(p.x * .26, 1.68, p.z + 1.65), look = new T.Vector3(p.x * 1.72, 1.45, p.z - .15);
        this.travel(destination, look, 1100);
    }
    enterBooth(id: string) {
        const cell = this.cells.find(c => c.booth.id === id);
        if (!cell)
            return;
        this.selected = id;
        const p = boothPose(cell.booth.slot);
        const side = p.x < 0 ? -1 : 1;
        // Entrance on the right side of the counter is deliberately left clear.
        const doorwayZ = p.z + side * 2.38;
        const look = new T.Vector3(side * 6, 1.38, p.z);
        this.travel(new T.Vector3(side * 2.05, 1.68, doorwayZ), look, 600, () => this.travel(new T.Vector3(side * 4.3, 1.68, doorwayZ), look, 650));
    }
    reset() { this.selected = undefined; this.camera.fov = 59; this.camera.updateProjectionMatrix(); this.travel(new T.Vector3(.4, 1.95, 17.4), new T.Vector3(-1.8, 1.9, -3), 1100); }
    overview() { this.setMode('orbit'); this.travel(new T.Vector3(0, 3.85, 17), new T.Vector3(0, 1.8, -6), 1200); }
    private travel(to: T.Vector3, look: T.Vector3, duration: number, complete?: () => void) {
        this.keys.clear();
        this.motion.set(0, 0);
        this.velocity.set(0, 0);
        const dummy = new T.PerspectiveCamera();
        dummy.position.copy(to);
        dummy.lookAt(look);
        if (this.mode === 'orbit')
            this.controls.target.copy(look);
        this.trip = { from: this.camera.position.clone(), to, fromQ: this.camera.quaternion.clone(), toQ: dummy.quaternion.clone(), start: performance.now(), duration: this.reduced ? 1 : duration, complete };
        this.invalidate();
    }
    private blocked(x: number, z: number): boolean {
        if (Math.abs(x) > 7.32 || z > 18.7 || z < -29.8)
            return true;
        // Outside the aisle, each shop can only be entered through its own opening.
        if (Math.abs(x) > 2.6) {
            const row = this.cells.some(c => { const p = boothPose(c.booth.slot); return Math.sign(p.x) === Math.sign(x) && Math.abs(z - p.z) < 3.3; });
            if (!row)
                return true;
        }
        return this.colliders.some(c => x > c.minX - .19 && x < c.maxX + .19 && z > c.minZ - .19 && z < c.maxZ + .19);
    }
    private resize() {
        this.width = Math.max(1, this.host.clientWidth);
        this.height = Math.max(1, this.host.clientHeight);
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height, false);
        this.composer?.setSize(this.width, this.height);
        this.invalidate();
    }
    invalidate = () => { if (!this.frame && !document.hidden && !this.renderPaused)
        this.frame = requestAnimationFrame(this.tick); };
    private tick = (time: number) => {
        this.frame = 0;
        const delta = Math.min((time - this.lastTime) / 1000 || .016, .04);
        this.lastTime = time;
        const start = performance.now();
        let active = false;
        if (this.trip) {
            const t = Math.min(1, (time - this.trip.start) / this.trip.duration), smooth = t * t * (3 - 2 * t);
            this.camera.position.lerpVectors(this.trip.from, this.trip.to, smooth);
            this.camera.quaternion.slerpQuaternions(this.trip.fromQ, this.trip.toQ, smooth);
            if (t === 1) {
                const complete = this.trip.complete;
                this.trip = undefined;
                this.syncAngles();
                complete?.();
            }
            else
                active = true;
        }
        else if (this.mode === 'walk') {
            const fw = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) + this.motion.y;
            const rt = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.motion.x;
            const desired = new T.Vector2(rt, fw);
            if (desired.lengthSq() > 1)
                desired.normalize();
            desired.multiplyScalar(this.keys.has('ShiftLeft') ? 3 : 1.9);
            this.velocity.lerp(desired, 1 - Math.exp(-delta * 13));
            if (this.velocity.lengthSq() > .0001) {
                const dx = (Math.cos(this.yaw) * this.velocity.x - Math.sin(this.yaw) * this.velocity.y) * delta;
                const dz = (-Math.sin(this.yaw) * this.velocity.x - Math.cos(this.yaw) * this.velocity.y) * delta;
                const pos = this.camera.position;
                if (!this.blocked(pos.x + dx, pos.z))
                    pos.x += dx;
                if (!this.blocked(pos.x, pos.z + dz))
                    pos.z += dz;
                active = true;
            }
        }
        else if (time < this.idleUntil) {
            this.controls.update();
            active = true;
        }
        for (const cell of this.cells) {
            const distance = cell.root.position.distanceTo(this.camera.position);
            cell.inventory.visible = distance < (this.effective === 'low' ? 29 : 48);
            const close = distance < (this.effective === 'low' ? 15 : 21);
            if (close) void this.loadCell(cell);
            const show = close && this.readyAssets.has(cell);
            if (cell.authored.visible !== show) this.renderer.shadowMap.needsUpdate = true;
            cell.authored.visible = show; cell.fallback.visible = !show;
        }
        this.positionPracticals();
        if (this.composer)
            this.composer.render();
        else
            this.renderer.render(this.scene, this.camera);
        const frameMs = performance.now() - start;
        // Auto only reduces after sustained measured work; it never reports a fabricated FPS.
        if (this.quality === 'auto' && this.effective !== 'low') {
            this.slowFrames = frameMs > 28 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
            if (this.slowFrames > 50) {
                this.effective = 'low';
                this.renderer.setPixelRatio(.85);
                this.shadow.castShadow = false;
                this.resize();
                this.slowFrames = 0;
            }
        }
        if (time - this.metricsAt > 220) {
            this.metricsAt = time;
            this.callback.pose(this.camera.position.x, this.camera.position.z, this.yaw);
            this.callback.metrics({ draws: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, frameMs, dpr: this.renderer.getPixelRatio(), mode: this.effective });
        }
        if (this.screenshotPending) {
            this.screenshotPending = false;
            this.renderer.domElement.toBlob(blob => { if (blob) {
                const a = document.createElement('a');
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = 'Kaghaz-Bazaar.png';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            } });
        }
        if (active || this.keys.size || this.motion.lengthSq())
            this.invalidate();
    };
    async attachModel(boothId: string, blob: Blob): Promise<string> {
        const cell = this.cells.find(c => c.booth.id === boothId);
        if (!cell)
            throw new Error('ابتدا غرفه را بسازید.');
        const data = await loadGLB(blob, this.renderer);
        this.removeModel(boothId);
        const root = data.root, box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
        // The scan is staged as an object in its own clear corner; merchant counter and semantic products survive.
        const scale = Math.min(1.7 / size.x, 2.25 / size.y, 1.55 / size.z);
        root.scale.multiplyScalar(scale);
        root.position.set(2.05 - center.x * scale, -box.min.y * scale + .04, -1.65 - center.z * scale);
        cell.root.add(root);
        this.imported.set(boothId, root);
        this.renderer.shadowMap.needsUpdate = true;
        this.invalidate();
        return `${Math.round(data.triangles).toLocaleString('fa-IR')} مثلث · ${data.textureMB.toFixed(1)} MB تکسچر`;
    }
    removeModel(boothId: string) { const root = this.imported.get(boothId); if (root) {
        disposeImported(root);
        this.imported.delete(boothId);
        this.renderer.shadowMap.needsUpdate = true;
        this.invalidate();
    } }
    capture() { this.screenshotPending = true; this.invalidate(); }
    dispose() { cancelAnimationFrame(this.frame); this.abort.abort(); this.resizeObserver.disconnect(); this.controls.dispose(); this.cells.forEach(disposeCell); this.cells=[]; this.imported.forEach(disposeImported); this.assets.dispose(); this.environment.dispose(); this.materials.dispose(); this.composer?.dispose(); this.ao?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
function canvasCursor(canvas: HTMLCanvasElement, cursor: string) { canvas.style.cursor = cursor; }
