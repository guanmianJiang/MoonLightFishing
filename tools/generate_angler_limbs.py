"""Low-poly articulated limb skins matching the seated angler's Blender palette."""
import bpy, math, os
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'assets_pipeline'/'angler-limbs';web=root/'dist'/'assets'/'models'/'angler-gull'
out.mkdir(parents=True,exist_ok=True);web.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.84;return m
teal=material('Sea_green_coat',(.11,.26,.23));linen=material('Rolled_linen',(.86,.79,.59));skin=material('Warm_skin',(.63,.36,.22));seam=material('Dark_seam',(.07,.13,.12));pants=material('Indigo_trousers',(.09,.17,.22))
def profile(name,rings,mat):
 verts=[];faces=[];n=10
 for y,r in rings:
  for i in range(n):
   a=2*math.pi*i/n;verts.append((math.cos(a)*r,math.sin(a)*r,y))
 for k in range(len(rings)-1):
  for i in range(n):faces.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
 faces.append(tuple(reversed(range(n))));faces.append(tuple(range((len(rings)-1)*n,len(rings)*n)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat);return obj
assets={
 'upper_sleeve':[profile('Tailored_sleeve', [(-.5,.80),(-.35,.88),(.05,.98),(.37,1.08),(.5,1.04)],teal),profile('Cuff_seam',[(-.5,.84),(-.44,.86)],seam)],
 'forearm':[profile('Forearm_skin',[(-.5,.78),(-.30,.83),(.30,.9),(.5,.95)],skin),profile('Rolled_cuff',[(.30,.99),(.43,1.03),(.5,1.0)],linen)],
 'trouser_thigh':[profile('Trouser_thigh_skin',[(-.5,.84),(-.35,.96),(.10,1.02),(.5,1.05)],pants)],
 'trouser_shin':[profile('Trouser_shin_skin',[(-.5,.82),(-.30,.87),(.35,.96),(.5,1.0)],pants),profile('Rolled_cuff',[(-.5,.9),(-.42,.93)],linen)]
}
for name,objects in assets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.export_scene.gltf(filepath=str(web/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'angler_limbs.blend'))
print('ANGLER_LIMBS',[(k,sum(len(o.data.polygons)*2 for o in v)) for k,v in assets.items()])
