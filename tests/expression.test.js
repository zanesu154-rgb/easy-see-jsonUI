import {test} from 'node:test';import assert from 'node:assert/strict';import {expression} from '../src/expression.js';import {runtimeObject} from '../src/bindings.js';
test('real server_form conditions select exactly one branch',()=>{for(const title of ['武道天书','北斗星空图','MSQB:小页|任务','普通']){const c={'#title_text':title};const normal=expression("((#title_text - '武道天书') = #title_text) and ((#title_text - '北斗星空图') = #title_text) and ((#title_text - 'MSQB:') = #title_text)",c);const selected=['武道天书','北斗星空图','MSQB:'].map(name=>expression(`(not ((#title_text - '${name}') = #title_text))`,c).value);assert.equal([normal.value,...selected].filter(Boolean).length,1)}});
test('HUD prefixes and questbook dynamic texture',()=>{assert.equal(expression("(('%.6s' * #hud_title_text_string) = 'MSHUD:')",{'#hud_title_text_string':'MSHUD:状态'}).value,true);assert.equal(expression("('textures/ui/questbook/g_' + (('%.3s' * #form_button_text) - ('%.2s' * #form_button_text)))",{'#form_button_text':'QRA0说明'}).value,'textures/ui/questbook/g_A')});
test('reports unknown data and rejects code',()=>{assert.ok(expression('alert(1)').error);assert.ok(expression('#missing').error);assert.ok(expression('(true').error)});
test('binding aliases evaluate visibility',()=>{const r=runtimeObject({bindings:[{binding_name:'#title_text',binding_name_override:'#ms_book_ttl'},{source_property_name:"(not ((#ms_book_ttl - '武道天书') = #ms_book_ttl))",target_property_name:'#visible'}]},null,{formTitle:'武道天书'});assert.equal(r.visible,true)});

test('string subtraction removes every literal occurrence and keeps numeric subtraction',()=>{
 assert.equal(expression("('$a$$b$' - '$')").value,'ab');
 assert.equal(expression("('aba--aba--aba' - 'aba')").value,'----');
 assert.equal(expression("('abc' - '')").value,'abc');
 assert.equal(expression('(9 - 3)').value,6);
});
test('padded toast fields resolve to usable image paths and text without dollar padding',()=>{
 const icon='textures/items/kai_trial',background='textures/ui/questbook/toast_task',title='§6奖励 勇气之证 ×12、混沌清露 ×3';
 const context={'#text':'toast.'+icon.padEnd(150,'$')+background.padEnd(50,'$')+title};
 for(const [target,source]of [['#text_remainder',"(#text - 'toast.')"],['#adv_icon_field',"('%.150s' * #text_remainder)"],['#adv_icon',"(#adv_icon_field - '$')"],['#adv_bg_field',"(('%.200s' * #text_remainder) - #adv_icon_field)"],['#texture',"(#adv_bg_field - '$')"],['#adv_text',"(((#text_remainder - '$') - #adv_icon) - (#adv_bg_field - '$'))"]]){
  const result=expression(source,context);assert.equal(result.error,undefined);context[target]=result.value;
 }
 assert.equal(context['#adv_icon'],icon);assert.equal(context['#texture'],background);assert.equal(context['#adv_text'],title);
});
