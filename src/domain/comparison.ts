/** Comparison is a selection of independent SKUs; quantities and units are never summed. */
export function toggleComparison(current:readonly string[],id:string,validIds:readonly string[]):{ids:string[];full:boolean}{
  const ids=[...new Set(current)].filter(x=>validIds.includes(x));
  if(ids.includes(id))return {ids:ids.filter(x=>x!==id),full:false};
  if(!validIds.includes(id))return {ids,full:false};
  if(ids.length>=3)return {ids,full:true};
  return {ids:[...ids,id],full:false};
}
