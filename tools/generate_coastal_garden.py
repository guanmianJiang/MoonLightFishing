"""Low-poly coastal vegetation, driftwood and shells with batched material meshes."""
import bpy, math, random, os, sys, json, bmesh
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets_pipeline','coastal-garden');WEB=os.path.join(ROOT,'dist','assets','models','coastal-garden')
os.makedirs(OUT,exist_ok=True);os.makedirs(WEB,exist_ok=True)
BLOCK='--blockout' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True);rng=random.Random(731)
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.86;return m
green=mat('Leaf_sage',(.21,.37,.16));light=mat('Leaf_sunlit',(.40,.54,.23));dark=mat('Leaf_shadow',(.105,.24,.13));straw=mat('Sea_oat_heads',(.70,.52,.23));wood=mat('Salt_bleached_wood',(.57,.43,.28));end=mat('End_grain',(.34,.24,.135));petal=mat('Petal_ivory',(.93,.87,.71));amber=mat('Flower_amber',(.92,.48,.10));rose=mat('Shell_rose',(.69,.39,.29));clay=mat('Review_clay',(.48,.48,.48))
def finish(o,n,m):o.name=n;o.data.materials.append(clay if BLOCK else m);return o
def mesh(n,vs,fs,m):
 me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,n,m)
def oval(n,p,s,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=p);o=bpy.context.object;o.scale=s;return finish(o,n,m)
def stem(n,points,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=0;sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*co,1)
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);finish(o,n,m);return o
def leaf(n,origin,a,length,width,rise,m):
 vs=[]
 for i in range(6):
  u=i/5;d=length*u;w=width*math.sin(math.pi*u);z=rise*math.sin(u*math.pi*.75)
  for side in [-1,0,1]:vs.append((origin[0]+math.cos(a)*d-math.sin(a)*w*side,origin[1]+math.sin(a)*d+math.cos(a)*w*side,origin[2]+z+(.025*math.sin(math.pi*u) if side==0 else 0)))
 o=mesh(n,vs,[(i*3+j,i*3+j+1,(i+1)*3+j+1,(i+1)*3+j) for i in range(5) for j in range(2)],m);o.modifiers.new('Leaf_thickness','SOLIDIFY').thickness=.004
 return o
assets={}
before=set(bpy.context.scene.objects)
for i in range(19):
 a=i*2.4;l=rng.uniform(.28,.57);leaf('Grass_blade',(rng.uniform(-.12,.12),rng.uniform(-.12,.12),0),a,l,.022,rng.uniform(.22,.44),light if i%3==0 else green)
for i in range(5):
 x,y=rng.uniform(-.14,.14),rng.uniform(-.14,.14);h=rng.uniform(.60,.84);stem('Oat_stem',[(x,y,0),(x+.05,y,h*.6),(x+.14,y+.03,h)],.006,straw)
 for j in range(5):oval('Oat_seed',(x+.14+(.025 if j%2 else -.025),y+.03,h-j*.034),(.027,.016,.038),straw)
assets['dune_grass']=list(set(bpy.context.scene.objects)-before)
before=set(bpy.context.scene.objects)
for i in range(23):
 a=i*2.4;z=.025+(i%4)*.047;leaf('Sea_purslane',(0,0,z),a,rng.uniform(.24,.44),rng.uniform(.085,.13),rng.uniform(.04,.13),[green,light,dark][i%3])
for i in range(6):
 a=i*2.399;r=.08+(i%3)*.085;x,y=math.cos(a)*r,math.sin(a)*r;z=.30+(i%3)*.07
 stem('Flower_stem',[(x*.5,y*.5,.08),(x,y,z)],.008,green)
 for j in range(5):
  ang=j*math.tau/5;o=oval('Flower_petal',(x+math.cos(ang)*.055,y+math.sin(ang)*.055,z),(.046,.032,.018),petal);o.rotation_euler.z=ang
 oval('Flower_centre',(x,y,z+.013),(.029,.029,.018),amber)
assets['beach_bloom']=list(set(bpy.context.scene.objects)-before)
before=set(bpy.context.scene.objects)
def branch(points,radius):
 vs=[];n=9
 for k,p in enumerate(points):
  tangent=Vector(points[min(k+1,len(points)-1)])-Vector(points[max(k-1,0)]);tangent.normalize();axis=tangent.cross(Vector((0,0,1))).normalized();other=tangent.cross(axis).normalized();r=radius*(1-k/(len(points)+.3)*.7)
  for j in range(n):
   a=j*math.tau/n;v=Vector(p)+axis*math.cos(a)*r+other*math.sin(a)*r;vs.append(tuple(v))
 fs=[tuple(reversed(range(n))),tuple(range((len(points)-1)*n,len(points)*n))]+[(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(len(points)-1) for j in range(n)]
 o=mesh('Weathered_branch',vs,fs,wood);o.data.materials.append(clay if BLOCK else end);o.data.polygons[0].material_index=1;o.data.polygons[1].material_index=1
branch([(-.76,0,.12),(-.42,.03,.15),(0,0,.13),(.38,-.08,.16),(.81,-.05,.20)],.105)
branch([(-.10,0,.12),(-.03,.17,.16),(.21,.36,.23),(.38,.42,.20)],.059)
branch([(-.38,.03,.14),(-.50,-.12,.18),(-.56,-.26,.23)],.048)
for i in [-1,1]:stem('Long_grain',[(-.63,i*.055,.18),(-.29,i*.04,.215),(.12,i*.03,.20),(.58,-.02+i*.035,.235)],.006,end)
assets['driftwood']=list(set(bpy.context.scene.objects)-before)
before=set(bpy.context.scene.objects)
for k in range(2):
 vs=[];fs=[];n=15
 for ring in range(5):
  u=ring/4;r=.02+.18*u
  for j in range(n):
   a=-.95+j/(n-1)*1.9;flute=1+.055*(1 if j%2 else -1);vs.append((math.sin(a)*r*flute+k*.28,math.cos(a)*r*flute,math.sin(u*math.pi)*.055+.009))
 for ring in range(4):
  for j in range(n-1):i=ring*n+j;fs.append((i,i+1,i+n+1,i+n))
 o=mesh('Scallop_shell',vs,fs,petal if k==0 else rose);o.modifiers.new('Shell_thickness','SOLIDIFY').thickness=.009
assets['shell_pair']=list(set(bpy.context.scene.objects)-before)
manifest={'lane':'Art-directed','units':'metres','assets':[],'material_policy':'joined material batches, palette-based PBR'}
for name,objects in assets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);bpy.ops.object.join();o=bpy.context.object;o.name=name
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.calc_loop_triangles();tri=len(o.data.loop_triangles);assert tri<6500,(name,tri);assets[name]=[o]
 if not BLOCK:bpy.ops.export_scene.gltf(filepath=os.path.join(WEB,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
 manifest['assets'].append({'name':name,'triangles':tri})
for i,(name,objects) in enumerate(assets.items()):objects[0].location.x+=(i%2-.5)*2.1;objects[0].location.y+=(i//2)*1.55
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.render.resolution_x=1000;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.29,.30,1)
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=750;bpy.context.object.data.size=5
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=5.3
for label,p in [('threequarter',(3,-6,5)),('front',(0,-8,1)),('side',(8,0,1)),('top',(0,0,8)),('rear',(-3,6,5))]:
 cam.location=p;cam.rotation_euler=(Vector((0,.7,.25))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(OUT,('blockout_' if BLOCK else 'final_')+label+'.png');bpy.ops.render.render(write_still=True)
if not BLOCK:
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'coastal_garden.blend'))
 with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
print('VALIDATED',json.dumps(manifest))
