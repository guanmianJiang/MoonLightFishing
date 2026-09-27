import bpy, math, os, sys, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets_pipeline','shore-props'); WEB=os.path.join(ROOT,'dist','assets','models')
os.makedirs(OUT,exist_ok=True);os.makedirs(WEB,exist_ok=True)
BLOCK='--blockout' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
 return m
wood=material('Warm_oiled_timber',(.40,.235,.115),.65)
cream=material('Canvas_cream',(.87,.82,.66),.86);teal=material('Canvas_seafoam',(.19,.48,.45),.8)
coral=material('Canvas_muted_coral',(.65,.285,.19),.83);metal=material('Brass_pivots',(.35,.28,.15),.4)
clay=material('Review_clay',(.48,.48,.48),.85)
assets={}
def finish(obj,name,mat):
 obj.name=name;obj.data.materials.append(clay if BLOCK else mat);return obj
def beam(a,b,w,depth,mat,name):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2);o=bpy.context.object;o.dimensions=(w,depth,(b-a).length);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if not BLOCK:
  mod=o.modifiers.new('Soft_edge','BEVEL');mod.width=.008;mod.segments=2
  o.modifiers.new('Weighted_normals','WEIGHTED_NORMAL')
 return finish(o,name,mat)
def tube(a,b,r,mat,name):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return finish(o,name,mat)
def surface(name,verts,faces,mat,thickness=.008):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);finish(o,name,mat)
 if thickness:
  mod=o.modifiers.new('Fabric_thickness','SOLIDIFY');mod.thickness=thickness
 return o

import random
rng=random.Random(231)
stone=[material('Limestone_'+str(i),c,.93) for i,c in enumerate([(.48,.46,.35),(.59,.56,.43),(.66,.62,.48),(.38,.40,.34)])]
char=material('Charred_wood',(.095,.054,.028),.95)
flame=material('Flame_amber',(.95,.30,.035),.7)
heart=material('Flame_gold',(1.,.68,.15),.6)
for m in [flame,heart]:
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=m.diffuse_color;p.inputs['Emission Strength'].default_value=.7
# Layered rock profiles form weathered ledges without sphere-like silhouettes.
def boulder(name,sx,sy,h):
 verts=[];faces=[];n=9
 jitter=[rng.uniform(.85,1.13) for _ in range(n)]
 for level,(z,r) in enumerate([(0,.72),(.16,1.),(.53,.94),(.77,.76),(1.,.40)]):
  for i in range(n):
   a=i*math.tau/n;v=jitter[i]*r
   verts.append((math.cos(a)*sx*v+z*.12,math.sin(a)*sy*v-z*.08,h*(z+(rng.uniform(-.035,.035) if level not in [0,4] else 0))))
 faces.append(tuple(reversed(range(n))))
 for level in range(4):
  for i in range(n):faces.append((level*n+i,level*n+(i+1)%n,(level+1)*n+(i+1)%n,(level+1)*n+i))
 faces.append(tuple(4*n+i for i in range(n)))
 o=surface(name,verts,faces,stone[0],0)
 if not BLOCK:
  for m in stone[1:]:o.data.materials.append(m)
  for face in o.data.polygons:face.material_index=2 if face.center.z>h*.8 else rng.choices([0,1,2,3],[5,4,1,1])[0]
 return o
for name,dims in [('reef_tall',(.85,.70,2.25)),('reef_shelf',(1.15,.83,1.10)),('reef_small',(.50,.46,.66))]:
 o=boulder(name,*dims);assets[name]=[o]
start=set(bpy.context.scene.objects)
for i in range(11):
 a=i*math.tau/11;r=.66+rng.uniform(-.035,.035)
 o=boulder('Fire_ring_stone',.21,.17,.24+rng.random()*.07);o.location=(math.cos(a)*r,math.sin(a)*r,0);o.rotation_euler.z=a
# Flat coal bed grounds the logs and keeps the interior from looking empty.
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.57,depth=.035,location=(0,0,.025));finish(bpy.context.object,'Coal_bed',char)
for i in range(5):
 a=i*math.tau/5
 tube((math.cos(a)*.48,math.sin(a)*.48,.10),(-math.cos(a)*.24,-math.sin(a)*.24,.30),.105,char if i%2 else wood,'Firewood')
for i in range(6):
 a=i*math.tau/6;r=.16 if i else 0;h=.67+rng.random()*.35
 # Bent faceted flame tongues; separate mesh names are animated by the engine.
 verts=[]
 for z,w,dx in [(0,.15,0),(.33,.13,.035),(.7,.065,-.045),(1.,0,.10)]:
  for j in range(5):
   t=j*math.tau/5;verts.append((math.cos(a)*r+math.cos(t)*w+dx,math.sin(a)*r+math.sin(t)*w,.20+z*h))
 faces=[(k*5+j,k*5+(j+1)%5,(k+1)*5+(j+1)%5,(k+1)*5+j) for k in range(3) for j in range(5)]
 surface('Flame_%02d'%i,verts,faces,flame if i%2 else heart,0)
assets['beach_campfire']=list(set(bpy.context.scene.objects)-start)
# Export each asset near its own ground pivot before arranging review scene.
manifest={'lane':'Art-directed','units':'metres','assets':[],'texture_policy':'palette PBR; no baked texture or production UV claim'}
for name,objects in assets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 triangles=0
 for o in objects:
  evaluated=o.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();mesh.calc_loop_triangles();triangles+=len(mesh.loop_triangles);evaluated.to_mesh_clear()
 assert triangles<12000,(name,triangles)
 if not BLOCK:bpy.ops.export_scene.gltf(filepath=os.path.join(WEB,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
 manifest['assets'].append({'name':name,'triangles':triangles,'pivot':'ground centre'})
# Review each silhouette in a spaced asset board.
for name,dx,dy in [('reef_tall',-2,1),('reef_shelf',.4,1.1),('reef_small',2.5,1),('beach_campfire',0,-1.3)]:
 for o in assets[name]:o.location.x+=dx;o.location.y+=dy
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=420;scene.render.resolution_y=420;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Beach_review_world');scene.world.color=(.35,.35,.35);scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.55,.65,.75,1);scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.55
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=550;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=7.3
scene.view_settings.view_transform='AgX'
views={'front':(0,-7,2.4),'side':(7,0,2.4),'top':(0,0,9),'threequarter':(5,-7,5),'rear':(-5,6,4)}
for label,position in views.items():
 cam.location=position;cam.rotation_euler=(Vector((0,0,1.4))-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=os.path.join(OUT,('blockout_' if BLOCK else 'final_')+label+'.png');bpy.ops.render.render(write_still=True)
if not BLOCK:
 scene.view_layers[0].material_override=clay
 scene.render.filepath=os.path.join(OUT,'final_clay.png');bpy.ops.render.render(write_still=True)
 silhouette=material('Review_silhouette',(.003,.003,.003),1)
 scene.view_layers[0].material_override=silhouette
 scene.render.filepath=os.path.join(OUT,'final_silhouette.png');bpy.ops.render.render(write_still=True)
 scene.view_layers[0].material_override=None
 with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'shore_props.blend'))
print('VALIDATED',json.dumps(manifest))

