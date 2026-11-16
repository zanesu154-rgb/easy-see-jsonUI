import {simulationVariables} from './conditional-variables.js';
import {collectionScope} from './collections.js';
import {expression} from './expression.js';

// Neutral inventory state; explicit simulation bindings below always take priority.
const containerDefaults = Object.fromEntries([
  '#item_lock_in_inventory','#item_lock_in_slot','#item_lock','#is_selected_slot',
  '#inventory_selected_item_lock_in_inventory','#inventory_selected_item_lock_in_slot',
  '#stack_splitting_bar_visible','#classic_stack_splitting_overlay_visible','#pocket_stack_splitting_overlay_visible',
  '#progressive_select_down_visible','#progressive_select_up_visible',
  '#progressive_select_left_side_visible','#progressive_select_right_side_visible',
  '#gamepad_cursor_visible','#using_gamepad','#is_using_gamepad','#gamepad_helper_visible',
  '#bundle_selected_item_visible','#show_bundle_tooltip_hover','#show_bundle_tooltip_pocket',
  '#show_bundle_item_slot','#item_durability_visible',
  '#selected_item_durability_visible','#item_storage_visible','#selected_item_storage_visible',
  '#progress_bar_visible','#touch_progress_bar_visible',
  '#safezone_outer_left','#safezone_inner_left','#safezone_outer_right','#safezone_inner_right',
  '#safezone_outer_top','#safezone_inner_top','#safezone_outer_bottom','#safezone_inner_bottom'
].map(name=>[name,false]));

const properties = new Set(['visible', 'text', 'texture', 'alpha', 'color', 'size', 'offset']);

export function runtimeObject(obj, form, simulation = {}, parentContext = {}) {
  const title = simulation.formTitle ?? form?.title ?? '';
  const body = simulation.formBody ?? form?.fields.find(f => f.kind === 'body')?.text ?? '';
  const scope = collectionScope(obj, parentContext, simulation, form);
  const context = {
    ...(simulation.containerTitle!==undefined||scope.containerIndex!==undefined?containerDefaults:{}),
    ...simulationVariables(simulation),
    '#using_touch':simulation.touch??false,
    '$touch': simulation.touch ?? false,
    ...scope.context,
    '#title_text': title, '#text': title, '#name': title,
    '#body_text': body, '#form_text': body,
    '#hud_title_text_string': simulation.title || '',
    '#hud_subtitle_text_string': simulation.subtitle || '',
    '#hud_actionbar_text_string': simulation.actionbar || '',
    ...simulation.bindings
  };
  if (scope.index !== undefined) {
    context['#form_button_text'] = scope.context['#form_button_text'];
    context['#form_button_texture'] = scope.context['#form_button_texture'];
    context._collectionIndex = scope.index;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) context[key.replace(/\|default$/, '')] = value;
  }
  const result = {...obj}, trace = [];
  if (typeof result.ignored === 'string') {
    const evaluated = expression(result.ignored, context);
    trace.push({expression: result.ignored, target: 'ignored', ...evaluated});
    if (!evaluated.error) result.ignored = evaluated.value;
  }
  const assign = (target, value) => {
    context[target] = value;
    const key = target.replace(/^#/, '');
    if (properties.has(key)) result[key] = value;
  };
  for (const binding of Array.isArray(obj.bindings) ? obj.bindings : []) {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) continue;
    const name=binding.binding_name;
    if (name) {
      let evaluated;
      if(Object.hasOwn(context,name))evaluated={value:context[name]};
      else if(typeof name==='string'&&name.startsWith('(')){
        // Binding-name expressions can contain variables naming other bindings.
        const source=name.replace(/\$[\w]+/g,key=>typeof context[key]==='string'&&/^#[\w]+$/.test(context[key])?context[key]:key);
        evaluated=expression(source,context);
      }else evaluated={error:'缺少模拟值 '+name};
      if(evaluated.error)trace.push({expression:name,...evaluated});
      else if(binding.binding_name_override){assign(binding.binding_name_override,evaluated.value);trace.push({expression:name,target:binding.binding_name_override,...evaluated});}
    }
    if (typeof binding.source_property_name !== 'string') continue;
    const evaluated = expression(binding.source_property_name, context);
    trace.push({expression: binding.source_property_name, target: binding.target_property_name, ...evaluated});
    if (!evaluated.error && binding.target_property_name) assign(binding.target_property_name, evaluated.value);
  }
  if (typeof result.text === 'string' && result.text.startsWith('#')) {
    if (Object.hasOwn(context, result.text)) result.text = context[result.text];
    else {
      trace.push({expression: result.text, error: '缺少模拟值 ' + result.text});
      result.text = '';
    }
  }
  if (typeof result.texture === 'string' && Object.hasOwn(context, result.texture)) result.texture = context[result.texture];
  return {
    ...result, visible: scope.missing ? false : result.visible,
    _containerIndex:scope.containerIndex,_containerItem:scope.item,_containerTexture:scope.item?.texture,
    _collectionIndex: scope.index, _collectionMissing: scope.missing || false,
    _trace: trace, _context: context
  };
}
