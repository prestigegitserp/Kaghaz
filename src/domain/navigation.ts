import { HALL, type Point2 } from './hall.ts';

const step = .46;
const xMax = HALL.width / 2 - .52;
const zMax = HALL.depth / 2 - .52;
const columns = Math.floor(xMax * 2 / step) + 1;
const rows = Math.floor(zMax * 2 / step) + 1;
const neighbours = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
type Blocked = (x:number,z:number)=>boolean;

export function walkLineClear(from:Readonly<Point2>, to:Readonly<Point2>, blocked:Blocked) {
    const dx=to[0]-from[0], dz=to[1]-from[1], steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.14));
    for (let i=1;i<=steps;i++) if (blocked(from[0]+dx*i/steps, from[1]+dz*i/steps)) return false;
    return true;
}

export function walkRoute(from:Point2,to:Point2,blocked:Blocked): Point2[] {
    if (![...from,...to].every(Number.isFinite)||blocked(...to)) return [];
    if(walkLineClear(from,to,blocked))return [to];
    const center = (id:number):Point2 => [(id%columns)*step-xMax,Math.floor(id/columns)*step-zMax];
    function nearest(point:Point2) {
        const ix=Math.round((point[0]+xMax)/step),iz=Math.round((point[1]+zMax)/step);
        let best=-1,distance=Infinity;
        for(let dz=-2;dz<=2;dz++) for(let dx=-2;dx<=2;dx++){
            const x=ix+dx,z=iz+dz;
            if(x<0||x>=columns||z<0||z>=rows)continue;
            const id=z*columns+x, candidate=center(id);
            const dist=Math.hypot(candidate[0]-point[0],candidate[1]-point[1]);
            if(dist<distance && walkLineClear(point,candidate,blocked)){best=id;distance=dist;}
        }
        return best;
    }
    const start=nearest(from), goal=nearest(to);
    if(start<0||goal<0)return [];
    const open = new Set([start]), closed = new Uint8Array(columns*rows);
    const previous = new Int32Array(columns*rows).fill(-1);
    const cost = new Float64Array(columns*rows).fill(Infinity);
    cost[start]=0;
    const end=center(goal);
    while(open.size) {
        let current=-1, score=Infinity;
        for (const id of open) {
            const p=center(id), f=cost[id]+Math.hypot(end[0]-p[0],end[1]-p[1])/step;
            if(f<score){score=f;current=id;}
        }
        if(current===goal){
            const path:Point2[]=[to];
            for(let id=goal;id>=0;id=previous[id])path.push(center(id));
            path.reverse();
            const simple:Point2[]=[];
            for(let k=0;k<path.length;){
                const point=simple.at(-1)||from;
                let next=k;
                while(next+1<path.length&&walkLineClear(point,path[next+1],blocked))next++;
                simple.push(path[next]);k=next+1;
            }
            return simple;
        }
        open.delete(current);closed[current]=1;
        const x=current%columns,z=Math.floor(current/columns);
        for(const [dx,dz] of neighbours){
            const nx=x+dx,nz=z+dz,next=nz*columns+nx;
            if(nx<0||nx>=columns||nz<0||nz>=rows||closed[next]||!walkLineClear(center(current),center(next),blocked))continue;
            const score=cost[current]+Math.hypot(dx,dz);
            if(score>=cost[next])continue;
            previous[next]=current;cost[next]=score;open.add(next);
        }
    }
    return [];
}
