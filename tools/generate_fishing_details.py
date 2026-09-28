"""Deterministic palette-based fishing props; Blender 5, metres, glTF Y-up."""
import bpy, math, os, sys, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets_pipeline','fishing-details')
WEB=os.path.join(ROOT,'public','assets','models','fishing-details')
os.makedirs(OUT,exist_ok=True);os.makedirs(WEB,exist_ok=True)
BLOCK='--blockout' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(n,c,metal=0,glow=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=next((node for node in m.node_tree.nodes if node.type=='BSDF_PRINCIPLED'),None) or m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');output=next((node for node in m.node_tree.nodes if node.type=='OUTPUT_MATERIAL'),None) or m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(p.outputs['BSDF'],output.inputs['Surface']);p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.65;p.inputs['Metallic'].default_value=metal;p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=glow;return m
teal=mat('Seafoam_enamel',(.12,.36,.33));cream=mat('Warm_canvas',(.78,.68,.45));dark=mat('Deep_forest',(.045,.105,.10));brass=mat('Aged_brass',(.58,.36,.12),.65);wood=mat('Cedar',(.36,.18,.075));gold=mat('Wheat',(.92,.57,.12));rose=mat('Worm_rose',(.49,.16,.115));mint=mat('Firefly_light',(.48,.95,.37),0,1.5);wing=mat('Wing_pearl',(.66,.82,.65));clay=mat('Review_clay',(.46,.46,.46))
assets={}
def finish(o,n,m):
 o.name=n;o.data.materials.append(clay if BLOCK else m);return o
def cube(n,p,s,m,bevel=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel and not BLOCK:
  mod=o.modifiers.new('Rounded_edges','BEVEL');mod.width=bevel;mod.segments=2;o.modifiers.new('Normals','WEIGHTED_NORMAL')
 return finish(o,n,m)
def oval(n,p,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,n,m)
def tube(n,points,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=r;c.bevel_resolution=1;c.resolution_u=8
 sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*co,1)
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);finish(o,n,m);return o
def ring(n,p,major,minor,m):
 bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,location=p,major_radius=major,minor_radius=minor);return finish(bpy.context.object,n,m)
def collect(n,fn):
 before=set(bpy.context.scene.objects);fn();assets[n]=list(set(bpy.context.scene.objects)-before)
def tackle():
 cube('Box_shell',(0,0,.20),(.78,.46,.36),teal,.045);cube('Lid',(0,0,.405),(.81,.49,.07),cream)
 for x in [-.24,.24]:cube('Brass_latch',(x,-.245,.34),(.08,.025,.13),brass,.008)
 tube('Carry_handle',[(-.15,0,.45),(-.15,0,.57),(.15,0,.57),(.15,0,.45)],.022,dark)
 for x in [-.29,.29]:cube('Foot',(x,0,.035),(.11,.36,.07),dark,.015)
 cube('Badge',(0,-.24,.23),(.19,.014,.09),cream,.008)
collect('tackle_box',tackle)
def stool():
 for x in [-.23,.23]:
  for y in [-.23,.23]:tube('Splayed_leg',[(x,y,0),(x*.74,y*.74,.53)],.035,wood)
 cube('Seat',(0,0,.55),(.57,.49,.065),wood)
 for y in [-.17,0,.17]:cube('Canvas_band',(0,y,.587),(.55,.07,.008),cream,.002)
collect('field_stool',stool)
def bucket():
 verts=[];faces=[];n=24
 for z,r in [(0,.17),(.39,.225),(.39,.205),(.035,.155)]:
  verts += [(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z) for i in range(n)]
 for k in range(3):
  for i in range(n):faces.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
 faces.extend([tuple(reversed(range(n))),tuple(range(3*n,4*n))]);me=bpy.data.meshes.new('Hollow_bucket');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Hollow_bucket',me);bpy.context.collection.objects.link(o);finish(o,'Hollow_bucket',teal)
 ring('Rolled_rim',(0,0,.39),.216,.014,brass)
 tube('Swing_handle',[(.22*math.cos(i*math.pi/20),0,.39+.27*math.sin(i*math.pi/20)) for i in range(21)],.013,brass)
 tube('Wood_grip',[(-.075,0,.65),(.075,0,.65)],.026,wood)
collect('bait_bucket',bucket)
def hat():
 # Shape follows the existing head; local origin is the brim centre.
 oval('Soft_brim',(0,0,0),(.385,.34,.027),cream)
 bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.24,radius2=.185,depth=.16,location=(0,0,.095));finish(bpy.context.object,'Crown',cream)
 bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.243,radius2=.228,depth=.045,location=(0,0,.039));finish(bpy.context.object,'Hatband',teal)
 cube('Band_buckle',(.025,-.235,.04),(.075,.015,.042),brass,.004)
collect('angler_hat',hat)
def bait(n):
 # Attachment eye is at the origin, bait hangs below it.
 tube('Hook',[(0,0,0),(0,0,-.11),(.01,0,-.155),(.047,0,-.164),(.067,0,-.14),(.065,0,-.11)],.0045,brass)
 if n=='grain':
  for x,y,z,a in [(.018,0,-.07,.3),(.055,0,-.10,-.3),(.028,.025,-.12,.6)]:
   o=oval('Wheat_kernel',(x,y,z),(.023,.021,.035),gold);o.rotation_euler.y=a
   tube('Kernel_crease',[(x,y-.02,z-.018),(x+.004,y-.022,z),(x,y-.02,z+.019)],.0018,cream)
  tube('Grain_stem',[(.008,0,-.038),(.03,0,-.055),(.049,0,-.088)],.0028,wood)
  oval('Husk_tip',(.019,-.004,-.038),(.014,.009,.022),cream)
 elif n=='worm':
  points=[(.025+.029*math.sin(i*.58),.01*math.cos(i*.5),-.035-i*.011) for i in range(16)]
  tube('Curved_worm',points,.014,rose)
  for i in range(2,15,2):oval('Worm_segment',points[i],(.0155,.0155,.007),rose)
  oval('Clitellum',points[8],(.018,.018,.015),cream)
 else:
  oval('Glow_abdomen',(.028,0,-.105),(.025,.026,.042),mint);oval('Thorax',(.028,0,-.055),(.023,.025,.023),dark)
  for z in [-.087,-.113,-.137]:
   bpy.ops.mesh.primitive_torus_add(major_segments=10,minor_segments=3,location=(.028,0,z),major_radius=.022,minor_radius=.0018);finish(bpy.context.object,'Abdomen_band',dark)
  for side in [-1,1]:
   o=oval('Wing',(.028+side*.029,.012,-.065),(.025,.009,.045),wing);o.rotation_euler.y=side*.45
   tube('Wing_vein',[(.028+side*.01,.020,-.045),(.028+side*.025,.019,-.07),(.028+side*.041,.013,-.091)],.0015,teal)
   tube('Antenna',[(.028+side*.01,0,-.035),(.028+side*.027,0,-.012)],.0025,brass)
for n in ['grain','worm','glow']:collect('bait_'+n,lambda n=n:bait(n))
manifest={'lane':'Art-directed','units':'metres','materials':'palette PBR, no baked textures','baitHookAnchor':'HookAnchor','assets':[]}
for n,objects in assets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 objects=list(bpy.context.selected_objects);assets[n]=objects
 if n in ['bait_grain','bait_worm','bait_glow']:
  hook_anchor=bpy.data.objects.new('HookAnchor',None);bpy.context.collection.objects.link(hook_anchor);hook_anchor.location=(.047,0,-.164);hook_anchor.select_set(True);objects.append(hook_anchor)
 import bmesh
 tris=0
 for o in objects:
  if o.type!='MESH':continue
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
 assert tris<12000,(n,tris)
 if not BLOCK:bpy.ops.export_scene.gltf(filepath=os.path.join(WEB,n+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
 if n in ['bait_grain','bait_worm','bait_glow']:hook_anchor.name=n+'_HookAnchor'
 manifest['assets'].append({'name':n,'triangles':tris})
# Review grid with baits enlarged for shape inspection.
for i,(n,objects) in enumerate(assets.items()):
 parent=bpy.data.objects.new(n+'_display',None);bpy.context.collection.objects.link(parent)
 for o in objects:o.parent=parent
 parent.location=((i%4-1.5)*1.55,(i//4)*1.65,0)
 if n in ['bait_grain','bait_worm','bait_glow']:parent.scale=(5,5,5);parent.location.z=.9
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1100;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True
background=next((node for node in scene.world.node_tree.nodes if node.type=='BACKGROUND'),None) or scene.world.node_tree.nodes.new('ShaderNodeBackground')
world_output=next((node for node in scene.world.node_tree.nodes if node.type=='OUTPUT_WORLD'),None) or scene.world.node_tree.nodes.new('ShaderNodeOutputWorld')
scene.world.node_tree.links.new(background.outputs['Background'],world_output.inputs['Surface'])
background.inputs[0].default_value=(.23,.28,.29,1)
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=650;bpy.context.object.data.size=5
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=7.5
views={'threequarter':(5,-8,7),'front':(0,-10,1),'side':(10,0,1),'top':(0,0,11),'rear':(-5,8,7)}
for view,p in views.items():
 cam.location=p;cam.rotation_euler=(Vector((0,.65,.3))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(OUT,('blockout_' if BLOCK else 'final_')+view+'.png');bpy.ops.render.render(write_still=True)
if not BLOCK:
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'fishing_details.blend'))
 with open(os.path.join(OUT,'manifest.json'),'w',newline='\n') as f:json.dump(manifest,f,indent=2);f.write('\n')
 # Transparent UI icons use the exact in-game models, without the review layout.
 scene.render.film_transparent=True;scene.render.resolution_x=240;scene.render.resolution_y=240;cam.data.ortho_scale=.25
 for n in ['bait_grain','bait_worm','bait_glow']:
  for key,objects in assets.items():
   for o in objects:o.hide_render=key!=n
  parent=assets[n][0].parent;parent.location=(0,0,0);parent.scale=(1,1,1)
  cam.location=(.21,-.6,.15);cam.rotation_euler=(Vector((.028,0,-.09))-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=os.path.join(WEB,n+'.png');bpy.ops.render.render(write_still=True)
print('VALIDATED',json.dumps(manifest))
