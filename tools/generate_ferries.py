import bpy, math, os, json
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets_pipeline','distant-ferries');WEB=os.path.join(ROOT,'dist','assets','models')
os.makedirs(OUT,exist_ok=True);os.makedirs(WEB,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name,color,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
hull=mat('Warm_hull',(.74,.68,.52),.75);teal=mat('Seafoam_band',(.16,.39,.40),.68);window=mat('Cabin_glass',(.12,.30,.34),.3);roof=mat('Cabin_cream',(.86,.80,.64),.8);accent=mat('Safety_orange',(.72,.28,.11),.62);dark=mat('Mast_dark',(.19,.22,.20),.8)

def cube(name,loc,scale,material,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  b=o.modifiers.new('Soft ferry edge','BEVEL');b.width=bevel;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def mesh(name,verts,faces,material):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(material);return o
def rod(a,b,r,material):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.name='Ferry_detail';o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(material);return o

def ferry(name,scale=1,cruise=False):
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)
 # faceted pointed hull, +X bow
 stretch=1.28 if cruise else 1.06
 verts=[(x*stretch,y,z) for x,y,z in [(-2.2,-.55,0),(-2.2,.55,0),(-1.75,-.72,.30),(-1.75,.72,.30),(1.75,-.64,.30),(1.75,.64,.30),(2.35,-.28,.36),(2.35,.28,.36),(-1.55,-.5,.72),(-1.55,.5,.72),(1.55,-.45,.68),(1.55,.45,.68)]]
 faces=[(0,2,4,6,7,5,3,1),(0,1,3,9,8,2),(2,8,10,4),(4,10,11,5),(5,11,9,3),(6,4,5,7),(8,9,11,10)]
 h=mesh('Ferry_hull',verts,faces,hull);h.parent=root
 band=cube('Waterline_band',(0,0,.42),(4.45 if cruise else 3.85,1.28,.14),teal,.02);band.parent=root
 # A long saloon, a stepped sky deck, and a raised bridge read as a liner at range.
 cabin=cube('Passenger_cabin',(-.28,0,1.0),(2.95 if cruise else 2.28,1.05,.62),roof,.055);cabin.parent=root
 for side in [-1,1]:
  for i in range(9 if cruise else 7):
   w=cube('Cabin_window',(-1.45+i*.30 if cruise else -.98+i*.28,side*.535,1.06),(.22,.018,.21),window,.008);w.parent=root
 upper=cube('Sky_deck',(-.28 if cruise else .22,0,1.48),(2.2 if cruise else 1.45,.94,.14),teal,.025);upper.parent=root
 lounge=cube('Upper_lounge',(-.12 if cruise else .30,0,1.72),(1.8 if cruise else 1.20,.77,.36),roof,.05);lounge.parent=root
 canopy=cube('Sun_deck_canopy',(-.10 if cruise else .30,0,1.96),(2.02 if cruise else 1.35,.86,.10),roof,.028);canopy.parent=root
 for side in [-1,1]:
  for i in range(5 if cruise else 3):
   w=cube('Upper_window',(-.82+i*.35 if cruise else -.02+i*.34,side*.392,1.74),(.26,.016,.16),window,.004);w.parent=root
  boat=cube('Lifeboat',(-1.5 if cruise else -.95,side*.64,1.47),(.68 if cruise else .5,.16,.19),accent,.065);boat.parent=root
  rail_y=side*.49
  rod((-1.2 if cruise else -.52,rail_y,1.72),(.9,rail_y,1.72),.018,dark).parent=root
  for i in range(5):
   x=(-1.2 if cruise else -.52)+i*(2.1 if cruise else 1.42)/4
   rod((x,rail_y,1.55),(x,rail_y,1.72),.012,dark).parent=root
 if cruise:
  bridge=cube('Forward_bridge',(1.06,0,1.75),(.94,.79,.30),roof,.045);bridge.parent=root
  for side in [-1,1]:cube('Bridge_glass',(1.16,side*.40,1.78),(.60,.018,.14),window,.006).parent=root
  cube('Bridge_visor',(1.07,0,1.94),(1.07,.87,.08),roof,.02).parent=root
 funnel=cube('Cruise_funnel',(-.88 if cruise else -.5,0,2.18),(.34,.29,.39),accent,.04);funnel.parent=root
 cube('Funnel_cap',(-.88 if cruise else -.5,0,2.39),(.43,.37,.09),dark,.018).parent=root
 rod((1.26,0,1.96),(1.26,0,2.45),.022,dark).parent=root
 cube('Navigation_light',(1.26,0,2.47),(.09,.09,.11),accent,.01).parent=root
 for x in [-1.95,-1.52,1.58]:
  for side in [-1,1]:cube('Safety_mark',(x,side*.656,.58),(.16,.012,.12),accent,.004).parent=root
 root.scale=(scale,scale,scale)
 return root

assets=[]
for name,scale,cruise in [('passenger_ferry_a',1,True),('passenger_ferry_b',.82,False)]:
 root=ferry(name,scale,cruise);assets.append(root)
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=os.path.join(WEB,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True)

scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1100;scene.render.resolution_y=550;scene.render.resolution_percentage=100;scene.world=bpy.data.worlds.new('Ferry_review');scene.world.color=(.38,.55,.58)
bpy.ops.object.light_add(type='AREA',location=(-4,-5,8));bpy.context.object.data.energy=750;bpy.context.object.data.size=6
bpy.ops.object.camera_add(location=(7,-14,5.5));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=11;cam.rotation_euler=(Vector((0,0,.7))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
for i,o in enumerate(assets):o.location=(i*6.1-3.05,0,0)
scene.render.filepath=os.path.join(OUT,'ferries_contact.png');bpy.ops.render.render(write_still=True)
manifest={'lane':'Art-directed','units':'metres','assets':[{'name':'passenger_ferry_a','role':'distant cruise ship','scale':1},{'name':'passenger_ferry_b','role':'distant excursion ship','scale':.82}],'pivot':'body centre','axis':'+X bow forward','texture_policy':'embedded palette PBR'}
with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'distant_ferries.blend'))
print('VALIDATED',json.dumps(manifest))
