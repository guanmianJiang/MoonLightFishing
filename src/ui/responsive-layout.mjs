const finiteSize=(value,fallback)=>Number.isFinite(value)&&value>0?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function responsiveUILayout(width,height){
 const w=finiteSize(width,320),h=finiteSize(height,568);
 return {gutter:Math.round(clamp(w*.03,8,16)),actionWidth:Math.round(clamp(w*.55,160,248)),routeBodyMax:Math.round(clamp(h*.18,40,160)),widthMode:w<350?'narrow':'regular',heightMode:h<680?'short':'regular'};
}

export function mountResponsiveUI(game,view=window){
 if(!game)return()=>{};
 const root=game.ownerDocument.documentElement,cache=new Map();
 const write=(target,name,value)=>{const key=(target===root?'root:':'game:')+name;if(cache.get(key)===value)return;cache.set(key,value);target.style.setProperty(name,value);};
 const update=()=>{
  const rect=game.getBoundingClientRect(),layout=responsiveUILayout(rect.width,rect.height);
  for(const [name,value] of Object.entries({gutter:layout.gutter,'action-width':layout.actionWidth,'route-body-max':layout.routeBodyMax}))write(game,'--ui-'+name,value+'px');
  if(game.dataset.uiWidth!==layout.widthMode)game.dataset.uiWidth=layout.widthMode;
  if(game.dataset.uiHeight!==layout.heightMode)game.dataset.uiHeight=layout.heightMode;
  const viewport=view.visualViewport;
  if(root.dataset.uiWidth!==layout.widthMode)root.dataset.uiWidth=layout.widthMode;
  const visibleMode=finiteSize(viewport?.height,finiteSize(view.innerHeight,568))<480?'short':'regular';
  if(root.dataset.uiViewport!==visibleMode)root.dataset.uiViewport=visibleMode;
  write(root,'--ui-frame-width',finiteSize(rect.width,320)+'px');
  write(root,'--ui-visible-height',finiteSize(viewport?.height,finiteSize(view.innerHeight,568))+'px');
  write(root,'--ui-visible-top',(Number.isFinite(viewport?.offsetTop)?Math.max(0,viewport.offsetTop):0)+'px');
 };
 const observer=view.ResizeObserver?new view.ResizeObserver(update):null;
 observer?.observe(game);view.addEventListener('resize',update);
 view.visualViewport?.addEventListener('resize',update);view.visualViewport?.addEventListener('scroll',update);
 update();
 return()=>{observer?.disconnect();view.removeEventListener('resize',update);view.visualViewport?.removeEventListener('resize',update);view.visualViewport?.removeEventListener('scroll',update);};
}
