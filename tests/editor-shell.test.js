import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canvasTabShortcut} from '../src/editor-shell.js';
test('Tab toggles viewing/editing only from the canvas, not inputs, menus, buttons or open dialogs',()=>{
 const canvas={closest:()=>null},interactive={closest:()=>({})};
 assert.equal(canvasTabShortcut({key:'Tab',target:canvas}),true);
 assert.equal(canvasTabShortcut({key:'Tab',target:interactive}),false);
 assert.equal(canvasTabShortcut({key:'Tab',target:canvas},{dialogOpen:true}),false);
 for(const modifier of ['shiftKey','ctrlKey','metaKey','altKey','defaultPrevented'])assert.equal(canvasTabShortcut({key:'Tab',target:canvas,[modifier]:true}),false);
 assert.equal(canvasTabShortcut({key:'Enter',target:canvas}),false);
});

test('visible runtime errors retain a source file and original line for the footer link',async()=>{
 const {scriptLocation}=await import('../src/script-controls.js');
 assert.deepEqual(scriptLocation({stack:'Error\n at run (easysee-pack:///BP/scripts/ui.js:12:4)'}),{file:'BP/scripts/ui.js',line:10});
 assert.deepEqual(scriptLocation({file:'BP/scripts/main.js',line:3}),{file:'BP/scripts/main.js',line:3});
 assert.equal(scriptLocation({message:'脚本长时间未响应'}),null);
});
