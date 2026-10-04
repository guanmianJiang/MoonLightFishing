// 机甲射击 Demo — 还原参考视频中的物理、画面、射击、弹道、控制与视觉
import * as THREE from './three.module.js';

// ============================================================
// 全局工具
// ============================================================
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

// ============================================================
// 场景与渲染（强制 WebGL）
// ============================================================
const app = document.getElementById('app');

// WebGL 能力检测
function getWebGLContext() {
  const probe = document.createElement('canvas');
  return probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl');
}

if (!getWebGLContext()) {
  // 强制 WebGL：不支持时直接报错并停止
  const err = document.createElement('div');
  err.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0e12;color:#ff6b6b;font-family:sans-serif;font-size:14px;text-align:center;padding:20px;z-index:9999';
  err.innerHTML = '<div><h2 style="margin:0 0 12px">WebGL 不可用</h2><p style="margin:0;opacity:.7;line-height:1.6">当前浏览器/环境不支持 WebGL，无法渲染 3D 画面。<br>请在支持 WebGL 的浏览器中打开，或检查显卡/硬件加速设置。</p></div>';
  document.body.appendChild(err);
  throw new Error('WebGL is not supported in this environment');
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const inputCanvas = renderer.domElement;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a2533, 0.018);

// 相机 — 低视角仰视，机甲在画面下方
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 4.2, 11);
camera.lookAt(0, 5, -6);

// ---- 光照 ----
const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x1a1410, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe9c2, 1.1);
sun.position.set(-6, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -22;
sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -22;
sun.shadow.bias = -0.0005;
scene.add(sun);

const rim = new THREE.DirectionalLight(0x66aaff, 0.4);
rim.position.set(8, 6, -10);
scene.add(rim);

// ---- 天空穹顶 ----
{
  const skyGeo = new THREE.SphereGeometry(200, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2a4a6e) },
      midColor: { value: new THREE.Color(0x5a7fa8) },
      botColor: { value: new THREE.Color(0xc9d8e8) },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 topColor,midColor,botColor;
      void main(){
        float h = normalize(vPos).y;
        vec3 c = mix(botColor, midColor, smoothstep(-0.1, 0.25, h));
        c = mix(c, topColor, smoothstep(0.2, 0.8, h));
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ---- 云层 ----
const cloudGroup = new THREE.Group();
scene.add(cloudGroup);
{
  const cloudTex = makeCloudTexture();
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: rand(0.25, 0.55),
      depthWrite: false, color: new THREE.Color().setHSL(0.6, 0.1, rand(0.85, 1.0))
    });
    const s = new THREE.Sprite(mat);
    const a = rand(0, TAU), r = rand(50, 120);
    s.position.set(Math.cos(a) * r, rand(18, 40), Math.sin(a) * r - 30);
    const sc = rand(18, 40);
    s.scale.set(sc, sc * 0.5, 1);
    cloudGroup.add(s);
  }
}
function makeCloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---- 地面（暗色反射面） ----
const groundGeo = new THREE.PlaneGeometry(300, 300, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x0d151c, metalness: 0.85, roughness: 0.28,
  envMapIntensity: 0.6
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 地面网格线（科技感）
{
  const grid = new THREE.GridHelper(120, 48, 0x2a6a8a, 0x1a3a4a);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  grid.position.y = 0.02;
  scene.add(grid);
}

// 用 CubeCamera 给地面提供反射
const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
const cubeCam = new THREE.CubeCamera(0.5, 200, cubeRT);
groundMat.envMap = cubeRT.texture;

// ============================================================
// 机甲角色
// ============================================================
class Mech {
  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 1.6, 6);
    scene.add(this.group);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c2228, metalness: 0.8, roughness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0e1216, metalness: 0.9, roughness: 0.3 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x33ffdd, emissive: 0x33ffdd, emissiveIntensity: 2.2, metalness: 0, roughness: 0.4
    });

    // 中央主体
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.9), bodyMat);
    torso.position.y = 0.4;
    torso.castShadow = true;
    this.group.add(torso);

    // 胸甲发光条
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.05), glowMat);
    chest.position.set(0, 0.55, 0.48);
    this.group.add(chest);

    // 头部
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), darkMat);
    head.position.y = 1.35;
    head.castShadow = true;
    this.group.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.04), glowMat);
    visor.position.set(0, 1.38, 0.27);
    this.group.add(visor);

    // 两侧推进舱
    this.pods = [];
    for (const sx of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(sx * 1.1, 0.3, 0);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 1.1), bodyMat);
      hull.castShadow = true;
      pod.add(hull);
      // 发光面板
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.06), glowMat);
      panel.position.set(sx * -0.38, 0.1, 0);
      panel.rotation.y = sx * 0.3;
      pod.add(panel);
      // 底部喷口光
      const thrust = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.15, 16), glowMat);
      thrust.position.y = -0.55;
      pod.add(thrust);
      this.pods.push(pod);
      this.group.add(pod);
    }

    // 双肩武器炮
    this.guns = [];
    for (const sx of [-1, 1]) {
      const gun = new THREE.Group();
      gun.position.set(sx * 0.75, 1.0, 0.2);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), darkMat);
      gun.add(base);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 12), darkMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = 0.55;
      gun.add(barrel);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.12, 12), glowMat);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.z = 1.0;
      gun.add(muzzle);
      gun.castShadow = true;
      this.guns.push(gun);
      this.group.add(gun);
    }

    // 推进器火焰点光
    this.thrustLight = new THREE.PointLight(0x33ffdd, 1.6, 8, 2);
    this.thrustLight.position.set(0, -0.4, 0);
    this.group.add(this.thrustLight);

    this.baseY = 1.6;
    this.phase = Math.random() * TAU;
    this.aimDir = new THREE.Vector3(0, 0, -1);
  }

  setAim(dir) {
    this.aimDir.copy(dir);
    // 炮管朝瞄准方向（使用世界坐标）
    const wp = new THREE.Vector3();
    for (const g of this.guns) {
      g.getWorldPosition(wp);
      g.lookAt(wp.clone().add(this.aimDir));
    }
  }

  getMuzzleWorld(i) {
    const g = this.guns[i];
    const v = new THREE.Vector3(0, 0, 1.1);
    g.localToWorld(v);
    return v;
  }

  update(dt, t) {
    // 悬浮起伏
    this.group.position.y = this.baseY + Math.sin(t * 1.8 + this.phase) * 0.12;
    // 微微前倾
    this.group.rotation.x = Math.sin(t * 0.7) * 0.02;
    // 推进光闪烁
    this.thrustLight.intensity = 1.4 + Math.sin(t * 12) * 0.3;
    for (const p of this.pods) {
      p.position.y = 0.3 + Math.sin(t * 3 + p.position.x) * 0.04;
    }
  }
}

const mech = new Mech();

// ============================================================
// 目标（漂浮几何体）
// ============================================================
const TARGET_COLORS = [
  0xff4d6d, 0xffb13a, 0xffe14d, 0x6dff8a, 0x4dd2ff,
  0xb14dff, 0xff6dd2, 0x4dffd2, 0xff7a3a, 0x8aff4d
];

const TARGET_GEOS = ['box', 'sphere', 'torus', 'cylinder', 'octa', 'icosa'];

class Target {
  constructor(kind, pos, scale = 1, hp = 1) {
    this.kind = kind;
    this.hp = hp;
    this.maxHp = hp;
    this.alive = true;
    this.hitFlash = 0;
    this.group = new THREE.Group();
    this.group.position.copy(pos);

    const color = pick(TARGET_COLORS);
    const mat = new THREE.MeshStandardMaterial({
      color, metalness: 0.3, roughness: 0.35,
      emissive: color, emissiveIntensity: 0.25
    });
    this.mat = mat;

    let geo;
    const s = scale;
    switch (kind) {
      case 'box': geo = new THREE.BoxGeometry(1.2 * s, 1.2 * s, 1.2 * s); break;
      case 'sphere': geo = new THREE.SphereGeometry(0.75 * s, 20, 16); break;
      case 'torus': geo = new THREE.TorusGeometry(0.7 * s, 0.28 * s, 12, 28); break;
      case 'cylinder': geo = new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 1.2 * s, 16); break;
      case 'octa': geo = new THREE.OctahedronGeometry(0.85 * s); break;
      case 'icosa': geo = new THREE.IcosahedronGeometry(0.85 * s, 0); break;
    }
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    // 保存原始颜色，用于命中闪白恢复
    this.origColor = new THREE.Color(color);

    // 发光轮廓
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const wire = new THREE.LineSegments(edges, lineMat);
    this.group.add(wire);

    this.spin = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.8);
    this.bobPhase = rand(0, TAU);
    this.bobAmp = rand(0.15, 0.4);
    this.bobSpeed = rand(0.8, 1.6);
    this.baseY = pos.y;
    geo.computeBoundingSphere();
    this.radius = (geo.boundingSphere ? geo.boundingSphere.radius : 0.8) * scale;

    scene.add(this.group);
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hitFlash = 1;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt, t) {
    this.group.rotation.x += this.spin.x * dt;
    this.group.rotation.y += this.spin.y * dt;
    this.group.rotation.z += this.spin.z * dt;
    this.group.position.y = this.baseY + Math.sin(t * this.bobSpeed + this.bobPhase) * this.bobAmp;

    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
      this.mat.emissiveIntensity = 0.25 + this.hitFlash * 2.5;
      this.mat.color.copy(this.origColor).lerp(_WHITE, this.hitFlash);
    }
  }
}

const _WHITE = new THREE.Color(0xffffff);

// ============================================================
// 弹丸（弹道）
// ============================================================
class Projectile {
  constructor(origin, dir, speed = 55) {
    this.alive = true;
    this.life = 2.2;
    this.dir = dir.clone().normalize();
    this.speed = speed;
    this.pos = origin.clone();

    const mat = new THREE.MeshBasicMaterial({ color: 0x66ffcc });
    const glow = new THREE.MeshBasicMaterial({ color: 0xaaffee, transparent: true, opacity: 0.5 });

    this.bolt = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat);
    this.bolt.position.copy(this.pos);

    this.halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), glow);
    this.halo.position.copy(this.pos);

    this.light = new THREE.PointLight(0x66ffcc, 2.2, 6, 2);
    this.light.position.copy(this.pos);

    scene.add(this.bolt, this.halo, this.light);

    // 拖尾（用线段历史）
    this.trailPts = [origin.clone()];
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    this.trailMat = new THREE.LineBasicMaterial({ color: 0x88ffdd, transparent: true, opacity: 0.7 });
    this.trail = new THREE.Line(this.trailGeo, this.trailMat);
    scene.add(this.trail);
    this.trailLen = 0;
  }

  update(dt) {
    this.pos.addScaledVector(this.dir, this.speed * dt);
    this.bolt.position.copy(this.pos);
    this.halo.position.copy(this.pos);
    this.light.position.copy(this.pos);

    this.trailPts.push(this.pos.clone());
    if (this.trailPts.length > 20) this.trailPts.shift();
    this.trailLen = this.trailPts.length;
    const arr = this.trailGeo.attributes.position.array;
    for (let i = 0; i < this.trailPts.length; i++) {
      arr[i * 3] = this.trailPts[i].x;
      arr[i * 3 + 1] = this.trailPts[i].y;
      arr[i * 3 + 2] = this.trailPts[i].z;
    }
    this.trailGeo.setDrawRange(0, this.trailLen);
    this.trailGeo.attributes.position.needsUpdate = true;

    this.life -= dt;
    if (this.life <= 0 || this.pos.y < -2 || this.pos.length() > 120) this.alive = false;
  }

  dispose() {
    scene.remove(this.bolt, this.halo, this.light, this.trail);
    this.bolt.geometry.dispose();
    this.halo.geometry.dispose();
    this.trailGeo.dispose();
  }
}

// ============================================================
// 爆炸（碎片 + 闪光 + 烟雾）
// ============================================================
class Explosion {
  constructor(pos, color, scale = 1) {
    this.alive = true;
    this.life = 1.4;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    scene.add(this.group);

    // 闪光球
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.6 * scale, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 1 })
    );
    this.group.add(this.flash);

    // 点光
    this.light = new THREE.PointLight(color, 6 * scale, 14 * scale, 2);
    this.group.add(this.light);

    // 碎片
    this.shards = [];
    const count = Math.floor(14 * scale);
    for (let i = 0; i < count; i++) {
      const shardColor = pick([color, 0xffffff, 0xffe14d, TARGET_COLORS[randi(0, TARGET_COLORS.length - 1)]]);
      const g = pick([
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.TetrahedronGeometry(0.14),
        new THREE.SphereGeometry(0.08, 6, 5)
      ]);
      const m = new THREE.MeshStandardMaterial({ color: shardColor, emissive: shardColor, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.4 });
      const shard = new THREE.Mesh(g, m);
      shard.position.copy(pos);
      const dir = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.2), rand(-1, 1)).normalize();
      shard.userData = {
        vel: dir.multiplyScalar(rand(4, 11) * scale),
        spin: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
        life: rand(0.6, 1.3)
      };
      scene.add(shard);
      this.shards.push(shard);
    }

    // 烟雾
    this.smoke = [];
    const smokeCount = Math.floor(6 * scale);
    for (let i = 0; i < smokeCount; i++) {
      const m = new THREE.SpriteMaterial({
        map: smokeTex, transparent: true, opacity: 0.6,
        color: 0xaaaaaa, depthWrite: false
      });
      const s = new THREE.Sprite(m);
      s.position.copy(pos).add(new THREE.Vector3(rand(-0.5, 0.5), rand(-0.3, 0.6), rand(-0.5, 0.5)));
      s.scale.setScalar(rand(1.5, 3) * scale);
      s.userData = { vel: new THREE.Vector3(rand(-1, 1), rand(1, 2.5), rand(-1, 1)).multiplyScalar(scale), life: rand(0.8, 1.4), grow: rand(2, 4) * scale };
      scene.add(s);
      this.smoke.push(s);
    }

    this.flashScale = scale;
  }

  update(dt) {
    this.life -= dt;
    const k = clamp(1 - this.life / 1.4, 0, 1);

    // 闪光扩散+淡出
    const fs = (0.6 + k * 4) * this.flashScale;
    this.flash.scale.setScalar(fs);
    this.flash.material.opacity = (1 - k) * 0.9;
    this.light.intensity = (1 - k) * 6 * this.flashScale;

    // 碎片
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.userData.life -= dt;
      s.userData.vel.y -= 14 * dt; // 重力
      s.position.addScaledVector(s.userData.vel, dt);
      s.rotation.x += s.userData.spin.x * dt;
      s.rotation.y += s.userData.spin.y * dt;
      s.rotation.z += s.userData.spin.z * dt;
      if (s.position.y < 0.1) { s.position.y = 0.1; s.userData.vel.y *= -0.3; s.userData.vel.x *= 0.6; s.userData.vel.z *= 0.6; }
      if (s.userData.life <= 0) {
        scene.remove(s); s.geometry.dispose(); s.material.dispose();
        this.shards.splice(i, 1);
      } else {
        s.material.emissiveIntensity = 0.6 * (s.userData.life / 1.3);
        s.material.opacity = clamp(s.userData.life, 0, 1);
        s.material.transparent = true;
      }
    }

    // 烟雾
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.userData.life -= dt;
      s.position.addScaledVector(s.userData.vel, dt);
      s.userData.vel.multiplyScalar(0.96);
      s.scale.setScalar(s.scale.x + s.userData.grow * dt);
      s.material.opacity = 0.6 * clamp(s.userData.life / 1.2, 0, 1);
      if (s.userData.life <= 0) {
        scene.remove(s); s.material.dispose();
        this.smoke.splice(i, 1);
      }
    }

    if (this.life <= 0 && this.shards.length === 0 && this.smoke.length === 0) {
      this.alive = false;
      scene.remove(this.group);
      this.flash.geometry.dispose();
      this.flash.material.dispose();
    }
  }
}

// 烟雾贴图
function makeSmokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(220,220,220,0.8)');
  g.addColorStop(0.6, 'rgba(160,160,160,0.3)');
  g.addColorStop(1, 'rgba(120,120,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const smokeTex = makeSmokeTexture();

// ============================================================
// Boss（粉色星形/花朵）
// ============================================================
class Boss {
  constructor(pos) {
    this.alive = true;
    this.hp = 12;
    this.maxHp = 12;
    this.hitFlash = 0;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    scene.add(this.group);

    const pink = 0xff4d9d;
    this.mat = new THREE.MeshStandardMaterial({ color: pink, emissive: pink, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.4 });

    // 星形 — 用多个八面体拼成花
    const petalGeo = new THREE.OctahedronGeometry(1.1, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const petal = new THREE.Mesh(petalGeo, this.mat);
      petal.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5);
      petal.rotation.y = -a;
      petal.rotation.z = Math.PI / 2;
      petal.scale.set(1.4, 0.5, 1.4);
      petal.castShadow = true;
      this.group.add(petal);
    }
    // 中心球
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffaa22, emissiveIntensity: 0.8 }));
    core.castShadow = true;
    this.group.add(core);
    this.core = core;

    this.light = new THREE.PointLight(0xff4d9d, 3, 18, 2);
    this.group.add(this.light);

    this.baseY = pos.y;
    this.phase = 0;
    this.radius = 2.6;
    this.spinSpeed = 0.6;
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hitFlash = 1;
    if (this.hp <= 0) { this.alive = false; return true; }
    return false;
  }

  update(dt, t) {
    this.group.rotation.y += this.spinSpeed * dt;
    this.group.position.y = this.baseY + Math.sin(t * 0.8) * 0.5;
    this.core.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    this.light.intensity = 2.5 + Math.sin(t * 5) * 0.8;

    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
      this.mat.emissiveIntensity = 0.35 + this.hitFlash * 2;
    }
  }
}

// ============================================================
// 游戏状态
// ============================================================
const state = {
  targets: [],
  projectiles: [],
  explosions: [],
  boss: null,
  score: 0,
  combo: 1,
  comboTimer: 0,
  wave: 1,
  time: 0,
  waveTimer: 0,
  spawnTimer: 0,
  aim: new THREE.Vector2(0, 0), // 屏幕归一化
  fireCooldown: 0,
  autoFire: false,
};

const fpsEl = document.getElementById('fps');
const timeEl = document.getElementById('time');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const waveEl = document.getElementById('wave');
const waveBanner = document.getElementById('waveBanner');
const vignette = document.getElementById('vignette');

function showBanner(text) {
  waveBanner.textContent = text;
  waveBanner.classList.add('show');
  setTimeout(() => waveBanner.classList.remove('show'), 1600);
}

function flashDamage() {
  vignette.classList.add('hit');
  setTimeout(() => vignette.classList.remove('hit'), 220);
}

// ============================================================
// 生成目标
// ============================================================
function spawnTarget() {
  const kind = pick(TARGET_GEOS);
  const angle = rand(0, TAU);
  const dist = rand(8, 22);
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist - 6;
  const y = rand(2, 8);
  const scale = rand(0.7, 1.5);
  const hp = Math.ceil(scale * (state.wave * 0.4 + 1));
  const t = new Target(kind, new THREE.Vector3(x, y, z), scale, hp);
  state.targets.push(t);
}

function spawnWave(n) {
  for (let i = 0; i < n; i++) spawnTarget();
}

function startWave() {
  showBanner(`第 ${state.wave} 波`);
  const count = 4 + state.wave * 2;
  spawnWave(count);
  // 每 3 波出现 Boss
  if (state.wave % 3 === 0 && !state.boss) {
    setTimeout(() => {
      state.boss = new Boss(new THREE.Vector3(0, 6, -12));
      showBanner('⚠ BOSS 出现');
    }, 800);
  }
}

// ============================================================
// 射击
// ============================================================
const _raycaster = new THREE.Raycaster();
function getAimDirection() {
  _raycaster.setFromCamera(state.aim, camera);
  return _raycaster.ray.direction.clone();
}

function fire() {
  if (state.fireCooldown > 0) return;
  state.fireCooldown = 0.12;

  const dir = getAimDirection();
  mech.setAim(dir);

  // 双管齐发
  for (let i = 0; i < 2; i++) {
    const origin = mech.getMuzzleWorld(i);
    // 略微向瞄准方向汇聚
    const d = dir.clone();
    const p = new Projectile(origin, d, 60);
    state.projectiles.push(p);
  }

  // 枪口闪光
  for (let i = 0; i < 2; i++) {
    const flash = new Explosion(mech.getMuzzleWorld(i), 0x66ffcc, 0.4);
    flash.life = 0.15;
    state.explosions.push(flash);
  }
}

// ============================================================
// 碰撞检测
// ============================================================
function checkCollisions() {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    if (!p.alive) continue;

    // 目标
    for (let j = state.targets.length - 1; j >= 0; j--) {
      const t = state.targets[j];
      if (!t.alive) continue;
      if (p.pos.distanceTo(t.group.position) < t.radius + 0.2) {
        const killed = t.hit(1);
        p.alive = false;
        if (killed) {
          const exp = new Explosion(t.group.position.clone(), t.mat.color.getHex(), t.mesh.scale.x);
          state.explosions.push(exp);
          scene.remove(t.group);
          t.mesh.geometry.dispose();
          state.targets.splice(j, 1);
          addScore(10 * state.combo);
          state.combo = Math.min(state.combo + 1, 20);
          state.comboTimer = 2.5;
        } else {
          // 命中火花
          state.explosions.push(new Explosion(p.pos.clone(), 0xffee88, 0.4));
        }
        break;
      }
    }
    if (!p.alive) continue;

    // Boss
    if (state.boss && state.boss.alive) {
      if (p.pos.distanceTo(state.boss.group.position) < state.boss.radius) {
        const killed = state.boss.hit(1);
        p.alive = false;
        state.explosions.push(new Explosion(p.pos.clone(), 0xff88cc, 0.6));
        if (killed) {
          state.explosions.push(new Explosion(state.boss.group.position.clone(), 0xff4d9d, 3));
          scene.remove(state.boss.group);
          addScore(500 * state.combo);
          state.boss = null;
          flashDamage();
        }
      }
    }
  }
}

function addScore(v) {
  state.score += v;
  scoreEl.textContent = state.score;
}

// ============================================================
// 控制输入
// ============================================================
let pointerDown = false;

function onPointerMove(e) {
  const rect = inputCanvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  state.aim.x = (cx / rect.width) * 2 - 1;
  state.aim.y = -(cy / rect.height) * 2 + 1;
}

inputCanvas.addEventListener('pointermove', onPointerMove);
inputCanvas.addEventListener('pointerdown', e => {
  pointerDown = true;
  onPointerMove(e);
});
inputCanvas.addEventListener('pointerup', () => { pointerDown = false; });
inputCanvas.addEventListener('pointerleave', () => { pointerDown = false; });

// 双击屏幕开火
let lastTap = 0;
inputCanvas.addEventListener('pointerdown', e => {
  const now = performance.now();
  if (now - lastTap < 280) { fire(); lastTap = 0; }
  else lastTap = now;
});

// 发射按钮
document.getElementById('fireBtn').addEventListener('pointerdown', e => { e.preventDefault(); fire(); });

// 持续按住自动射击
let autoFireTimer = 0;
document.getElementById('fireBtn').addEventListener('pointerdown', () => { state.autoFire = true; });
document.getElementById('fireBtn').addEventListener('pointerup', () => { state.autoFire = false; });
document.getElementById('fireBtn').addEventListener('pointerleave', () => { state.autoFire = false; });

// 键盘（桌面调试）
window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); fire(); } });

// ============================================================
// 窗口缩放
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// 主循环
// ============================================================
const clock = new THREE.Clock();
let frameCount = 0, fpsTime = 0, fps = 0;

startWave();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  state.time += dt;

  // FPS
  frameCount++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(frameCount / fpsTime); frameCount = 0; fpsTime = 0; fpsEl.textContent = fps; }
  timeEl.textContent = state.time.toFixed(0);

  // 机甲
  const aimDir = getAimDirection();
  mech.setAim(aimDir);
  mech.update(dt, t);

  // 冷却
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  if (state.autoFire) {
    autoFireTimer += dt;
    if (autoFireTimer > 0.14) { autoFireTimer = 0; fire(); }
  } else autoFireTimer = 0;

  // 连击计时
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 1;
  }
  comboEl.textContent = 'x' + state.combo;

  // 目标
  for (const tg of state.targets) tg.update(dt, t);

  // Boss
  if (state.boss) state.boss.update(dt, t);

  // 弹丸
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.update(dt);
    if (!p.alive) { p.dispose(); state.projectiles.splice(i, 1); }
  }

  // 碰撞
  checkCollisions();

  // 爆炸
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    const e = state.explosions[i];
    e.update(dt);
    if (!e.alive) state.explosions.splice(i, 1);
  }

  // 云缓慢漂移
  cloudGroup.children.forEach((c, i) => { c.position.x += dt * (0.3 + i * 0.02); if (c.position.x > 140) c.position.x = -140; });

  // 波次管理
  if (state.targets.length === 0 && !state.boss) {
    state.waveTimer += dt;
    if (state.waveTimer > 1.5) {
      state.waveTimer = 0;
      state.wave++;
      waveEl.textContent = state.wave;
      startWave();
    }
  } else {
    state.waveTimer = 0;
  }

  // 每 2 秒更新地面反射（性能平衡）
  if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) {
    mech.group.visible = false;
    cubeCam.position.copy(mech.group.position);
    cubeCam.update(renderer, scene);
    mech.group.visible = true;
  }

  renderer.render(scene, camera);
}
animate();
