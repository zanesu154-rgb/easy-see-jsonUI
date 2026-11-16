import {test} from 'node:test';import assert from 'node:assert/strict';import {formButtons,instantiateCollections} from '../src/collections.js';import {runtimeObject} from '../src/bindings.js';
test('each collection item keeps text and texture together across descendants',()=>{const sim={formButtons:[{text:'One',texture:'textures/a'},{text:'Two',texture:'textures/b'}]};const root=runtimeObject({collection_index:1},null,sim);const label=runtimeObject({text:'#form_button_text'},null,sim,root._context);const image=runtimeObject({texture:'#form_button_texture'},null,sim,root._context);assert.equal(label.text,'Two');assert.equal(image.texture,'textures/b');assert.equal(label._collectionIndex,1);assert.equal(runtimeObject({collection_index:8},null,sim).visible,false)});
test('button factories create read-only preview instances without changing source',()=>{const data={main:{collection_name:'form_buttons',factory:{control_ids:{button:'@demo.button'}}}};const f=new Map([['P/ui/button.json',new TextEncoder().encode(JSON.stringify({namespace:'demo',button:{type:'button',text:'#form_button_text'}}))]]);const r=instantiateCollections(data,f,'P/ui/main.json',{formButtons:['A','B']});assert.equal(r.created,2);assert.equal(r.data.main.controls[1].button_1.collection_index,1);assert.equal(r.data.main.controls[0].button_0._generated,true);assert.equal(data.main.controls,undefined)});
test('rejects invalid input and limits collection size',()=>{assert.throws(()=>formButtons({formButtons:{}}));assert.throws(()=>formButtons({formButtons:[{}]}));assert.throws(()=>formButtons({formButtons:Array(501).fill('x')}));assert.deepEqual(formButtons({formButtons:[]}),[])});
test('does not apply form button bounds to inventory collections',()=>{const parent=runtimeObject({collection_name:'inventory_items'},null,{});const item=runtimeObject({collection_index:12,type:'image'},null,{},parent._context);assert.notEqual(item.visible,false);assert.equal(item._collectionIndex,undefined)});

test('collection texture aliases update image properties and stay isolated per button', () => {
  const sim = {formButtons: [
    {text: '开阳', texture: 'textures/items/kai_trial'},
    {text: '下一页', texture: 'textures/ui/next'}
  ]};
  const image = {type: 'image', texture: '', bindings: [
    {binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture', binding_name_override: '#texture'}
  ]};
  for (const index of [0, 1]) {
    const parent = runtimeObject({collection_name: 'form_buttons', collection_index: index}, null, sim);
    const result = runtimeObject(image, null, sim, parent._context);
    assert.equal(result.texture, sim.formButtons[index].texture);
    assert.equal(result._context['#texture'], sim.formButtons[index].texture);
    assert.equal(result._trace[0].value, sim.formButtons[index].texture);
  }
  assert.equal(image.texture, '');
});

test('texture aliases work without an explicit property and feed later expressions', () => {
  const sim = {formButtons: [{text: '节点', texture: 'textures/ui/node'}]};
  const result = runtimeObject({type: 'image', collection_index: 0, bindings: [
    {binding_name: '#form_button_texture', binding_name_override: '#texture'},
    {source_property_name: "(#texture + '_checked')", target_property_name: '#texture'}
  ]}, null, sim);
  assert.equal(result.texture, 'textures/ui/node_checked');
  const parent = runtimeObject({collection_index: 0, bindings: [
    {binding_name: '#form_button_texture', binding_name_override: '#icon'}
  ]}, null, sim);
  assert.equal(runtimeObject({texture: '#icon'}, null, sim, parent._context).texture, 'textures/ui/node');
  assert.equal(runtimeObject({collection_index: 4, bindings: [
    {binding_name: '#form_button_texture', binding_name_override: '#texture'}
  ]}, null, sim).visible, false);
});
