import bpy, math, os, json, sys
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets_pipeline','specimens')
WEB=os.path.join(ROOT,'public','assets','models','specimens')
os.makedirs(OUT,exist_ok=True);os.makedirs(WEB,exist_ok=True)
BLOCK='--blockout' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name,color,rough=.58,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) or m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
 output=next((n for n in m.node_tree.nodes if n.type=='OUTPUT_MATERIAL'),None) or m.node_tree.nodes.new('ShaderNodeOutputMaterial')
 m.node_tree.links.new(p.outputs['BSDF'],output.inputs['Surface'])
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m

silver=mat('Scale_silver',(.36,.55,.55),.34,.08); pale=mat('Belly_pearl',(.72,.78,.68),.45)
blue=mat('Moon_blue',(.32,.68,.72),.3,.06); gold=mat('Old_gold',(.82,.49,.10),.4,.04)
olive=mat('Perch_olive',(.29,.43,.22),.55); red=mat('Fin_red',(.72,.22,.11),.48)
dark=mat('Dark_mark',(.08,.14,.12),.62); cat=mat('Catfish_skin',(.22,.34,.31),.72)
coral=mat('Shrimp_shell',(.80,.37,.25),.42); shell=mat('Shrimp_highlight',(1,.62,.42),.36)
eye=mat('Eye',(.008,.012,.011),.25); fin_silver=mat('Silver_fin',(.43,.66,.64),.52)

def surface(name,verts,faces,material):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(material);return ob

def body(name,length,height,width,material,belly_mat,head=.43):
 rings=[(.52,.02),(.43,.44),(.20,.82),(-.08,1),(-.31,.73),(-.47,.20)]
 verts=[];faces=[];sides=10
 for x,r in rings:
  for j in range(sides):
   a=j*math.tau/sides;verts.append((x*length,math.cos(a)*width*r,math.sin(a)*height*r*(1.08 if x>head else 1)))
 for i in range(len(rings)-1):
  for j in range(sides):faces.append((i*sides+j,(i+1)*sides+j,(i+1)*sides+(j+1)%sides,i*sides+(j+1)%sides))
 faces.extend([tuple(reversed(range(sides))),tuple(range((len(rings)-1)*sides,len(rings)*sides))])
 ob=surface(name,verts,faces,material);ob.data.materials.append(belly_mat)
 for f in ob.data.polygons:
  if sum(ob.data.vertices[v].co.z for v in f.vertices)/len(f.vertices)<-.04:f.material_index=1
 return ob

def fin(name,points,material,parent=None):
 thickness=.008;verts=[(x,y-thickness,z) for x,y,z in points]+[(x,y+thickness,z) for x,y,z in points]
 faces=[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)];ob=surface(name,verts,faces,material)
 if parent:ob.parent=parent
 return ob

def eyes(length,width,height):
 out=[]
 for side in [-1,1]:
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.032*length,location=(length*.36,side*width*.82,height*.25));o=bpy.context.object;o.name='Eye';o.data.materials.append(eye);out.append(o)
 return out

def fish(spec):
 name,L,H,W,base,bell,finmat=spec;start=set(bpy.context.scene.objects);root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)
 b=body(name+'_Body',L,H,W,base,bell);b.parent=root
 mouth=bpy.data.objects.new(name+'_MouthAnchor',None);bpy.context.collection.objects.link(mouth);mouth.parent=root;mouth.location=(L*.52,0,-H*.055)
 tail=bpy.data.objects.new(name+'_Tail',None);bpy.context.collection.objects.link(tail);tail.parent=root;tail.location.x=-L*.47
 fork=1.05 if name=='minnow' else .85 if name=='moon' else .95
 fin('TailFin',[(0,0,0),(-L*.32,0,H*fork),(-L*.22,0,0)],finmat,tail);fin('TailFinLower',[(0,0,0),(-L*.22,0,0),(-L*.32,0,-H*fork)],finmat,tail)
 dorsal=H*(1.65 if name in ['perch','moon'] else 1.40);fin('Dorsal',[(-L*.28,0,H*.65),(-L*.10,0,dorsal),(L*.22,0,H*.82)],finmat,root)
 fin('Anal_fin',[(-L*.10,0,-H*.82),(-L*.31,0,-H*1.28),(-L*.34,0,-H*.56)],finmat,root)
 # Fitted gill plates and layered irises follow the body surface.
 for side in [-1,1]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=(L*.24,side*W*.65,H*.10));o=bpy.context.object;o.name='Gill_plate';o.scale=(L*.085,W*.10,H*.48);o.data.materials.append(base);o.parent=root
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=(L*.36,side*W*.86,H*.25));o=bpy.context.object;o.name='Iris_rim';o.scale=(L*.040,L*.014,L*.040);o.data.materials.append(gold if name!='moon' else blue);o.parent=root
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=L*.009,location=(L*.369,side*(W*.86+L*.015),H*.28));o=bpy.context.object;o.name='Eye_glint';o.data.materials.append(pale);o.parent=root
 for side in [-1,1]:fin('Pectoral',[(L*.12,side*W*.72,-H*.08),(-L*.10,side*W*1.75,-H*.24),(-L*.20,side*W*.65,-H*.18)],finmat,root)
 for o in eyes(L,W,H):o.parent=root
 # Species-specific marks are real geometry so they remain readable in thumbnails.
 if name=='perch':
  for i in range(4):
   x=L*(.16-i*.14)
   for side in [-1,1]:
    # A tapered band hugs the oval cross section instead of floating beside it.
    r=.86 if i==0 else .98 if i<3 else .81
    points=[]
    for j in range(7):
     a=-.55+j*.21;z=math.sin(a)*H*r;y=side*math.cos(a)*W*r*1.016
     points.extend([(x-L*.022,y,z),(x+L*.022,y,z)])
    o=surface('Perch_bar',points,[(j*2,j*2+1,j*2+3,j*2+2) for j in range(6)],dark);o.parent=root
 if name=='minnow':
  for side in [-1,1]:
   bpy.ops.mesh.primitive_cube_add(size=1,location=(0,side*W*1.01,0));o=bpy.context.object;o.name='Lateral_stripe';o.dimensions=(L*.72,.008,H*.075);o.data.materials.append(blue);o.parent=root
 if name=='catfish':
  for side in [-1,1]:
   for dz in [-.08,.04]:
    curve=bpy.data.curves.new('Whisker','CURVE');curve.dimensions='3D';curve.bevel_depth=.007;curve.materials.append(cat);sp=curve.splines.new('POLY');sp.points.add(2)
    for p,co in zip(sp.points,[(L*.42,side*W*.72,dz,1),(L*.64,side*W*1.25,dz-.04,1),(L*.78,side*W*1.65,dz-.1,1)]):p.co=co
    o=bpy.data.objects.new('Whisker',curve);bpy.context.collection.objects.link(o);o.parent=root
 if name=='oldgold':
  # Remove one lobe to give the legendary fish its broken-tail silhouette.
  for o in list(tail.children):
   if o.name.startswith('TailFinLower'):bpy.data.objects.remove(o,do_unlink=True)
 if name=='moon':
  fin('Ventral_crescent',[(L*.10,0,-H*.72),(-L*.13,0,-H*1.10),(-L*.31,0,-H*.56)],blue,root)
 return root,list(set(bpy.context.scene.objects)-start)

specs=[
 ('carp',1.65,.40,.28,silver,pale,mat('Carp_fin',(.68,.40,.20),.52)),
 ('minnow',1.55,.22,.16,silver,pale,fin_silver),
 ('perch',1.55,.39,.25,olive,pale,red),
 ('catfish',1.78,.30,.31,cat,pale,cat),
 ('oldgold',1.82,.48,.32,gold,pale,mat('Gold_fin',(.62,.25,.05),.48)),
 ('moon',1.50,.58,.18,silver,pale,blue),
]
assets={}
for spec in specs:
 root,objects=fish(spec);assets[spec[0]]=objects

# Segmented shrimp with separate fan, legs, eyes, and antennae.
start=set(bpy.context.scene.objects);root=bpy.data.objects.new('shrimp',None);bpy.context.collection.objects.link(root)
mouth=bpy.data.objects.new('shrimp_MouthAnchor',None);bpy.context.collection.objects.link(mouth);mouth.parent=root;mouth.location=(.65,0,-.035)
for i in range(7):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(.48-i*.16,0,.05+math.sin(i*.23)*.08));o=bpy.context.object;o.name='Shell_segment';o.scale=(.18,.19-i*.008,.16-i*.008);o.data.materials.append(coral if i%2 else shell);o.parent=root
tail=bpy.data.objects.new('shrimp_Tail',None);bpy.context.collection.objects.link(tail);tail.parent=root;tail.location=(-.63,0,.08)
for side in [-1,0,1]:fin('Tail_fan',[(0,0,0),(-.34,side*.20,.17),(-.30,side*.24,-.11)],coral,tail)
for side in [-1,1]:
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.045,location=(.61,side*.13,.17));o=bpy.context.object;o.name='Eye';o.data.materials.append(eye);o.parent=root
 for i in range(5):fin('Leg',[(.3-i*.14,side*.1,0),(.18-i*.14,side*.40,-.25),(.08-i*.14,side*.34,-.31)],coral,root)
 curve=bpy.data.curves.new('Antenna','CURVE');curve.dimensions='3D';curve.bevel_depth=.006;curve.materials.append(coral);sp=curve.splines.new('POLY');sp.points.add(3)
 for p,co in zip(sp.points,[(.55,side*.1,.12,1),(.85,side*.25,.28,1),(1.15,side*.42,.36,1),(1.48,side*.50,.28,1)]):p.co=co
 o=bpy.data.objects.new('Antenna',curve);bpy.context.collection.objects.link(o);o.parent=root
assets['shrimp']=list(set(bpy.context.scene.objects)-start)

manifest={'lane':'Art-directed','units':'normalized','assets':[],'orientation':'+X nose forward','pivot':'body centre','mouthAnchor':'MouthAnchor'}
for name,objects in assets.items():
 mouth_anchor=next(o for o in objects if o.name==name+'_MouthAnchor');mouth_anchor.name='MouthAnchor'
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 roots=[o for o in objects if o.parent is None];bpy.context.view_layer.objects.active=roots[0]
 # Recalculate closed-mesh normals; ring winding must not invert body lighting.
 for o in objects:
  if o.type=='MESH':
   import bmesh
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 if not BLOCK:bpy.ops.export_scene.gltf(filepath=os.path.join(WEB,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
 mouth_anchor.name=name+'_MouthAnchor'
 triangles=0
 for o in objects:
  if o.type=='MESH':
   me=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh();me.calc_loop_triangles();triangles+=len(me.loop_triangles)
 assert triangles<6000,(name,triangles);manifest['assets'].append({'name':name,'triangles':triangles})

# Fixed review board.
for i,(name,objects) in enumerate(assets.items()):
 x=(i%4-1.5)*2.5;z=(1-i//4)*1.6
 for o in objects:
  if o.parent is None:o.location.x+=x;o.location.z+=z
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1100;scene.render.resolution_y=620;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Review');scene.world.color=(.15,.17,.18);bpy.ops.object.light_add(type='AREA',location=(-4,-5,8));bpy.context.object.data.energy=900;bpy.context.object.data.size=5
bpy.ops.object.camera_add(location=(0,-13,6));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=11.4;scene.camera=cam
if BLOCK:
 clay=mat('Clay_review',(.5,.5,.5))
 scene.view_layers[0].material_override=clay
scene.render.filepath=os.path.join(OUT,'blockout_v2.png' if BLOCK else 'specimens_contact.png');bpy.ops.render.render(write_still=True)
if not BLOCK:bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'specimens.blend'))
if not BLOCK:
 scene.render.film_transparent=True;scene.render.resolution_x=480;scene.render.resolution_y=300;cam.data.ortho_scale=3.1
 for name,objects in assets.items():
  for key,other in assets.items():
   for o in other:o.hide_render=key!=name
  root=next(o for o in objects if o.parent is None);root.location=(0,0,0)
  cam.location=(.15,-6,1.5);cam.rotation_euler=(Vector((-.10,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=os.path.join(WEB,name+'.png');bpy.ops.render.render(write_still=True)
with open(os.path.join(OUT,'manifest.json'),'w',newline='\n') as f:json.dump(manifest,f,indent=2);f.write('\n')
print('VALIDATED',json.dumps(manifest))
