"""Art-directed low-poly angler and articulated gull. Runtime coordinates: Y up."""
import bpy, math, os, sys, json, bmesh
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets_pipeline','angler-gull');WEB=os.path.join(ROOT,'dist','assets','models','angler-gull')
os.makedirs(OUT,exist_ok=True);os.makedirs(WEB,exist_ok=True)
BLOCK='--blockout' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
def v(p):return Vector((p[0],-p[2],p[1]))
def mat(n,c,rough=.8):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;return m
clay=mat('Review_clay',(.48,.48,.48));skin=mat('Warm_skin',(.63,.36,.22));cheek=mat('Cheek',(.70,.30,.22));hair=mat('Chestnut_hair',(.095,.052,.032));ivory=mat('Linen',(.86,.79,.59));teal=mat('Sea_green_coat',(.11,.26,.23));ochre=mat('Ochre_life_vest',(.71,.39,.10));edge=mat('Dark_seams',(.07,.13,.12));pants=mat('Indigo_trousers',(.09,.17,.22));leather=mat('Leather_boots',(.20,.11,.06));brass=mat('Brass',(.64,.43,.17),.45);black=mat('Pupil',(.013,.02,.018));white=mat('Gull_ivory',(.89,.91,.85));grey=mat('Gull_silver',(.44,.54,.56));tips=mat('Charcoal_feathers',(.07,.12,.15));bill=mat('Ochre_beak',(.88,.52,.09))
def finish(o,n,m):o.name=n;o.data.materials.append(clay if BLOCK else m);return o
def oval(n,p,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=v(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,n,m)
def surface(n,points,faces,m):
 me=bpy.data.meshes.new(n);me.from_pydata([v(p) for p in points],[],faces);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,n,m)
def box(n,p,s,m,b=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=v(p));o=bpy.context.object;o.dimensions=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if not BLOCK:
  mod=o.modifiers.new('Soft_tailored_edges','BEVEL');mod.width=b;mod.segments=2;o.modifiers.new('Weighted_normals','WEIGHTED_NORMAL')
 return finish(o,n,m)
def tube(n,points,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*v(co),1)
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);finish(o,n,m);return o
def limb(n,a,b,r1,r2,m):
 a,b=v(a),v(b);bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r2,radius2=r1,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=(a-b).to_track_quat('Z','Y').to_euler();return finish(o,n,m)
def joint(n,p,parent=None):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=v(p);o.parent=parent;return o
def attach(o,parent):o.parent=parent;return o
assets={};before=set(bpy.context.scene.objects)
# A continuous tapered jacket replaces the capsule torso.
rings=[(.26,.21,.155),(.39,.245,.185),(.61,.27,.18),(.73,.235,.15),(.79,.12,.12)]
points=[];faces=[];n=16
for y,rx,rz in rings:
 for j in range(n):
  a=j*math.tau/n;points.append((math.cos(a)*rx,y,math.sin(a)*rz))
for k in range(len(rings)-1):
 for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
faces.extend([tuple(reversed(range(n))),tuple(range((len(rings)-1)*n,len(rings)*n))]);surface('Tailored_jacket',points,faces,teal)
oval('Neck',(0,.805,0),(.092,.115,.09),skin)
oval('Head',(0,1.00,.018),(.205,.225,.181),skin)
# Hair cap and swept locks remain visible under the retained hat.
oval('Hair_cap',(0,1.09,-.035),(.211,.156,.174),hair)
for side in [-1,1]:
 oval('Ear',(side*.201,1.0,.01),(.043,.063,.035),skin)
 oval('Inner_ear',(side*.223,1.0,.033),(.014,.034,.014),cheek)
 oval('Sideburn',(side*.167,1.045,.09),(.038,.081,.035),hair)
 oval('Eye_white',(side*.080,1.025,.178),(.037,.026,.012),ivory)
 oval('Eye',(side*.077,1.023,.189),(.015,.019,.008),black)
 oval('Eye_highlight',(side*.073,1.031,.196),(.005,.006,.004),white)
 tube('Brow',[(side*.049,1.066,.178),(side*.083,1.075,.173),(side*.113,1.065,.16)],.011,hair)
 oval('Cheek',(side*.116,.975,.163),(.035,.018,.006),cheek)
 box('Vest_panel',(side*.142,.535,.165),(.19,.365,.082),ochre,.027)
 box('Vest_pocket',(side*.142,.475,.217),(.145,.12,.037),ivory,.018)
 box('Pocket_flap',(side*.142,.531,.238),(.153,.032,.029),ochre,.008)
 oval('Pocket_stud',(side*.142,.528,.257),(.012,.012,.006),brass)
 tube('Shoulder_strap',[(side*.13,.38,-.196),(side*.14,.61,-.193),(side*.17,.735,-.115),(side*.15,.764,.025),(side*.14,.68,.172)],.022,ivory)
 collar=box('Folded_collar',(side*.074,.749,.122),(.102,.104,.045),ivory,.012);collar.rotation_euler.y=side*.3
 # Seated legs have knees, broad cuffs and boot soles.
 hip=(side*.14,.29,.025);knee=(side*.21,.12,.35);ankle=(side*.22,-.18,.49)
 limb('Trouser_thigh',hip,knee,.125,.112,pants);oval('Bent_knee',knee,(.112,.109,.115),pants);limb('Trouser_shin',knee,ankle,.106,.089,pants)
 limb('Rolled_cuff',(side*.22,-.095,.45),(side*.22,-.17,.48),.108,.104,ivory)
 oval('Boot',(side*.22,-.205,.57),(.103,.096,.19),leather);box('Boot_sole',(side*.22,-.282,.575),(.207,.034,.34),edge,.025)
 for z in [.51,.55,.59]:tube('Boot_lace',[(side*.22-.05,-.13,z),(side*.22+.05,-.13,z)],.007,ivory)
oval('Nose',(0,.988,.196),(.034,.044,.042),skin)
tube('Smile',[(-.050,.934,.17),(-.026,.925,.185),(0,.923,.19),(.035,.931,.18)],.006,hair)
box('Vest_zip',(0,.525,.210),(.023,.34,.024),edge,.006)
# Fitted pocket stitching and a small practical neckerchief.
kerchief=mat('Burnt_coral_kerchief',(.48,.17,.105))
for side in [-1,1]:
 tube('Pocket_stitch',[(side*.142-.056,.495,.239),(side*.142-.056,.437,.239),(side*.142+.056,.437,.239),(side*.142+.056,.495,.239)],.0026,ochre)
 tube('Shoulder_seam',[(side*.12,.746,-.07),(side*.205,.738,.0),(side*.244,.714,.054)],.0035,ivory)
oval('Scarf_knot',(0,.74,.167),(.026,.027,.021),kerchief)
surface('Scarf_tip',[(-.01,.734,.179),(.055,.665,.214),(.072,.701,.20),(.017,.744,.178)],[(0,1,2,3)],kerchief)
box('Hem',(0,.303,0),(.43,.065,.33),edge,.018)
box('Backpack',(0,.49,-.22),(.32,.33,.17),ochre,.07);box('Backpack_flap',(0,.633,-.269),(.34,.095,.12),ivory,.035)
for side in [-1,1]:box('Pack_strap',(side*.10,.49,-.311),(.032,.24,.024),edge,.006);box('Pack_buckle',(side*.10,.46,-.327),(.058,.044,.018),brass,.008)
assets['angler_body']=list(set(bpy.context.scene.objects)-before)
# Authored gull uses +X forward, articulated wing roots and wrists.
before=set(bpy.context.scene.objects)
oval('Gull_body',(0,0,0),(.265,.11,.105),white);oval('Gull_mantle',(-.03,.067,0),(.215,.062,.099),grey)
oval('Gull_neck',(.205,.04,0),(.105,.117,.078),white);oval('Gull_head',(.292,.106,0),(.104,.095,.078),white)
surface('Beak',[(.365,.122,-.022),(.365,.078,-.024),(.482,.086,0),(.365,.078,.024),(.365,.122,.022)],[(0,1,2),(1,3,2),(3,4,2),(4,0,2),(0,4,3,1)],bill)
for side in [-1,1]:
 oval('Gull_eye',(.331,.127,side*.066),(.012,.012,.008),black)
 oval('Eye_glint',(.335,.131,side*.073),(.003,.003,.002),white)
 root=joint('Wing_'+('L' if side==1 else 'R'),(.035,.055,side*.07))
 # Airfoil rings: thick leading edge and a tapered swept trailing edge.
 pts=[]
 sections=[(0,.12,-.18,0),(.30,.15,-.17,.035),(.57,.065,-.22,.035)]
 for z,front,back,y in sections:pts.extend([(front,y,side*z),(back,y-.009,side*z),((front+back)/2,y+.032,side*z)])
 faces=[(0,2,1),(6,7,8)]+[(k*3+j,k*3+(j+1)%3,(k+1)*3+(j+1)%3,(k+1)*3+j) for k in range(2) for j in range(3)]
 attach(surface('Inner_wing',pts,faces,grey),root)
 wrist=joint('Wrist_'+('L' if side==1 else 'R'),(.015,.02,side*.51),root)
 pts=[(.065,.01,0),(-.22,-.01,0),(-.30,-.04,side*.39),(-.20,-.06,side*.70),(-.12,-.025,side*.47),(.005,0,side*.24)]
 o=attach(surface('Outer_wing',pts,[(0,1,2,3,4,5)],grey),wrist);mod=o.modifiers.new('Wing_thickness','SOLIDIFY');mod.thickness=.012
 for j in range(5):
  z=.30+j*.065;x=-.16-j*.018
  pts=[(x+.045,-.012,side*z),(x-.055,-.020,side*(z+.02)),(x-.115,-.038,side*(z+.18)),(x-.064,-.041,side*(z+.22))]
  o=attach(surface('Primary_feather',pts,[(0,1,2,3)],tips),wrist);o.modifiers.new('Feather_thickness','SOLIDIFY').thickness=.007
 for j in range(4):
  z=.13+j*.09
  o=attach(surface('Secondary_feather',[(-.11,.026,side*z),(-.24,.003,side*(z+.025)),(-.23,.005,side*(z+.095)),(-.075,.032,side*(z+.075))],[(0,1,2,3)],white),root);o.modifiers.new('Feather_thickness','SOLIDIFY').thickness=.006
tail=joint('Gull_tail',(-.21,0,0))
for j in range(5):
 z=(j-2)*.042
 o=attach(surface('Tail_feather',[(0,.025,z*.5),(-.23,.018,z-.024),(-.245,.018,z+.021),(-.035,.03,z*.6)],[(0,1,2,3)],white),tail);o.modifiers.new('Feather_thickness','SOLIDIFY').thickness=.008
for side in [-1,1]:tube('Tucked_foot',[(-.14,-.074,side*.047),(-.25,-.065,side*.06),(-.285,-.058,side*.084)],.008,bill)
assets['seagull']=list(set(bpy.context.scene.objects)-before)
manifest={'lane':'Art-directed','units':'metres','character':'static seated body; separate Blender limb skins and keyed runtime motion','assets':[]}
for name,objects in assets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=next(o for o in objects if o.type=='MESH')
 # Curves and modifiers must be baked, while retaining wing empty hierarchy.
 for o in objects:
  if o.type in ['MESH','CURVE']:
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 bpy.ops.object.select_all(action='DESELECT');triangles=0
 for o in objects:
  o.select_set(True)
  if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
 assert triangles<24000,(name,triangles)
 if not BLOCK:bpy.ops.export_scene.gltf(filepath=os.path.join(WEB,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
 manifest['assets'].append({'name':name,'triangles':triangles})
# Presentation-only articulated arms and retained hat, matching runtime joints.
before=set(bpy.context.scene.objects)
for side in [-1,1]:
 shoulder=(side*.23,.70,.02);elbow=(side*.31,.53,.20);hand=(side*.13,.44,.43)
 limb('Preview_sleeve',shoulder,elbow,.092,.079,teal);limb('Preview_forearm',elbow,hand,.062,.054,skin);oval('Preview_hand',hand,(.078,.078,.078),skin)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'dist','assets','models','fishing-details','angler_hat.glb'))
new=list(set(bpy.context.scene.objects)-before)
for o in new:
 if not o.parent and not o.name.startswith('Preview_'):o.location.z+=1.16
assets['angler_body'].extend(new)
# Separate fixed multi-view sheets with equal framing across gates.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.render.resolution_x=680;scene.render.resolution_y=680;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.26,.31,.32,1)
bpy.ops.object.light_add(type='AREA',location=(3,-4,6));bpy.context.object.data.energy=650;bpy.context.object.data.size=5
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
for name,objects in assets.items():
 for key,items in assets.items():
  for o in items:o.hide_render=key!=name
 center=Vector((0,0,.48 if name=='angler_body' else 0));cam.data.ortho_scale=2.0 if name=='angler_body' else 3.4
 for label,p in [('front',(0,-7,1.7)),('side',(7,0,1.7)),('top',(0,0,8)),('threequarter',(4,-7,3.3)),('rear',(-4,7,3.3))]:
  cam.location=p;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(OUT,('blockout_' if BLOCK else 'final_')+name+'_'+label+'.png');bpy.ops.render.render(write_still=True)
for objects in assets.values():
 for o in objects:o.hide_render=False
if not BLOCK:
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'angler_gull.blend'))
 with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
print('VALIDATED',json.dumps(manifest))
