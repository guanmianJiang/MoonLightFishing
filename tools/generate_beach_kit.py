import bpy, math, os, sys, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets_pipeline','beach-kit'); WEB=os.path.join(ROOT,'dist','assets','models')
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
# The sling runs continuously from front seat rail to the reclined back rail.
start=set(bpy.context.scene.objects)
for x in [-.39,.39]:
 beam((x,-.44,.035),(x,.32,.77),.065,.065,wood,'Cross_leg_front')
 beam((x,.47,.035),(x,-.36,.64),.065,.065,wood,'Cross_leg_rear')
 beam((x,-.32,.39),(x,.55,1.25),.065,.065,wood,'Reclined_side_rail')
 if not BLOCK:
  tube((x-.044,0,.46),(x+.044,0,.46),.038,metal,'Pivot')
for y,z in [(-.36,.63),(.54,1.23),(.38,.17)]:beam((-.40,y,z),(.40,y,z),.055,.055,wood,'Cross_tie')
profile=[(-.36,.65),(-.20,.57),(.02,.52),(.16,.64),(.30,.87),(.52,1.22)]
for stripe in range(9):
 x0=-.35+stripe*.70/9;x1=x0+.70/9
 verts=[(x,y,z) for y,z in profile for x in [x0,x1]]
 surface('Sling_stripe_%02d'%stripe,verts,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(profile)-1)],cream if stripe%2==0 else teal)
assets['beach_deckchair']=list(set(bpy.context.scene.objects)-start)
start=set(bpy.context.scene.objects)
tube((0,0,0),(0,0,2.86),.036,wood,'Parasol_pole')
for panel in range(10):
 verts=[];faces=[]
 for ring in range(9):
  u=ring/8;r=max(.001,u*1.65)
  for seg in range(7):
   v=seg/6;a=(panel+v)*math.tau/10
   z=2.84-.55*u**1.65-.065*math.sin(v*math.pi)*u**1.2
   verts.append((math.cos(a)*r,math.sin(a)*r,z))
 for ring in range(8):
  for seg in range(6):
   i=ring*7+seg;faces.append((i,i+7,i+8,i+1))
 surface('Canopy_gore_%02d'%panel,verts,faces,cream if panel%2==0 else coral)
 if not BLOCK:
  a=panel*math.tau/10
  for k in range(4):
   u=k/4;v=(k+1)/4
   tube((math.cos(a)*u*1.64,math.sin(a)*u*1.64,2.81-.55*u**1.65),(math.cos(a)*v*1.64,math.sin(a)*v*1.64,2.81-.55*v**1.65),.012,wood,'Radial_rib')
  tube((0,0,2.13),(math.cos(a)*.72,math.sin(a)*.72,2.62),.012,wood,'Spreader')
if not BLOCK:tube((0,0,2.07),(0,0,2.21),.065,metal,'Sliding_hub')
assets['beach_parasol']=list(set(bpy.context.scene.objects)-start)
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
# Assembly preview places the chair beside the pole, under the canopy.
for o in assets['beach_deckchair']:o.location.x+=.8;o.location.y-=.25
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=420;scene.render.resolution_y=420;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Beach_review_world');scene.world.color=(.35,.35,.35);scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.55,.65,.75,1);scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.55
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=550;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=4.4
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
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'beach_kit.blend'))
print('VALIDATED',json.dumps(manifest))

