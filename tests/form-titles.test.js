import {test} from 'node:test';import assert from 'node:assert/strict';
import {titleDescriptor,titleMatchesRule} from '../src/form-titles.js';import {readForms} from '../src/forms.js';import {screens} from '../src/project.js';
const files=o=>new Map(Object.entries(o).map(([p,v])=>[p,new TextEncoder().encode(v)]));
test('raw constant titles keep section codes while display titles remove them',()=>{
 const form=readForms(files({'scripts/a.js':`const f=new ActionFormData();f.title('§l§6武道修改器');`}))[0];
 assert.equal(form.title,'§l§6武道修改器');assert.equal(form.displayTitle,'武道修改器');
 assert.equal(readForms(files({'a.js':`const form=new ActionFormData();form.title(unknown);`})).length,0);
});
test('imported constants in templates produce a title pattern and match routed UI',()=>{
 const f=files({'BP/config/title.js':`export const QB_TITLE='MSQB:';`,'BP/scripts/a.js':`import {QB_TITLE} from '../config/title.js';function show(){const f=new ActionFormData();f.title(\`\${QB_TITLE}\${key}|\${page.name}\`);}`,'RP/ui/q.json':JSON.stringify({namespace:'q',main:{type:'screen',bindings:[{source_property_name:"(not ((#title_text - 'MSQB:') = #title_text))",target_property_name:'#visible'}]}})});
 const form=readForms(f)[0];assert.equal(form.title,'MSQB:…|…');assert.equal(form.titlePattern,true);
 assert.equal(screens(f).entries[0].links[0].id,form.id);
 assert.equal(titleMatchesRule(form.fields[0],{name:'MSQB:realm/kai|'}),true);
 assert.equal(titleMatchesRule(form.fields[0],{name:'北斗星空图'}),false);
});
test('concatenations and unknown values are described without executing code',()=>{
 assert.equal(titleDescriptor("'MSQB:' + key + '|' + page.name").text,'MSQB:…|…');
 assert.equal(titleDescriptor('runArbitraryCode()'),null);
});
