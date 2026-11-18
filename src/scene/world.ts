import { STATION_SPECIMENS, type MaterialProfileId } from '../domain/material-profiles.ts';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MaterialLibrary } from './materials.ts';
import { Batch } from './batch.ts';
import { createArchitecture, PASSAGE_PROPS } from './architecture.ts';
import { createBooth, disposeCell, type BoothCell, type Target, type Collider } from './booths.ts';
import { boothPose, type Booth, type Product, type Quality } from '../domain/model.ts';
import { loadGLB, disposeImported } from './importer.ts';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AuthoredAssets, batchPlacements } from './authored.ts';
import { LIGHTING } from './asset-registry.ts';
import { HALL, PHOTO_SHOTS, STATION_IDS, boothPoint, type PhotoShotId, type Point2, type StationId, type Level, levelName } from '../domain/hall.ts';
import { walkRoute } from '../domain/navigation.ts';
export interface WorldCallbacks {
    select: (boothId: string, productId?: string) => void;
    station: (id: StationId) => void;
    level: (level: Level) => void;
    hotspots: (spots: {id:StationId;x:number;y:number;visible:boolean}[]) => void;
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
    private specimenDisplays = new Map<StationId, T.Group>();
    private specimenPreviews: Map<MaterialProfileId, T.Group>;
    readonly camera = new T.PerspectiveCamera(PHOTO_SHOTS[0].fov, 1, .07, 92);
    readonly materials: MaterialLibrary;
    readonly assets = new AuthoredAssets();
    private pendingAssets = new WeakSet<BoothCell>();
    private readyAssets = new WeakSet<BoothCell>();
    private failedAssets = new WeakSet<BoothCell>();
    private environment: T.WebGLRenderTarget;
    private fill: T.DirectionalLight;
    private sky: T.HemisphereLight;
    private practicals: T.PointLight[] = [];
    private renderPaused = false;
    private controls: OrbitControls;
    private cells: BoothCell[] = [];
    private targets: Target[] = [];
    private colliders: Collider[] = [];
    private callback: WorldCallbacks;
    private host: HTMLElement;
    private resizeObserver: ResizeObserver;
    private raycaster = new T.Raycaster();
    private level:Level=0;
    private stairTransit=false;
    private ground = new T.Plane(new T.Vector3(0,1,0),0);
    private marker = new T.Mesh(new T.RingGeometry(.26,.32,40),new T.MeshBasicMaterial({color:'#168071',transparent:true,opacity:.90}));
    private stationBounds = STATION_IDS.map(id => {
        const {position:[x,z],size:[w,d],level}=HALL.stations[id], y=HALL.decks[level];
        return {id,level:level as Level,box:new T.Box3(new T.Vector3(x-w/2,y+.014,z-d/2),new T.Vector3(x+w/2,y+1.60,z+d/2))};
    });
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
        this.renderer.domElement.setAttribute('aria-label', 'بازار سه‌بعدی. روی کف بزنید تا حرکت کنید یا تصویر را برای تغییر نگاه بکشید.');
        this.renderer.domElement.tabIndex = 0;
        host.prepend(this.renderer.domElement);
        this.scene.background = new T.Color('#bcc8c2');
        this.scene.fog = new T.Fog('#b2bdb1',39,90);
        const environmentScene = new RoomEnvironment(), pmrem = new T.PMREMGenerator(this.renderer);
        this.environment = pmrem.fromScene(environmentScene, .04);
        this.scene.environment = this.environment.texture;
        this.scene.environmentIntensity = .28;
        environmentScene.dispose(); pmrem.dispose();
        this.materials = new MaterialLibrary(() => this.invalidate());
        this.sky = new T.HemisphereLight('#eff3f3','#ac9880',1.27);
        this.scene.add(this.sky);
        this.shadow = new T.DirectionalLight('#fff0ce', 3.5);
        this.shadow.position.set(-3.9,7.12,13.69);
        this.shadow.target.position.set(.21,.54,-6.51);
        this.shadow.castShadow = true;
        this.shadow.shadow.mapSize.set(2048, 2048);
        Object.assign(this.shadow.shadow.camera, { left:-12,right:12,top:16,bottom:-19,near:.25,far:40 });
        this.shadow.shadow.bias = -.0002;
        this.shadow.shadow.normalBias = .025;
        this.scene.add(this.shadow, this.shadow.target);
        const fill = this.fill = new T.DirectionalLight('#c6dce8', .56);
        fill.position.set(6, 5, -18);
        this.scene.add(fill);
        for(const [x,y,z] of [[-1.39,3.18,9.68],[1.48,3.14,1.94],[-1.43,6.68,7.51],[1.21,6.61,-10.03]]){
            const light=new T.PointLight('#ffefcc',27,11.2,2);
            light.position.set(x,y,z);
            this.scene.add(light);
            this.practicals.push(light);
        }
        const {root:building,previews}=createArchitecture(this.materials);
        this.specimenPreviews=previews;
        this.scene.add(building);
        for(const prop of PASSAGE_PROPS)void this.assets.instance(prop.asset).then(asset=>{
            if(this.abort.signal.aborted)return;
            asset.position.set(prop.x,HALL.decks[prop.level]+.008,prop.z);
            asset.scale.setScalar(prop.scale);
            asset.rotation.y=prop.turn;
            building.add(asset);
            this.renderer.shadowMap.needsUpdate=true;
            this.invalidate();
        }).catch(()=>{});
        this.marker.rotation.x = -Math.PI/2;
        this.marker.visible = false;
        this.scene.add(this.marker);
        this.setBooths(booths, products);
        this.camera.position.fromArray(HALL.entry);
        this.camera.lookAt(new T.Vector3().fromArray(HALL.entryLook));
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
            if (this.mode !== 'walk' || this.stairTransit)
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
            if (this.stairTransit || (e.target as HTMLElement).closest('input,textarea,select,dialog') || document.querySelector('dialog[open]'))
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
        const targets=this.targets.filter(t=>this.cells.some(c=>c.booth.id===t.boothId&&c.level===this.level));
        const hits=this.raycaster.intersectObjects(targets.map(t=>t.mesh),false);
        const distanceTo = (p:T.Vector3) => p.distanceTo(this.camera.position);
        const opaqueHit = (point:T.Vector3) => {
            const distance = distanceTo(point);
            const direction = point.clone().sub(this.camera.position).normalize();
            const ray = new T.Ray(this.camera.position,direction);
            return this.colliders.some(c => {
                if(!c.occludes || c.level!==this.level)return false;
                const y=HALL.decks[c.level];
                const box=new T.Box3(new T.Vector3(c.minX,y+.04,c.minZ),new T.Vector3(c.maxX,y+c.height,c.maxZ));
                const hit = ray.intersectBox(box,new T.Vector3());
                return hit && distanceTo(hit) < distance - .12;
            });
        };
        const boothHit = hits.find(hit => !opaqueHit(hit.point));
        const target=targets.find(t=>t.mesh===boothHit?.object);
        const station=this.stationBounds.filter(s=>s.level===this.level).map(({id,box})=> ({id, point:this.raycaster.ray.intersectBox(box,new T.Vector3())}))
            .filter(entry => entry.point && distanceTo(entry.point) < this.raycaster.far && !opaqueHit(entry.point))
            .sort((one,other) => distanceTo(one.point!) - distanceTo(other.point!))[0];
        if (station && (!boothHit || distanceTo(station.point!) < boothHit.distance)) {
            canvasCursor(this.renderer.domElement,'pointer');
            if (select) this.callback.station(station.id);
            else this.callback.hover(HALL.stations[station.id].label,x-rect.x,y-rect.y);
            return;
        }
        if(!target&&!this.stairTransit){
            const stair=HALL.stairs,next=this.level===0?1:0;
            const rail=new T.Box3(new T.Vector3(-stair.width*.5,0,stair.high),
                new T.Vector3(stair.width*.5,HALL.decks[1]+.27,stair.low));
            const hit=this.raycaster.ray.intersectBox(rail,new T.Vector3());
            if(hit&&distanceTo(hit)<13.5&&!opaqueHit(hit)){
                canvasCursor(this.renderer.domElement,'pointer');
                if(select)this.changeLevel(next);
                else this.callback.hover(`رفتن به ${levelName(next)}`,x-rect.x,y-rect.y);
                return;
            }
        }
        canvasCursor(this.renderer.domElement, target ? 'pointer' : this.drag ? 'grabbing' : 'grab');
        if (!target) {
            this.callback.hover('', 0, 0);
            if (select && this.mode==='walk' && this.raycaster.ray.direction.y < -.06) {
                const point = this.raycaster.ray.intersectPlane(this.ground,new T.Vector3());
                if (point && distanceTo(point) < 16) this.walkTo([point.x,point.z], undefined, true);
            }
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
        this.colliders=this.stationBounds.map(({box,level})=>({
            minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z,height:1.08,occludes:false,level,
        }));
        for(const {x,z,width,depth,level} of PASSAGE_PROPS)this.colliders.push({
            minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2,height:1.1,occludes:false,level,
        });
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
                root.position.set(pose.x,HALL.decks[pose.level],pose.z);
                root.rotation.y = pose.rotation;
                const b = new Batch(root);
                const m = this.materials.materials;
                b.box(m.plaster,[0,1.31,-.17],[5.7,2.62,.18],[],1,true);
                b.box(m.wood,[0,.469,-.32],[5.52,.10,.54],[],1,true);
                b.box(this.materials.color('#739082'),[0,2.35,-.045],[5.4,.41,.071],[],1,true);
                const sign = new T.Mesh(new T.PlaneGeometry(4.53,.43),
                    this.materials.sign('غرفهٔ شما', 'فضای نمایش و کاتالوگ اختصاصی', '#385b54'));
                sign.position.set(0,2.35,.012);
                const lo=boothPoint(slot,-2.86,-.42),hi=boothPoint(slot,2.86,.11);
                this.colliders.push({minX:Math.min(lo[0],hi[0]),maxX:Math.max(lo[0],hi[0]),
                    minZ:Math.min(lo[1],hi[1]),maxZ:Math.max(lo[1],hi[1]),height:2.7,occludes:true,level:pose.level});
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
        this.materials.materials.lamp.emissiveIntensity = .7 + profile.practical / 28;
        this.renderer.shadowMap.needsUpdate = true;
        this.invalidate();
    }
    frameShot(id: PhotoShotId) {
        const shot=PHOTO_SHOTS.find(view=>view.id===id);
        if(!shot||this.stairTransit)return;
        this.changeLevel(shot.level,()=>{
            this.setMode('walk');
            this.camera.fov=shot.fov;
            this.camera.updateProjectionMatrix();
            this.walkTo([shot.camera[0],shot.camera[2]],new T.Vector3().fromArray(shot.target),false,shot.camera[1]-HALL.decks[shot.level]);
        });
    }
    focusStation(id:StationId) {
        const {position:[x,z],level}=HALL.stations[id];
        const innerX=Math.sign(x)*(level===0?1.07:2.04);
        this.changeLevel(level as Level,()=>this.walkTo([innerX,z+.18],new T.Vector3(x,HALL.decks[level]+1.21,z)));
    }
    private positionHotspots() {
        this.camera.updateMatrixWorld();
        const projected=STATION_IDS.map(id=>{
            const {position:[x,z],level}=HALL.stations[id],anchor=new T.Vector3(x-Math.sign(x)*.18,HALL.decks[level]+1.56,z);
            const distance=anchor.distanceTo(this.camera.position),p=anchor.project(this.camera);
            const visible=!this.stairTransit&&level===this.level&&distance<17.5&&p.z>0&&p.z<1&&Math.abs(p.x)<.86&&Math.abs(p.y)<.77;
            return {id,x:(p.x+1)*50,y:(1-p.y)*50,visible,distance};
        }).sort((a,b)=>a.distance-b.distance);
        const shown:typeof projected=[];
        for(const tag of projected) {
            if(tag.visible && shown.some(item=>Math.abs(tag.x-item.x)<9.4&&Math.abs(tag.y-item.y)<6.7))tag.visible=false;
            if(tag.visible)shown.push(tag);
        }
        this.callback.hotspots(projected);
    }
    private updateSpecimenDisplays() {
        for (const id of STATION_IDS) {
            const contents = STATION_SPECIMENS[id];
            if (!contents) continue;
            const spot = HALL.stations[id], [x,z] = spot.position;
            const active = spot.level === this.level && Math.hypot(this.camera.position.x-x,this.camera.position.z-z) < 8.4;
            let table = this.specimenDisplays.get(id);
            if (!table && active) {
                table = new T.Group();
                this.specimenDisplays.set(id, table);
                table.position.set(x,HALL.decks[spot.level]+1.054,z);
                this.scene.add(table);
                const display = table;
                for (const { asset, offset, scale } of contents) {
                    void this.assets.instance(asset).then(sample => {
                        if (this.abort.signal.aborted) return;
                        sample.position.z = offset;
                        sample.rotation.y = -.09 + offset*.17;
                        sample.scale.setScalar(scale);
                        display.add(sample);
                        this.renderer.shadowMap.needsUpdate = true;
                        this.invalidate();
                    }).catch(() => {});
                }
            }
            if (table && table.visible !== active) {
                table.visible = active;
                this.renderer.shadowMap.needsUpdate = true;
            }
            for (const {asset} of contents) {
                const preview = this.specimenPreviews.get(asset)!;
                const visible = !active || !table?.children.some(child => child.name === asset);
                if (preview.visible !== visible) {
                    preview.visible = visible;
                    this.renderer.shadowMap.needsUpdate = true;
                }
            }
        }
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
        if(this.stairTransit)return;
        this.mode = mode;
        this.trip = undefined;
        this.keys.clear();
        this.controls.enabled = mode === 'orbit';
        if (mode === 'orbit') {
            const dir = this.camera.getWorldDirection(new T.Vector3());
            this.controls.target.copy(this.camera.position).addScaledVector(dir, 6);
            this.controls.target.y=HALL.decks[this.level]+1.70;
            this.controls.update();
        }
        else {
            this.camera.position.y=HALL.decks[this.level]+1.71;
            this.syncAngles();
        }
        this.invalidate();
    }
    setMotion(x:number,y:number) {
        if(this.stairTransit)return;
        this.trip=undefined;
        this.motion.set(x,y);
        this.invalidate();
    }
    focusBooth(id:string) {
        const cell=this.cells.find(c=>c.booth.id===id);
        if(!cell)return;
        this.changeLevel(cell.level,()=>{
            const slot=cell.booth.slot;
            const [x,z]=boothPoint(slot,.15,-1.41);
            const front=cell.level===0?1.73:.77;
            this.walkTo(boothPoint(slot,2.16,front),new T.Vector3(x,HALL.decks[cell.level]+1.51,z));
        });
    }
    enterBooth(id:string) {
        const cell=this.cells.find(c=>c.booth.id===id);
        if(!cell)return;
        this.changeLevel(cell.level,()=>{
            const slot=cell.booth.slot;
            const [x,z]=boothPoint(slot,-.53,-2.66);
            this.walkTo(boothPoint(slot,2.24,-1.23),new T.Vector3(x,HALL.decks[cell.level]+1.44,z));
        });
    }
    reset() { this.frameShot('entry'); }
    changeLevel(next:Level,then?:()=>void) {
        if(this.stairTransit)return;
        if(next===this.level){then?.();return;}
        const fromY=HALL.decks[this.level], toY=HALL.decks[next],stairs=HALL.stairs;
        const entryZ=next===1?stairs.landingLow:stairs.landingHigh;
        const endZ=next===1?stairs.landingHigh:stairs.landingLow;
        this.walkTo([0,entryZ],new T.Vector3(0,toY+1.66,endZ),false,1.71,()=>{
            this.stairTransit=true;
            const target=new T.Vector3(0,toY+1.71,endZ);
            const look=new T.Vector3(-1.28,toY+1.74,endZ+(next===1?2.7:4.2));
            this.travel(target,look,2290,()=>{
                this.level=next;
                this.stairTransit=false;
                this.ground.constant=-toY;
                this.callback.level(next);
                then?.();
            });
        });
    }
    private walkTo(to:Point2,look?:T.Vector3,mark=false,eye=1.73,complete?:()=>void) {
        if (this.mode!=='walk') this.setMode('walk');
        const pos=this.camera.position,path=walkRoute([pos.x,pos.z],to,(x,z)=>this.blocked(x,z));
        if(!path.length)return;
        const heading=this.camera.getWorldDirection(new T.Vector3());
        heading.y=0;
        heading.normalize();
        const base=HALL.decks[this.level];
        if(mark){
            this.marker.position.set(to[0],base+.016,to[1]);
            this.marker.visible=true;
        }
        const advance=(i:number)=>{
            const [x,z]=path[i],target=new T.Vector3(x,base+eye,z),next=path[i+1];
            const aim=next ? new T.Vector3(next[0],base+eye,next[1]) : look ?? target.clone().addScaledVector(heading,2);
            this.travel(target,aim,T.MathUtils.clamp(pos.distanceTo(target)*272,285,2170),next?()=>advance(i+1):complete);
        };
        advance(0);
    }
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
    private blocked(x:number,z:number):boolean {
        const {width,depth,stairs,opening}=HALL;
        if(Math.abs(x)>width/2-.55 || z>depth/2-.68 || z< -14.92)return true;
        if(this.level===1 && Math.abs(x)<opening.halfWidth+.21 && z>opening.far-.20 && z<opening.near+.22)return true;
        if(this.level===0 && Math.abs(x)<stairs.width/2+.15&&z<stairs.low+.20&&z>stairs.high-.22)return true;
        return this.colliders.some(c=>c.level===this.level&&x>c.minX-.20&&x<c.maxX+.20&&z>c.minZ-.20&&z<c.maxZ+.20);
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
            const t = T.MathUtils.clamp((time - this.trip.start) / this.trip.duration,0,1), smooth = t * t * (3 - 2 * t);
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
            cell.inventory.visible = distance < (this.effective === 'low' ? 19 : 36);
            const close=cell.level===this.level&&distance<(this.effective==='low'?8.4:13.9);
            if (close) void this.loadCell(cell);
            const show = close && this.readyAssets.has(cell);
            if (cell.authored.visible !== show) this.renderer.shadowMap.needsUpdate = true;
            cell.authored.visible = show; cell.fallback.visible = !show;
        }
        this.updateSpecimenDisplays();
        if (!this.trip) this.marker.visible=false;
        this.positionHotspots();
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
        this.callback.pose(this.camera.position.x, this.camera.position.z, this.yaw);
        if (time - this.metricsAt > 220) {
            this.metricsAt = time;
            this.callback.metrics({ draws: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, frameMs, dpr: this.renderer.getPixelRatio(), mode: this.effective });
        }
        if (this.screenshotPending) {
            this.screenshotPending = false;
            this.renderer.domElement.toBlob(blob => { if (blob) {
                const a = document.createElement('a');
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = 'Kaghaz-Passage-v6.png';
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
    dispose() { cancelAnimationFrame(this.frame); this.abort.abort(); this.resizeObserver.disconnect(); this.controls.dispose(); this.cells.forEach(disposeCell); this.cells=[]; this.imported.forEach(disposeImported); this.assets.dispose(); this.environment.dispose(); this.materials.dispose(); this.composer?.dispose(); this.ao?.dispose(); this.marker.geometry.dispose(); this.marker.material.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
function canvasCursor(canvas: HTMLCanvasElement, cursor: string) { canvas.style.cursor = cursor; }
