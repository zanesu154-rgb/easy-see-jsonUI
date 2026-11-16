import {collectionScope} from './collections.js';
import {expression} from './expression.js';

const properties = new Set(['visible', 'text', 'texture', 'alpha', 'color', 'size', 'offset']);

export function runtimeObject(obj, form, simulation = {}, parentContext = {}) {
  const title = simulation.formTitle ?? form?.title ?? '';
  const body = simulation.formBody ?? form?.fields.find(f => f.kind === 'body')?.text ?? '';
  const scope = collectionScope(obj, parentContext, simulation, form);
  const context = {
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
    if (binding.binding_name && !Object.hasOwn(context, binding.binding_name)) trace.push({expression: binding.binding_name, error: '缺少模拟值 ' + binding.binding_name});
    if (binding.binding_name_override && Object.hasOwn(context, binding.binding_name)) {
      const value = context[binding.binding_name];
      assign(binding.binding_name_override, value);
      trace.push({expression: binding.binding_name, target: binding.binding_name_override, value});
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
    _collectionIndex: scope.index, _collectionMissing: scope.missing || false,
    _trace: trace, _context: context
  };
}
