export type Vertex = [number, number, number];
export type PanelKind = 'base' | 'wall' | 'lid' | 'tab';
export interface Panel { id: string; kind: PanelKind; vertices: [Vertex, Vertex, Vertex, Vertex] }
export interface CartonSize { width: number; depth: number; height: number }

const unit = (value:number) => Math.min(1,Math.max(0,value));
const eased = (value:number) => { const t=unit(value); return t*t*(3-2*t); };

export function cartonSize(width:number,depth:number,height:number):CartonSize {
    const limit=(n:number,min:number,max:number,fallback:number) => Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : fallback;
    return {width:limit(width,60,270,155),depth:limit(depth,45,220,104),height:limit(height,25,150,52)};
}

/** Millimetre dieline. The base stays fixed as the four walls rise and the lid folds last. */
export function cartonPanels(size:CartonSize, progress:number):Panel[] {
    const x=size.width/2, z=size.depth/2, h=size.height, depth=size.depth;
    const angle=eased(progress/.62)*Math.PI/2, rise=Math.sin(angle), run=Math.cos(angle);
    const lidAngle=angle+eased((progress-.65)/.35)*Math.PI/2;
    const tab=Math.min(19,h*.40), tabAngle=eased((progress-.23)/.40)*Math.PI/2;
    const yTop=h*rise, ahead=z+h*run;
    const face=(id:string, kind:PanelKind, a:Vertex,b:Vertex,c:Vertex,d:Vertex):Panel => ({id,kind,vertices:[a,b,c,d]});
    const faces=[
        face('base','base',[-x,0,-z],[x,0,-z],[x,0,z],[-x,0,z]),
        face('front','wall',[-x,0,z],[x,0,z],[x,yTop,ahead],[-x,yTop,ahead]),
        face('back','wall',[x,0,-z],[-x,0,-z],[-x,yTop,-ahead],[x,yTop,-ahead]),
        face('left','wall',[-x,0,-z],[-x,0,z],[-x-h*run,yTop,z],[-x-h*run,yTop,-z]),
        face('right','wall',[x,0,z],[x,0,-z],[x+h*run,yTop,-z],[x+h*run,yTop,z]),
    ];
    const ly=yTop+depth*Math.sin(lidAngle), lz=-ahead-depth*Math.cos(lidAngle);
    faces.push(face('cover','lid',[-x,yTop,-ahead],[x,yTop,-ahead],[x,ly,lz],[-x,ly,lz]));
    const tongue=tab*.79, tx=x*.82, close=eased((progress-.82)/.18)*Math.PI/2;
    faces.push(face('tongue','tab',[-tx,ly,lz],[tx,ly,lz],
        [tx,ly+tongue*Math.sin(lidAngle+close),lz-tongue*Math.cos(lidAngle+close)],
        [-tx,ly+tongue*Math.sin(lidAngle+close),lz-tongue*Math.cos(lidAngle+close)]));
    for(const side of [-1,1]) for(const end of [-1,1]){
        const a:Vertex=[side*x,0,end*z], b:Vertex=[side*x,yTop,end*ahead];
        const offset:Vertex=[side*tab*Math.cos(tabAngle),tab*run*Math.sin(tabAngle),-end*tab*rise*Math.sin(tabAngle)];
        faces.push(face(`tab-${side}-${end}`,'tab',[...a],[...b],
            [b[0]+offset[0],b[1]+offset[1],b[2]+offset[2]],[a[0]+offset[0],a[1]+offset[1],a[2]+offset[2]]));
    }
    return faces;
}

export function pileDimensions(panels:Panel[]) {
    const all=panels.flatMap(p=>p.vertices), axis=(i:number)=>Math.max(...all.map(v=>v[i]))-Math.min(...all.map(v=>v[i]));
    return {width:axis(0),height:axis(1),depth:axis(2)};
}
