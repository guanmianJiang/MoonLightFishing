// World-space caustic field shared by all receivers seen through the water.
export const causticsGLSL=`
vec4 causticMod289(vec4 x){return x-floor(x/289.)*289.;}
vec4 causticPermute(vec4 x){return causticMod289((x*34.+1.)*x);}
vec4 causticSimplexDerivative(vec3 v,float blur){
 const vec2 C=vec2(1./6.,1./3.);
 vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz),l=1.-g;
 vec3 i1=min(g.xyz,l.zxy),i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.x,x2=x0-i2+C.y,x3=x0-.5;
 vec4 p=causticPermute(causticPermute(causticPermute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
 vec4 j=p-49.*floor(p/49.),x_=floor(j/7.),y_=floor(j-7.*x_);
 vec4 x=(x_*2.+.5)/7.-1.,y=(y_*2.+.5)/7.-1.,h=1.-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy),b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.+1.,s1=floor(b1)*2.+1.,sh=-step(h,vec4(0.));
 vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy,a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 g0=vec3(a0.xy,h.x),g1=vec3(a0.zw,h.y),g2=vec3(a1.xy,h.z),g3=vec3(a1.zw,h.w);
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
 vec4 m2=m*m,m3=m2*m,m4=m2*m2;
 vec3 grad=-6.*m3.x*x0*dot(x0,g0)+m4.x*g0-6.*m3.y*x1*dot(x1,g1)+m4.y*g1-6.*m3.z*x2*dot(x2,g2)+m4.z*g2-6.*m3.w*x3*dot(x3,g3)+m4.w*g3;
 vec4 px=vec4(dot(x0,g0),dot(x1,g1),dot(x2,g2),dot(x3,g3));
 return mix(42.,0.,blur)*vec4(grad,dot(m4,px));
}
float waterReceiverCaustics(vec3 pos,float blur){
 vec4 n=causticSimplexDerivative(pos,blur);pos-=n.xyz*.07;pos*=1.62;
 n=causticSimplexDerivative(pos,blur);pos-=n.xyz*.07;
 n=causticSimplexDerivative(pos,blur);pos-=n.xyz*.07;
 return causticSimplexDerivative(pos,blur).w;
}
`;
