import {gradientEditor} from './gradient-editor.js';
import {renderSettings as settings,defaultRenderSettings as defaults,colorSettingKeys} from './render-settings.js';
const groups=[
 ['光照',[['sunAzimuth','太阳方位',-180,180,.1],['sunElevation','太阳仰角',5,85,.1],['exposure','曝光',.1,3,.01]]],
 ['水体颜色',[['waterAbsorption','水体吸收倍率',0,10,.02]]],
 ['法线',[['normalStrengthA','主层强度',-2,2,.01],['normalStrengthB','次层强度',-2,2,.01],['normalScaleA','主层密度',.01,1,.001],['normalScaleB','次层密度',.01,1,.001],['normalSpeedA','主层速度',-8,8,.05],['normalSpeedB','次层速度',-8,8,.05]]],
 ['环境反射',[['reflectionStrength','反射强度',0,2,.01],['reflectionFresnelPower','菲涅尔幂次',.1,24,.1],['reflectionFresnelMin','基础反射',0,1,.01],['reflectionNormalStrength','法线影响',0,1,.01]]],
 ['风格化高光',[['specularStrength','高光强度',0,6,.01],['specularPower','高光幂次',10,500,1],['specularThreshold','高光阈值',0,.95,.01],['specularSoftness','边缘柔度',.001,.5,.001]]],
 ['焦散',[['causticStrength','焦散强度',0,12,.1],['causticScale','光纹密度',.05,3,.01],['causticSpeed','变化速度',0,5,.05],['causticMinDepth','禁用深度 (m)',0,10,.01],['causticFadeInDepth','渐入终点 (m)',.01,12,.01],['causticFadeOutDepth','淡出起点 (m)',.02,16,.01],['causticDepth','消失深度 (m)',.03,20,.01]]],
 ['Bloom',[['bloomThreshold','亮部阈值',0,5,.01],['bloomStrength','光晕强度',0,8,.01],['bloomRadius','光晕半径',0,40,.25]]],
 ['Meniscus',[['meniscusStrength','整体强度',0,1,.01],['meniscusWidth','接触带宽度 (m)',.005,.8,.005],['meniscusCrown','曲面峰位（带宽比例）',.12,.55,.01],['meniscusBulge','曲面隆起',.25,1.5,.01],['meniscusRefraction','曲面折射',0,3,.01],['meniscusGlintReach','高光覆盖（带宽比例）',.15,.7,.01],['meniscusHighlightStrength','高光强度',0,2,.01],['meniscusShadow','内侧暗边',0,.4,.005]]],
 ['沙粒与水底',[['sandSparkleStrength','沙粒高光',0,4,.01],['sandSparkleDensity','沙粒密度',4,40,.5],['underwaterRelief','水底起伏',0,1,.01],['underwaterReliefScale','起伏尺度',.2,6,.05]]],
 ['湿沙',[['wetSandRoughness','湿沙粗糙度',.06,1,.01],['wetSandSpecular','湿沙高光',0,3,.01],['wetSandStrength','打湿强度',0,1,.01],['wetSandReach','湿痕范围 (m)',0,3,.01],['wetSandFeather','湿痕柔边 (m)',.05,2,.01],['wetSandDarkening','湿沙压暗',0,1.5,.01]]],
 ['拍岸',[['shorePeriod','周期 (s)',1,20,.1],['shoreReach','冲岸距离 (m)',0,.9,.01],['shoreFoam','浪花强度',0,1,.01],['foamWidth','泡沫带宽 (m)',.05,2,.01],['foamScale','泡沫密度',.1,6,.05],['foamSpeed','泡沫流速',-2,2,.01],['foamCutoff','泡沫阈值',.05,.95,.01],['foamSoftness','泡沫柔度',.001,.3,.001],['foamWarp','泡沫扰动',0,1.5,.01]]]
];
const fields=groups.flatMap(g=>g[1]),storageKey='moonwater-render-settings-v1';
const textures=[['./assets/Tex_Water_Normal_06.jpg','06 · 当前默认'],['./assets/Tex_Water_Normal_07.png','07'],['./assets/water-normal-03.jpg','03'],['./assets/water-normal-raider-07.jpg','原法线']];
const toneModes={aces:'ACES 电影',neutral:'Neutral 中性',agx:'AgX',reinhard:'Reinhard',linear:'线性',none:'无色调映射'};
const shadingModes={shaded:'Shaded · 着色',wireframe:'Wireframe · 线框','shaded-wireframe':'Shaded + Wireframe · 着色与线框'};
function apply(values){
 if(Array.isArray(values.waterGradient)&&values.waterGradient.length>=2&&values.waterGradient.length<=8&&values.waterGradient.every(s=>Number.isFinite(s.depth)&&s.depth>=0&&s.depth<=50&&/^#[0-9a-f]{6}$/i.test(s.color))){const stops=structuredClone(values.waterGradient).sort((a,b)=>a.depth-b.depth);if(stops.every((s,i)=>!i||s.depth-stops[i-1].depth>=.01))settings.waterGradient=stops;}
for(const key of colorSettingKeys)if(/^#[0-9a-f]{6}$/i.test(values[key]||''))settings[key]=values[key];if(Object.hasOwn(toneModes,values.toneMapping))settings.toneMapping=values.toneMapping;if(Object.hasOwn(shadingModes,values.shadingMode))settings.shadingMode=values.shadingMode;for(const [key,,min,max] of fields)if(Number.isFinite(values[key]))settings[key]=Math.min(max,Math.max(min,values[key]));if(typeof values.bloomOnly==='boolean')settings.bloomOnly=values.bloomOnly;if(textures.some(([path])=>path===values.normalTexture))settings.normalTexture=values.normalTexture;
 const depths=['causticMinDepth','causticFadeInDepth','causticFadeOutDepth','causticDepth'];for(let i=1;i<depths.length;i++)settings[depths[i]]=Math.max(settings[depths[i]],settings[depths[i-1]]+.01);
}
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved){if(!saved.waterGradient&&saved.shallowWaterColor&&saved.midWaterColor&&saved.deepWaterColor)saved.waterGradient=[{depth:0,color:saved.shallowWaterColor},{depth:3.4,color:saved.midWaterColor},{depth:8.8,color:saved.deepWaterColor}];apply(saved);}}catch{}
// Earlier saved settings can suppress the new lens even after deployment.
// Migrate only the meniscus controls once and preserve all other art tuning.
const meniscusOpticsKey='moonwater-meniscus-optics-v2';
try{if(localStorage.getItem(meniscusOpticsKey)!=='1'){
 for(const key of ['meniscusStrength','meniscusWidth','meniscusRefraction','meniscusShadow','shoreLip'])settings[key]=defaults[key];
 localStorage.setItem(meniscusOpticsKey,'1');
}}catch{}
export function createRenderSettingsPanel(world){
 const button=document.createElement('button');button.id='renderSettingsButton';button.type='button';button.setAttribute('aria-label','打开画面设置');button.setAttribute('title','画面设置');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','renderSettingsPanel');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg><span>设置</span>';document.querySelector('#journal').before(button);
 const panel=document.createElement('aside');panel.id='renderSettingsPanel';panel.className='render-settings-panel';panel.hidden=true;panel.setAttribute('aria-label','画面设置');
 panel.innerHTML='<header><strong>画面设置</strong><button type="button" aria-label="关闭画面设置">×</button></header><p>调整自动保存在此浏览器；设为发布默认后，新访客也会使用这套效果。</p><div class="render-settings-fields"></div><footer><button data-action="publish" hidden>设为发布默认</button><button data-action="save">保存到此浏览器</button><button data-action="reset">恢复默认</button><button data-action="export">下载发布默认</button><output aria-live="polite"></output></footer>';
 document.body.append(panel);
 function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','打开画面设置');button.focus();}
 button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));button.setAttribute('aria-label',panel.hidden?'打开画面设置':'收起画面设置');if(!panel.hidden)panel.querySelector('header button').focus();};panel.querySelector('header button').onclick=close;
 panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close();});panel.addEventListener('keyup',e=>e.stopPropagation());
 let refreshGradient=()=>{};const rows=new Map(),body=panel.querySelector('.render-settings-fields');
 const shadingRow=document.createElement('label');shadingRow.className='render-color-row shading-mode-row';shadingRow.textContent='模型显示模式';const shadingSelect=document.createElement('select');shadingSelect.dataset.setting='shadingMode';shadingSelect.setAttribute('aria-label','模型显示模式');for(const [key,name] of Object.entries(shadingModes))shadingSelect.add(new Option(name,key));shadingSelect.onchange=()=>{apply({shadingMode:shadingSelect.value});world.setShadingMode(settings.shadingMode);status.textContent='已自动保存';try{localStorage.setItem(storageKey,JSON.stringify(settings))}catch{}};shadingRow.append(shadingSelect);body.append(shadingRow);world.setShadingMode(settings.shadingMode);
 for(const [title,items] of groups){const section=document.createElement('details');section.open=title==='光照';const summary=document.createElement('summary');summary.textContent=title;section.append(summary);body.append(section);
 if(title==='水体颜色'){const note=document.createElement('p');note.textContent='按水下物体的深度计算：0× 关闭吸收（仍保留水体散射），1× 为基准吸收系数，最高 10×；水体颜色由下方渐变单独控制。';section.append(note);}
 if(title==='Meniscus'){const note=document.createElement('p');note.textContent='先定接触带宽度，再调整峰位与隆起；高光覆盖决定亮点离岸线有多远。';section.append(note);}
 for(const [key,label,min,max,step] of items){const row=document.createElement('label');row.className='render-setting-row';row.innerHTML=`<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}"><input type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}数值">`;const inputs=[...row.querySelectorAll('input')];rows.set(key,inputs);for(const input of inputs){input.oninput=()=>{if(input.value===''||!input.validity.valid)return;apply({[key]:Number(input.value)});syncRows(input);try{localStorage.setItem(storageKey,JSON.stringify(settings));status.textContent='已自动保存';}catch{status.textContent='无法自动保存，请下载配置';}};if(input.type==='number')input.onchange=()=>{if(input.value!==''&&input.validity.valid){apply({[key]:Number(input.value)});try{localStorage.setItem(storageKey,JSON.stringify(settings));status.textContent='已自动保存';}catch{status.textContent='无法自动保存，请下载配置';}}else status.textContent='数值无效，已恢复原值';syncRows();};}section.append(row);}
 if(title==='法线'){const label=document.createElement('label');label.textContent='法线贴图 ';const select=document.createElement('select');select.dataset.setting='normalTexture';select.setAttribute('aria-label','法线贴图');for(const [path,text] of textures)select.add(new Option(text,path));select.value=settings.normalTexture;select.onchange=async()=>{try{await world.setWaterNormalTexture(select.value);settings.normalTexture=select.value;try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{};status.textContent='已自动保存';}catch{select.value=settings.normalTexture;status.textContent='贴图加载失败';}};label.append(select);section.append(label);}
 const colors=title==='光照'?[['sunColor','太阳光颜色']]:title==='拍岸'?[['foamColor','泡沫颜色']]:[];
 for(const [key,name] of colors){const label=document.createElement('label');label.className='render-color-row';label.textContent=name;const input=document.createElement('input');input.type='color';input.dataset.setting=key;input.setAttribute('aria-label',name);input.oninput=()=>{apply({[key]:input.value});status.textContent='已自动保存';try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{};};label.append(input);section.append(label);}
 if(title==='水体颜色')refreshGradient=gradientEditor(section,settings,()=>{status.textContent='已自动保存';try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{};});
 if(title==='光照'){const label=document.createElement('label');label.className='render-color-row';label.textContent='Tone Mapping';const select=document.createElement('select');select.dataset.setting='toneMapping';select.setAttribute('aria-label','Tone Mapping');for(const [key,name] of Object.entries(toneModes))select.add(new Option(name,key));select.onchange=()=>{apply({toneMapping:select.value});status.textContent='已自动保存';try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{};};label.append(select);section.append(label);}
 if(title==='Bloom'){const label=document.createElement('label');label.innerHTML='<input type="checkbox">仅查看 Bloom';label.querySelector('input').onchange=e=>{settings.bloomOnly=e.target.checked;status.textContent='已自动保存';try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{};};section.append(label);}
 }
 const interactionSection=document.createElement('details');interactionSection.innerHTML='<summary>水面交互</summary><p>调试波浪：按住 Shift 并用左键拖动水面，可预览局部水面变化。</p><label class="render-setting-row"><span>区域半径 (m)</span><input type="range" min="0.7" max="4" step="0.1" aria-label="水面交互区域半径"><input type="number" min="0.7" max="4" step="0.1" aria-label="水面交互区域半径数值"></label>';
 body.append(interactionSection);
 const radiusInputs=[...interactionSection.querySelectorAll('input')];
 let interactionRadius=2.2;try{interactionRadius=Number(localStorage.getItem('moonwater-interaction-radius-v1'))||2.2}catch{}
 interactionRadius=Math.min(4,Math.max(.7,interactionRadius));world.setInteractionRadius(interactionRadius);
 for(const input of radiusInputs){input.value=interactionRadius;input.oninput=()=>{if(input.value===''||!input.validity.valid)return;interactionRadius=Number(input.value);for(const other of radiusInputs)if(other!==input)other.value=interactionRadius;world.setInteractionRadius(interactionRadius);try{localStorage.setItem('moonwater-interaction-radius-v1',String(interactionRadius))}catch{};};if(input.type==='number')input.onchange=()=>{if(input.value===''||!input.validity.valid)status.textContent='数值无效，已恢复原值';else{interactionRadius=Number(input.value);world.setInteractionRadius(interactionRadius)}for(const other of radiusInputs)other.value=interactionRadius;};}
 const status=panel.querySelector('footer output');function syncRows(activeInput){for(const [key,inputs] of rows)for(const input of inputs)if(input!==activeInput)input.value=Number(settings[key].toFixed(3));}function sync(){refreshGradient();syncRows();for(const input of panel.querySelectorAll('[data-setting]'))input.value=settings[input.dataset.setting];panel.querySelector('[type=checkbox]').checked=settings.bloomOnly;}
 panel.querySelector('[data-action=save]').onclick=()=>{try{localStorage.setItem(storageKey,JSON.stringify(settings));status.textContent='已保存到此浏览器';}catch{status.textContent='保存失败，可导出配置';}};
 panel.querySelector('[data-action=reset]').onclick=async()=>{try{await world.setWaterNormalTexture(defaults.normalTexture);Object.assign(settings,structuredClone(defaults));world.setShadingMode(settings.shadingMode);sync();localStorage.setItem(storageKey,JSON.stringify(settings));status.textContent='已恢复发布默认并保存';}catch{status.textContent='默认贴图加载失败';}};
 const publishButton=panel.querySelector('[data-action=publish]');
 fetch('/__render-defaults',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(result=>{publishButton.hidden=!result?.writable;}).catch(()=>{});
 publishButton.onclick=async()=>{
  publishButton.disabled=true;status.textContent='正在保存发布默认…';
  const snapshot=structuredClone(settings);
  try{
   const response=await fetch('/__render-defaults',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
   if(!response.ok)throw new Error('保存失败');
   Object.assign(defaults,snapshot);
   status.textContent='已写入项目，重新发布后新访客将使用这套参数';
  }catch{status.textContent='写入失败，请下载发布默认文件';}
  finally{publishButton.disabled=false;}
 };
 panel.querySelector('[data-action=export]').onclick=()=>{
  const url=URL.createObjectURL(new Blob(['// 发布默认画面参数\nexport default '+JSON.stringify(settings,null,2)+';\n'],{type:'text/javascript'}));
  const a=document.createElement('a');a.href=url;a.download='render-defaults.js';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='将下载文件替换 src/render-defaults.js 后随项目发布';
 };sync();
}
