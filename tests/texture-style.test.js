import {test} from 'node:test';import assert from 'node:assert/strict';
import {imageDimensions,textureStyle} from '../src/texture-style.js';
const png=(w,h)=>{const b=new Uint8Array(24);b.set([137,80,78,71]);const v=new DataView(b.buffer);v.setUint32(16,w);v.setUint32(20,h);return b;};
test('boss fill cells crop the correct three pixels instead of shrinking the whole strip',()=>{
 const files=new Map([['RP/textures/fill.png',png(144,5)]]);
 assert.deepEqual(imageDimensions(files.get('RP/textures/fill.png')),[144,5]);
 const style=textureStyle(files,'RP/textures/fill.png',{uv:[72,0],uv_size:[3,5]},{w:3,h:5},'blob:fill');
 assert.equal(style.backgroundSize,'144px 5px');assert.equal(style.backgroundPosition,'-72px 0px');
 const scaled=textureStyle(files,'RP/textures/fill.png',{uv:[72,0],uv_size:[3,5]},{w:6,h:10},'blob:fill');
 assert.equal(scaled.backgroundSize,'288px 10px');assert.equal(scaled.backgroundPosition,'-144px 0px');
});
test('texture sidecar preserves nine-slice borders when content stretches a panel',()=>{
 const files=new Map([['bg.png',png(32,32)],['bg.json',new TextEncoder().encode('{"nineslice_size":4}')]]);
 const style=textureStyle(files,'bg.png',{}, {w:100,h:40},'blob:bg');
 assert.equal(style.borderImageSlice,'4 fill');assert.equal(style.borderImageWidth,'4px');
});
