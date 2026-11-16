// Count actual button roots in the active scene, including authored collection_index
// controls. Descendant labels/images share the item context but are not instances.
export function collectionStats(scene,presentation){
  let built=0,visible=0,missing=0;
  for(const [id,obj]of scene.runtime){
    if(obj.type!=='button'||obj._collectionIndex===undefined)continue;
    if(obj._collectionMissing)missing++;
    if(!scene.rects.has(id))continue;
    built++;
    if(presentation.get(id)?.visible)visible++;
  }
  return {built,visible,hidden:built-visible,missing};
}
