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

// The renderer owns branch visibility; this controller only observes the button's own box.
export function installButtonStates(el, button, {mode, forcedState = 'default', onChange = () => {}}) {
  let hovered=false,pressed=false,pointerId=null;
  el.dataset.button='true';
  const inside=event=>{
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0&&event.clientX>=r.left&&event.clientX<r.right&&event.clientY>=r.top&&event.clientY<r.bottom;
  };
  const update=()=>{
    const state=mode==='edit'?forcedState:pressed&&hovered?'pressed':hovered?'hover':'default';
    el.dataset.buttonState=state;onChange(state);
  };
  update();if(mode!=='preview'||button.enabled===false)return;
  el.addEventListener('pointerenter',event=>{hovered=inside(event);update();});
  el.addEventListener('pointermove',event=>{if(pointerId!==null&&event.pointerId!==pointerId)return;hovered=inside(event);update();});
  el.addEventListener('pointerleave',()=>{hovered=false;update();});
  el.addEventListener('pointerdown',event=>{
    if(event.button!==0||!inside(event))return;
    pressed=true;hovered=true;pointerId=event.pointerId;el.setPointerCapture(event.pointerId);update();
  });
  el.addEventListener('pointerup',event=>{
    if(pointerId!==event.pointerId)return;
    hovered=inside(event);pressed=false;pointerId=null;update();
  });
  el.addEventListener('pointercancel',()=>{hovered=false;pressed=false;pointerId=null;update();});
  el.addEventListener('lostpointercapture',()=>{pressed=false;pointerId=null;update();});
}
