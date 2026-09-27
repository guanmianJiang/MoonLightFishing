import bpy, math, os, sys, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets_pipeline','marine-life'); WEB=os.path.join(ROOT,'dist','assets','models')
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

blue=material('Shark_blue',(.15,.34,.39),.56)
belly=material('Pale_belly',(.59,.70,.66),.7)
gold=material('Reef_gold',(.75,.52,.16),.62)
silver=material('Silver_blue',(.16,.38,.46),.56)
eye=material('Eyes',(.012,.022,.025),.4)
# Longitudinal rings: pointed nose, broad shoulders, tapered caudal peduncle.
# Blender +X forward, exported +X forward; engine supplies a travelling body wave.
for name,shark in [('reef_shark',True),('shoal_fish',False),('silver_fish',False)]:
 start=set(bpy.context.scene.objects);L=2.8 if shark else (.82 if name=='silver_fish' else .65); fishmat=blue if shark else silver if name=='silver_fish' else gold
 rings=[(.50,.015),(.40,.09),(.20,.15),(-.02,.16),(-.24,.10),(-.40,.035),(-.48,.025)]
 verts=[];faces=[]
 for x,r in rings:
  for j in range(10):
   a=j*math.tau/10;verts.append((x*L,math.cos(a)*r*L*(.65 if name=='silver_fish' else 1),math.sin(a)*r*L*(.60 if name=='silver_fish' else 1.15 if not shark else .85)))
 for k in range(len(rings)-1):
  for j in range(10):faces.append((k*10+j,(k+1)*10+j,(k+1)*10+(j+1)%10,k*10+(j+1)%10))
 faces.extend([tuple(reversed(range(10))),tuple(range(60,70))])
 o=surface(name+'_body',verts,faces,fishmat,0);o.data.materials.append(belly)
 for p in o.data.polygons:
  if sum(o.data.vertices[v].co.z for v in p.vertices)/len(p.vertices)<-.04*L:p.material_index=1
 def fin(label,points):
  # A slim closed wedge catches light on both sides.
  vs=[(x*L,y*L+side*.006*L,z*L) for side in [-1,1] for x,y,z in points]
  return surface(label,vs,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],fishmat,0)
 fin('Dorsal',[(.08,0,.12),(-.04,0,.29),(-.18,0,.12)])
 for side in [-1,1]:fin('Pectoral',[(.12,side*.10,-.03),(-.23,side*.34,-.07),(-.10,side*.10,-.08)])
 fin('Tail_upper',[(-.43,0,0),(-.64,0,.26),(-.58,0,.015)])
 fin('Tail_lower',[(-.43,0,0),(-.58,0,.015),(-.61,0,-.19)])
 for side in [-1,1]:
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=L*.012,location=(L*.34,side*L*.087,L*.035));finish(bpy.context.object,'Eye',eye)
 assets[name]=list(set(bpy.context.scene.objects)-start)
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
 manifest['assets'].append({'name':name,'triangles':triangles,'pivot':'body centre'})
for o in assets['shoal_fish']:o.location.y-=1.0
for o in assets['silver_fish']:o.location.y-=1.65
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=420;scene.render.resolution_y=420;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Beach_review_world');scene.world.color=(.35,.35,.35);scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.55,.65,.75,1);scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.55
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=550;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=4.4
scene.view_settings.view_transform='AgX'
views={'front':(0,-7,2.4),'side':(7,0,2.4),'top':(0,0,9),'threequarter':(5,-7,5),'rear':(-5,6,4)}
for label,position in views.items():
 cam.location=position;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=os.path.join(OUT,('blockout_' if BLOCK else 'final_')+label+'.png');bpy.ops.render.render(write_still=True)
if not BLOCK:
 scene.view_layers[0].material_override=clay
 scene.render.filepath=os.path.join(OUT,'final_clay.png');bpy.ops.render.render(write_still=True)
 silhouette=material('Review_silhouette',(.003,.003,.003),1)
 scene.view_layers[0].material_override=silhouette
 scene.render.filepath=os.path.join(OUT,'final_silhouette.png');bpy.ops.render.render(write_still=True)
 scene.view_layers[0].material_override=None
 with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'marine_life.blend'))
print('VALIDATED',json.dumps(manifest))

