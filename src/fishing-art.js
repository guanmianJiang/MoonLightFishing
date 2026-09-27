import * as T from './three.module.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';

const loader=new GLTFLoader(),cache=new Map();
export const specimenIds=new Set(['carp','minnow','perch','catfish','oldgold','moon','shrimp']);
function load(path){
 if(!cache.has(path))cache.set(path,new Promise(resolve=>loader.load(path,g=>resolve(g.scene),undefined,error=>{console.warn('Fishing asset unavailable',path,error);resolve(null)})));
 return cache.get(path);
}
export async function loadSpecimen(id){
 if(!specimenIds.has(id))return null;
 const source=await load(`./assets/models/specimens/${id}.glb?v=art4`);if(!source)return null;
 const model=source.clone(true),wrapper=new T.Group(),bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 // Runtime fish face -X; Blender specimens face +X. Normalize all catches to 1.8m.
 model.position.sub(center);wrapper.add(model);wrapper.rotation.y=Math.PI;
 const root=new T.Group();root.add(wrapper);wrapper.scale.setScalar(1.8/size.x);
 root.updateMatrixWorld(true);
 const body=model.getObjectByName(id+'_Body');
 const bodyBounds=body?new T.Box3().setFromObject(body):new T.Box3().setFromObject(root);
 root.userData.tail=model.getObjectByName(id+'_Tail');
 root.userData.mouthLocal=new T.Vector3(bodyBounds.min.x+.025,(bodyBounds.min.y+bodyBounds.max.y)*.5-.035,0);
 return root;
}
function prepare(model){model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return model;}
export function installFishingArt({scene,person,idleLure,bobber,terrainY,hatParts,hookParts,bodyParts,upperArms,foreArms,thighs,shins}){
 const path=n=>`./assets/models/fishing-details/${n}.glb?v=art6`;
 let torsoPivot=null,headPivot=null,hatModel=null;
 for(const [name,x,z,rotation,y] of [['tackle_box',-1.65,-1.6,-.12,.735],['bait_bucket',-.60,-1.05,.2,.735],['field_stool',-3.55,-5.35,.15,null]]){
  load(path(name)).then(source=>{if(!source)return;const m=prepare(source.clone(true));m.position.set(x,y??terrainY(x,z),z);m.rotation.y=rotation;scene.add(m)});
 }
 load(path('angler_hat')).then(source=>{if(!source)return;const m=prepare(source.clone(true));m.position.y=1.16;person.add(m);hatModel=m;if(headPivot)headPivot.attach(m);hatParts.forEach(o=>o.visible=false)});
 const wardrobeStart=person.children.length;
 const canvas=new T.MeshStandardMaterial({color:'#b8ad7d',roughness:.94}),trim=new T.MeshStandardMaterial({color:'#43635b',roughness:.86}),brass=new T.MeshStandardMaterial({color:'#b69954',metalness:.35,roughness:.5});
 const part=(size,pos,material)=>{const m=new T.Mesh(new T.BoxGeometry(...size),material);m.position.set(...pos);m.castShadow=true;person.add(m);return m};
 for(const side of [-1,1]){
  part([.16,.38,.065],[side*.135,.53,.198],canvas).rotation.z=side*-.065;
  part([.125,.13,.034],[side*.135,.45,.243],trim);
  part([.14,.035,.043],[side*.135,.52,.246],canvas);
  part([.065,.14,.065],[side*.10,.74,.165],canvas).rotation.z=side*.28;
  const button=new T.Mesh(new T.SphereGeometry(.013,8,6),brass);button.position.set(side*.135,.52,.271);person.add(button);
 }
 part([.32,.31,.12],[0,.48,-.235],canvas);part([.34,.06,.14],[0,.645,-.245],trim);
 for(const side of [-1,1])part([.042,.34,.04],[side*.135,.60,-.185],trim);
 const oldWardrobe=person.children.slice(wardrobeStart);
 load('./assets/models/angler-gull/angler_body.glb?v=7').then(source=>{
  if(!source)return;const replacement=prepare(source.clone(true)),upperMeshes=[];
  replacement.traverse(o=>{if(!o.isMesh)return;if(/^(Trouser_|Bent_knee|Rolled_cuff|Boot)/.test(o.name))o.visible=false;else upperMeshes.push(o)});
  person.add(replacement);
  torsoPivot=new T.Group();torsoPivot.name='IdleTorsoPivot';torsoPivot.position.set(0,.55,0);replacement.add(torsoPivot);
  headPivot=new T.Group();headPivot.name='IdleHeadPivot';headPivot.position.set(0,.40,0);torsoPivot.add(headPivot);
  for(const part of upperMeshes){const isHead=/^(Head|Hair_cap|Ear|Inner_ear|Sideburn|Eye_white|Eye|Eye_highlight|Brow|Cheek|Nose|Smile)/.test(part.name);(isHead?headPivot:torsoPivot).attach(part)}
  if(hatModel)headPivot.attach(hatModel);
  [...bodyParts,...oldWardrobe].forEach(o=>o.visible=false);
 });
 for(const [name,limbs] of [['upper_sleeve',upperArms],['forearm',foreArms],['trouser_thigh',thighs],['trouser_shin',shins]]){
  load(`./assets/models/angler-gull/${name}.glb?v=motion2`).then(source=>{
   if(!source)return;
   for(const limb of limbs){limb.geometry=new T.BufferGeometry();limb.add(prepare(source.clone(true)));}
  });
 }
 const fallback=[...idleLure.children],idleModels=new Map(),castModels=new Map();let active='grain';
 function update(id,baitOnHook=true){active=id;for(const [key,m] of idleModels)m.visible=key===id;for(const [key,m] of castModels)m.visible=key===id&&baitOnHook;fallback.forEach(o=>o.visible=!idleModels.has(id));hookParts[0].visible=true;hookParts[1].visible=baitOnHook&&!castModels.has(id)}
 for(const id of ['grain','worm','glow'])load(path('bait_'+id)).then(source=>{if(!source)return;const idle=prepare(source.clone(true));idleLure.add(idle);idleModels.set(id,idle);const cast=prepare(source.clone(true));cast.position.set(0,-.24,0);bobber.add(cast);castModels.set(id,cast);update(active)});
 return {update,setIdleLook(torsoYaw=0,headYaw=0,pitch=0){if(torsoPivot){torsoPivot.rotation.y=torsoYaw;torsoPivot.rotation.x=-pitch*.22}if(headPivot){headPivot.rotation.y=headYaw;headPivot.rotation.x=-pitch*.78}}};
}
