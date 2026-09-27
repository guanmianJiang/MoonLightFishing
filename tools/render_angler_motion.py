import bpy, math
from mathutils import Vector
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'assets_pipeline'/'angler-motion'
scene=bpy.context.scene
bpy.ops.object.camera_add(location=(4,-6,3.4));cam=bpy.context.object;scene.camera=cam
cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.8
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='OBJECT';scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100
for name,frame in [('cast_ready',0),('cast_back',28),('cast_release',38),('reel_lift',145)]:
 scene.frame_set(frame);scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
