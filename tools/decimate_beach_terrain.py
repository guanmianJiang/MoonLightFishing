import bpy, numpy as np, os
from pathlib import Path
root=Path(__file__).resolve().parents[1]
folder=root/'assets_pipeline'/'terrain'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
positions=np.fromfile(folder/'positions.bin',dtype=np.float32).reshape(-1,3)
indices=np.fromfile(folder/'indices.bin',dtype=np.uint32).reshape(-1,3)
# Blender is Z up. glTF export converts (x, -z, y) back to Three.js (x, y, z).
verts=[(float(x),float(-z),float(y)) for x,y,z in positions]
faces=[tuple(map(int,tri)) for tri in indices]
mesh=bpy.data.meshes.new('BeachTerrain');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('BeachTerrain',mesh);bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
original=len(mesh.polygons)
modifier=obj.modifiers.new('BlenderDecimate','DECIMATE');modifier.ratio=.05;modifier.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=modifier.name)
for poly in mesh.polygons:poly.use_smooth=True
uv=mesh.uv_layers.new(name='BeachUV')
for loop in mesh.loops:
 v=mesh.vertices[loop.vertex_index].co
 uv.data[loop.index].uv=(v.x*.65,-v.y*.65)
mesh.calc_loop_triangles()
print(f'TERRAIN_TRIANGLES {original} -> {len(mesh.loop_triangles)}')
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'beach_terrain.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'dist'/'assets'/'models'/'beach_terrain.glb'),export_format='GLB',export_apply=True,export_yup=True,export_normals=True,export_texcoords=True,export_materials='NONE')
