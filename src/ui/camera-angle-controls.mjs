export function mountCameraAngleControls(root,getWorld){
 const toggle=root.querySelector('#cameraAngleToggle'),panel=root.querySelector('#cameraAnglePanel');
 const close=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false')};
 toggle.onclick=()=>{if(toggle.disabled)return;panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));getWorld()?.cancelIntro()};
 for(const button of panel.querySelectorAll('[data-camera-angle]'))button.onclick=()=>{
  if(toggle.disabled)return;
  const deltas={left:[-.10,0],right:[.10,0],up:[0,.06],down:[0,-.06]};
  const delta=deltas[button.dataset.cameraAngle];
  if(delta)getWorld()?.orbit(...delta);
 };
 return {close,update({revealing=false,pending}={}){toggle.disabled=revealing||pending?.phase==='result';if(toggle.disabled)close()}};
}
