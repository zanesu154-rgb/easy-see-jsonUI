import {test} from 'node:test';import assert from 'node:assert/strict';
import {screens} from '../src/project.js';import {navigationModel} from '../src/navigation.js';import {cardAnalysis} from '../src/interface-cards.js';
test('branch cards count only their own subtree, including binding-hidden children',()=>{
 const data={namespace:'server_form',long_form:{type:'panel',controls:[
  {first:{type:'panel',bindings:[{source_property_name:"(#title_text = 'One')",target_property_name:'#visible'}],controls:[{shown:{type:'label',text:'A'}},{hidden:{type:'label',visible:false,text:'B'}}]}},
  {second:{type:'panel',bindings:[{source_property_name:"(#title_text = 'Two')",target_property_name:'#visible'}],controls:[{other:{type:'label',text:'C'}}]}}
 ]}};
 const files=new Map([['RP/ui/server_form.json',new TextEncoder().encode(JSON.stringify(data))]]),model=navigationModel(files,screens(files));
 const counts=model.routes.map(route=>cardAnalysis(files,route.screen,{formTitle:route.sample},route).scene.total);
 assert.deepEqual(counts,[3,2]);assert.equal(cardAnalysis(files,model.routes[0].screen,{formTitle:'One'}).scene.total,6);
 const first=cardAnalysis(files,model.routes[0].screen,{formTitle:'One'},model.routes[0]);assert.equal(first.scene.rects.size,2);
});
