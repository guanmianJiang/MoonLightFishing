"""Author fishing poses in Blender and export sampled gameplay controls."""
import bpy, json, math, os
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'assets_pipeline'/'angler-motion';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
# Values are local to the seated angler. Gameplay applies them at the hand joints.
clips={
 'cast':[
  (0.00,0.00,.72,0,0,0),(.14,-.25,1.12,-.035,.035,-.045),
  (.34,-.73,2.02,-.12,.10,-.17),(.53,-1.0,2.53,-.19,.17,-.28),
  (.63,-1.0,2.59,-.20,.18,-.29),(.70,-.54,1.32,-.05,.10,-.11),
  (.78,.94,.06,.15,-.045,.18),(.90,.84,.24,.11,-.035,.14),
  (1.16,.37,.47,.045,0,.06),(1.52,.10,.63,0,0,0),
  (1.85,0,.68,0,0,0)],
 'reel':[
  (0,0,.92,0,0,0),(.10,.25,1.33,.035,.10,-.06),
  (.22,.38,1.57,.055,.24,-.19),(.42,.34,1.45,.06,.31,-.28),
  (.75,.30,1.38,.045,.27,-.24),(1.20,.28,1.31,.025,.24,-.20),
  (1.60,.27,1.36,.02,.25,-.21),(2.05,.23,1.33,.015,.23,-.18),
  (2.55,.14,1.23,.01,.18,-.12),(3.20,0,1.10,0,.11,-.08)],
 'fight':[
  (0,.22,1.12,.03,.18,-.15),(.25,.30,1.23,.06,.27,-.23),
  (.50,.28,1.13,.02,.17,-.13),(.75,.20,1.02,-.015,.08,-.05),
  (1,.22,1.12,.03,.18,-.15)],
 'stand_up':[(0,0,1.00,0,0,0,0),(.18,.08,1.13,-.08,.04,-.03,.02),(.44,.38,1.28,-.16,.12,-.11,.15),(.72,.75,1.36,-.03,.22,-.18,.37),(1.05,1,1.22,.04,.26,-.20,.48)],
 'sit_down':[(0,1,1.22,.04,.26,-.20,.48),(.28,.82,1.27,-.04,.21,-.17,.39),(.62,.36,1.10,-.10,.10,-.09,.17),(.90,.10,.94,-.03,.03,-.02,.035),(1.15,0,.72,0,0,0,0)]
}
# Per-key secondary performance: torso yaw, off-hand lift/back offset, root lift, grip side.
# The supporting hand follows the grip but does not mirror the casting hand.
performance={
 'cast':[(0,0,0,0,0),(-.06,-.02,-.02,-.01,.05),(-.18,-.05,-.10,-.04,.29),(-.32,-.07,-.16,-.06,.43),(-.34,-.07,-.17,-.06,.44),(-.16,-.02,-.08,-.02,.30),(.16,.02,.04,.04,.04),(.12,.01,.035,.025,0),(.04,0,.01,0,0),(0,0,0,0,0),(0,0,0,0,0)],
 'reel':[(0,0,0,0,0),(.04,-.02,.03,-.025,0),(.09,-.06,.08,-.03,0),(.10,-.09,.11,-.02,0),(.08,-.06,.10,0,0),(.07,-.04,.09,0,0),(.08,-.06,.10,0,0),(.07,-.04,.09,0,0),(.03,-.02,.04,0,0),(0,0,0,0,0)]
}
assert all(len(performance[name])==len(clips[name]) for name in performance)
def secondary(name,index,length):return performance.get(name,[(0,0,0,0,0)]*length)[index]
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.frame_end=320
for name,keys in clips.items():
 control=bpy.data.objects.new(name.title()+'_Control',None);bpy.context.collection.objects.link(control)
 control.empty_display_type='ARROWS';control.empty_display_size=.2
 for index,row in enumerate(keys):
  t,action,angle,lean,lift,back,*extra=row;twist,off_lift,off_back,secondary_lift,grip_side=secondary(name,index,len(keys));root_lift=extra[0] if extra else secondary_lift
  frame=round(t*60)+{'cast':0,'reel':120,'fight':330,'stand_up':420,'sit_down':510}[name]
  control.location=(action,lift,back);control.rotation_euler=(lean,angle,twist);control['root_lift']=root_lift;control['off_hand_lift']=off_lift;control['off_hand_back']=off_back;control['grip_side']=grip_side
  control.keyframe_insert(data_path='location',frame=frame)
  control.keyframe_insert(data_path='rotation_euler',frame=frame)
  control.keyframe_insert(data_path='["root_lift"]',frame=frame)
  control.keyframe_insert(data_path='["off_hand_lift"]',frame=frame)
  control.keyframe_insert(data_path='["off_hand_back"]',frame=frame)
  control.keyframe_insert(data_path='["grip_side"]',frame=frame)
 control['clip_duration']=keys[-1][0]
 # Keep sampled values beside the native keyframes for exact runtime reproduction.
 control['samples_json']=json.dumps(keys)
# Simple pose review rig. Cylinders remain independent so hand and rod contact is clear.
def cylinder(name,r,length,color):
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=length)
 o=bpy.context.object;o.name=name;o.color=color;return o
torso=cylinder('Torso_proxy',.23,.62,(.13,.35,.32,1));torso.location.z=.52
head=cylinder('Head_proxy',.18,.30,(.63,.40,.25,1));head.location.z=1.0
rod=cylinder('Rod_proxy',.025,3.4,(.35,.23,.10,1))
hand=cylinder('Grip_proxy',.08,.14,(.65,.43,.27,1))
offhand=cylinder('Support_hand_proxy',.075,.14,(.65,.43,.27,1))
for clip,offset in [('cast',0),('reel',120),('stand_up',420),('sit_down',510)]:
 for index,row in enumerate(clips[clip]):
  t,action,angle,lean,lift,back,*extra=row;twist,off_lift,off_back,secondary_lift,grip_side=secondary(clip,index,len(clips[clip]));root_lift=extra[0] if extra else secondary_lift
  frame=round(t*60)+offset
  torso.location.z=.52+root_lift;torso.keyframe_insert(data_path='location',frame=frame)
  head.location.z=1.0+root_lift;head.keyframe_insert(data_path='location',frame=frame)
  torso.rotation_euler.y=lean;torso.rotation_euler.z=twist;torso.keyframe_insert(data_path='rotation_euler',frame=frame)
  hand.location=(.10+grip_side, .34+back+grip_side*.45, .56+lift+root_lift+grip_side*.35);hand.keyframe_insert(data_path='location',frame=frame)
  offhand.location=(-.10+grip_side,.34+back+off_back+grip_side*.45,.56+lift+off_lift+root_lift+grip_side*.35);offhand.keyframe_insert(data_path='location',frame=frame)
  rod.location=(.10+grip_side,.34+back+grip_side*.45-1.65*math.cos(angle),.56+lift+root_lift+grip_side*.35+1.65*math.sin(angle))
  rod.rotation_euler=(math.pi/2-angle,0,0);rod.keyframe_insert(data_path='location',frame=frame);rod.keyframe_insert(data_path='rotation_euler',frame=frame)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'angler_motion.blend'))
# Export the authored key values; no runtime dependency on Blender.
(root/'dist'/'angler-motion-data.js').write_text('export const motionClips='+json.dumps({k:[{'t':row[0],'action':row[1],'rodAngle':row[2],'lean':row[3],'handLift':row[4],'handBack':row[5],'rootLift':row[6] if len(row)>6 else secondary(k,i,len(v))[3],'torsoYaw':secondary(k,i,len(v))[0],'offHandLift':secondary(k,i,len(v))[1],'offHandBack':secondary(k,i,len(v))[2],'gripSide':secondary(k,i,len(v))[4]} for i,row in enumerate(v)] for k,v in clips.items()},separators=(',',':'))+';\n',encoding='utf-8')
print('ANGLER_MOTION',str(out/'angler_motion.blend'))
