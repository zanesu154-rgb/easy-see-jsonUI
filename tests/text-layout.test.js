import {test} from 'node:test';import assert from 'node:assert/strict';
import {glyphAdvance,layoutText} from '../src/text-layout.js';import {nodes,diagnose} from '../src/core.js';import {layoutScene} from '../src/layout.js';
test('calibrated advances use nine for Chinese and six for ordinary letters and digits',()=>{
 assert.equal(glyphAdvance('中'),9);assert.equal(glyphAdvance('A'),6);assert.equal(glyphAdvance('3'),6);assert.equal(glyphAdvance('中',4.5),4.5);
});
test('reward text fits 136 units using narrow spaces and punctuation',()=>{
 const layout=layoutText({text:'奖励 勇气之证 ×12、混沌清露 ×3'},136);
 assert.equal(layout.lines.length,1);assert.ok(layout.w<=136);assert.equal(layout.lines[0].glyphs.map(g=>g.char).join(''),'奖励 勇气之证 ×12、混沌清露 ×3');
});
test('formatted text shares exact wrapping and height with content-sized backgrounds',()=>{
 const data={main:{type:'image',size:['100%c + 12px','100%c + 8px'],controls:[{text:{type:'label',text:'§6状态奖励 100%\n最后一行 -12%',size:['default','default'],max_size:[45,'default'],line_padding:2}}]}};
 const scene=layoutScene(nodes(data),'["main"]',{width:640,height:360});
 const key='["main","controls",0,"text"]',text=scene.textLayouts.get(key),label=scene.rects.get(key),parent=scene.rects.get('["main"]');
 assert.ok(text.lines.length>2);assert.equal(text.h,label.h);assert.equal(parent.h,text.h+8);
 assert.equal(text.lines.flatMap(l=>l.glyphs).some(g=>g.char==='§'),false);
});
test('animation offset references are supported syntax rather than array errors',()=>{
 const issues=diagnose({main:{offset:'@hud.test_anim'}});
 assert.equal(issues.some(i=>i.severity==='error'),false);assert.equal(issues[0].severity,'info');
});
