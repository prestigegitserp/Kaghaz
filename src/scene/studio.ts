import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Product } from '../domain/model.ts';
import { AuthoredAssets } from './authored.ts';
import { assetForProduct, LIGHTING } from './asset-registry.ts';
export interface StudioControl { dispose:()=>void; setLight:(id:string)=>void; setExploded:(value:boolean)=>void; }
/** Uses the same Blender asset cache as the market; the model represents a material family, not a scanned SKU. */
export function mountStudio(host: HTMLElement, p: Product, assets: AuthoredAssets): StudioControl {
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(36, 1, .01, 15);
    camera.position.set(1.25, .9, 1.8);
    const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04); scene.environment=environment.texture; scene.environmentIntensity=.35;
    room.dispose(); pmrem.dispose();
    scene.add(new T.HemisphereLight('#f2f3ed', '#a9997f', 1.6));
    const light = new T.DirectionalLight('#fff1d6', 3.0);light.position.set(-2, 4, 3);scene.add(light);
    const root = new T.Group(); scene.add(root);
    const floorGeometry=new T.CircleGeometry(1.1,64),floorMaterial=new T.MeshStandardMaterial({color:'#dedbce',roughness:.95});
    const floor=new T.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.008;scene.add(floor);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .3, 0); controls.enableDamping = true; controls.minDistance = .65; controls.maxDistance = 3.6;
    controls.maxPolarAngle = Math.PI*.49; controls.enablePan = false;
    let frame=0,remaining=0,disposed=false,exploded=false;
    const draw=()=>{frame=0;if(disposed)return;controls.update();renderer.render(scene,camera);if(remaining-- > 0)frame=requestAnimationFrame(draw);};
    const invalidate=()=>{if(disposed)return;remaining=20;if(!frame)frame=requestAnimationFrame(draw);};
    controls.addEventListener('change',invalidate);
    const resize=new ResizeObserver(()=>{renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight),false);camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();invalidate();});
    const applyExploded=()=>{
        root.traverse(o=>{if(!(o instanceof T.Mesh))return;
            const base=o.userData.basePosition as T.Vector3; if(!base)return;o.position.copy(base);
            if(exploded){const part=String(o.userData.part||'body');
                if(part==='wrapper'||part==='flaps')o.position.y+=.16;
                if(part==='straps')o.position.y+=.23;
                if(part==='cover')o.position.y+=.12;
                if(part==='swatch')o.position.y+=.03;
            }
        });invalidate();
    };
    void assets.instance(assetForProduct(p.kind)).then(model=>{
        if(disposed)return;
        const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
        const factor=.9/Math.max(size.x,size.y,size.z);model.scale.setScalar(factor);model.position.set(-center.x*factor,-bounds.min.y*factor,-center.z*factor);
        model.traverse(o=>{if(o instanceof T.Mesh)o.userData.basePosition=o.position.clone();});
        root.add(model);host.replaceChildren(renderer.domElement);resize.observe(host);applyExploded();
    }).catch(()=>{if(!disposed){host.dataset.modelError='true';host.insertAdjacentHTML('beforeend','<p class="studio-error">مدل بارگیری نشد؛ نمای کاتالوگ در دسترس است.</p>');}});
    return {
        setLight(id){const profile=LIGHTING.find(x=>x.id===id)||LIGHTING[0];light.color.set(profile.key);light.intensity=profile.intensity;renderer.toneMappingExposure=profile.exposure;invalidate();},
        setExploded(value){exploded=value;applyExploded();},
        dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();environment.dispose();floorGeometry.dispose();floorMaterial.dispose();renderer.dispose();renderer.domElement.remove();},
    };
}
