const controlName = name => typeof name === 'string' ? name.split('@')[0] : '';

export function buttonControlVisible(button, childName, state = 'default') {
  const names = {
    default: controlName(button.default_control),
    hover: controlName(button.hover_control),
    pressed: controlName(button.pressed_control)
  };
  const child = controlName(childName);
  if (!child || !Object.values(names).includes(child)) return true;
  const active = state === 'pressed' ? names.pressed || names.hover || names.default
    : state === 'hover' ? names.hover || names.default : names.default;
  return child === active;
}

// Switch existing branches without rebuilding the scene or changing project JSON.
export function installButtonStates(el, button, {mode, forcedState = 'default', onChange = () => {}}) {
  let hovered = false, pressed = false;
  el.dataset.button = 'true';
  const update = () => {
    const state = mode === 'edit' ? forcedState : pressed ? 'pressed' : hovered ? 'hover' : 'default';
    el.dataset.buttonState = state;
    for (const child of el.children) {
      if (child.classList.contains('control')) child.hidden = !buttonControlVisible(button, child.dataset.controlName, state);
    }
    onChange();
  };
  update();
  if (mode !== 'preview') return;
  el.addEventListener('pointerenter', () => { hovered = true; update(); });
  el.addEventListener('pointerleave', () => { hovered = false; pressed = false; update(); });
  el.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('[data-button]') !== el) return;
    pressed = true;
    el.setPointerCapture(event.pointerId);
    update();
  }, true);
  el.addEventListener('pointerup', event => {
    if (!pressed) return;
    const rect = el.getBoundingClientRect();
    hovered = event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom;
    pressed = false;
    update();
  });
  el.addEventListener('pointercancel', () => { hovered = false; pressed = false; update(); });
  el.addEventListener('lostpointercapture', () => { pressed = false; update(); });
}
