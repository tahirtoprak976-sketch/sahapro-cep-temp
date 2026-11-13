// Bounded, in-memory memoization of pure text normalization. No entity IDs, storage or network.
export function memoizeText(normalize){
 const cache=new Map();let chars=0;
 return value=>{
  if(typeof value!=='string'||value.length>2048)return normalize(value);
  if(cache.has(value))return cache.get(value);
  const result=normalize(value);if(typeof result!=='string'||value.length+result.length>131072)return result;
  while(cache.size>=512||chars+value.length+result.length>131072){const key=cache.keys().next().value;chars-=key.length+cache.get(key).length;cache.delete(key);}
  cache.set(value,result);chars+=value.length+result.length;return result;
 };
}
