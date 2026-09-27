import bpy,math,random
from mathutils import Vector
from mathutils.bvhtree import BVHTree
obj=bpy.data.objects['BeachTerrain'];bvh=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
def shore(x):return -3.8+math.sin(x*.22)*.85+math.cos(x*.51)*.24-min(1800,max(0,abs(x)-18)**2*.018)
def height(x,z):
 d=z-shore(x);b=math.sin(x*.31+z*.13)*.075+math.sin(x*.12-z*.27+1.8)*.045
 if d>=0:
  def smooth(a,b,v):
   t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
  descent=.105*d+.48*(1-math.exp(-d/16))
  near_fade=smooth(0,6,d)
  shelf=.12*math.exp(-((x+11)/21)**2-((d-15)/15)**2)
  hollow=-.075*math.exp(-((x-14)/23)**2-((d-25)/24)**2)
  return .14-min(24,descent)+near_fade*(shelf+hollow)
 inland=-d;backshore=max(0,inland-2)
 rise=.115*min(inland,2)+2.6*(1-math.exp(-backshore/24))
 t=min(1,max(0,(inland-4)/14));dune_fade=t*t*(3-2*t)
 far_fade=1-min(1,max(0,(inland-100)/100))
 dune=(math.sin(x*.13+inland*.08)+.45*math.sin(x*.31-inland*.06+1.1))*.34*dune_fade*far_fade
 near_ridge=inland-(10+2.2*math.sin(x*.105+.6))
 back_ridge=inland-(30+4.5*math.sin(x*.075-1.1))
 rt=min(1,max(0,(inland-1.5)/2.5));ridge_gate=rt*rt*(3-2*rt)
 ridges=ridge_gate*((.62+.12*math.sin(x*.18))*math.exp(-near_ridge*near_ridge/55)+(1.12+.18*math.sin(x*.09+1.4))*math.exp(-back_ridge*back_ridge/260))
 return .14+rise+b*min(1,abs(d)/1.8)+dune+ridges
random.seed(1);errors=[]
for i in range(2000):
 x=-24+48*random.random();d=-10+30*random.random();z=shore(x)+d
 hit,normal,face,distance=bvh.ray_cast(Vector((x,-z,100)),Vector((0,0,-1)))
 if hit:errors.append(abs(hit.z-height(x,z)))
print('BEACH_ERROR_MAX',max(errors),'P95',sorted(errors)[int(len(errors)*.95)],'SAMPLES',len(errors))
