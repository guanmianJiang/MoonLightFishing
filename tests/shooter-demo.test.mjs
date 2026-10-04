import test from 'node:test';
import assert from 'node:assert/strict';

// 机甲射击 Demo 核心逻辑单元测试
// 由于 shooter-demo.js 依赖 WebGL 渲染环境，此处对可抽离的纯逻辑进行验证。

// ---- 复刻 demo 中的工具函数 ----
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 复刻 Target 的命中逻辑
function makeTarget(hp) {
  return { hp, maxHp: hp, alive: true, hitFlash: 0,
    hit(dmg) {
      this.hp -= dmg;
      this.hitFlash = 1;
      if (this.hp <= 0) { this.alive = false; return true; }
      return false;
    }
  };
}

// 复刻波次血量公式
function waveHp(scale, wave) {
  return Math.ceil(scale * (wave * 0.4 + 1));
}

// 复刻连击规则
function nextCombo(combo) {
  return Math.min(combo + 1, 20);
}

// 复刻得分
function killScore(combo) {
  return 10 * combo;
}

// 复刻碰撞判定（球-球距离）
function collides(projPos, targetPos, targetRadius, projRadius = 0.2) {
  const dx = projPos.x - targetPos.x;
  const dy = projPos.y - targetPos.y;
  const dz = projPos.z - targetPos.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < targetRadius + projRadius;
}

// 复刻弹丸生命周期判定
function projectileAlive(life, posY, posLen) {
  return life > 0 && posY >= -2 && posLen <= 120;
}

// ============================================================
test('工具函数 clamp 行为正确', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
});

test('randi 产出整数且在闭区间内', () => {
  for (let i = 0; i < 200; i++) {
    const v = randi(2, 7);
    assert.ok(Number.isInteger(v), `应是整数，得到 ${v}`);
    assert.ok(v >= 2 && v <= 7, `应在 [2,7] 内，得到 ${v}`);
  }
});

test('pick 返回数组中的元素', () => {
  const arr = ['a', 'b', 'c', 'd'];
  for (let i = 0; i < 100; i++) {
    assert.ok(arr.includes(pick(arr)));
  }
});

test('Target.hit 扣减血量并在归零时标记死亡', () => {
  const t = makeTarget(3);
  assert.equal(t.alive, true);
  assert.equal(t.hit(1), false); // 剩余 2
  assert.equal(t.hp, 2);
  assert.equal(t.hit(1), false); // 剩余 1
  assert.equal(t.hp, 1);
  assert.equal(t.hit(1), true);  // 剩余 0，死亡
  assert.equal(t.hp, 0);
  assert.equal(t.alive, false);
  // 继续命中仍返回 true（已死）
  assert.equal(t.hit(1), true);
});

test('Target.hit 设置命中闪烁标记', () => {
  const t = makeTarget(5);
  assert.equal(t.hitFlash, 0);
  t.hit(1);
  assert.equal(t.hitFlash, 1);
});

test('波次血量随波次和缩放递增', () => {
  // 第 1 波 scale=1 -> ceil(1*(0.4+1))=ceil(1.4)=2
  assert.equal(waveHp(1, 1), 2);
  // 第 1 波 scale=1.5 -> ceil(1.5*1.4)=ceil(2.1)=3
  assert.equal(waveHp(1.5, 1), 3);
  // 第 5 波 scale=1 -> ceil(1*(2+1))=3
  assert.equal(waveHp(1, 5), 3);
  // 第 10 波 scale=1.2 -> ceil(1.2*(4+1))=ceil(6)=6
  assert.equal(waveHp(1.2, 10), 6);
  assert.ok(waveHp(1, 10) > waveHp(1, 1), '高波次血量应更高');
});

test('连击递增且不超过上限 20', () => {
  assert.equal(nextCombo(1), 2);
  assert.equal(nextCombo(5), 6);
  assert.equal(nextCombo(19), 20);
  assert.equal(nextCombo(20), 20); // 封顶
  assert.equal(nextCombo(25), 20); // 超过上限仍为 20
});

test('击杀得分 = 10 × 当前连击', () => {
  assert.equal(killScore(1), 10);
  assert.equal(killScore(5), 50);
  assert.equal(killScore(20), 200);
});

test('球-球碰撞判定：距离小于半径之和时碰撞', () => {
  const proj = { x: 0, y: 0, z: 0 };
  const target = { x: 0.5, y: 0, z: 0 };
  // 距离 0.5，半径和 = 1.0 + 0.2 = 1.2 → 碰撞
  assert.equal(collides(proj, target, 1.0), true);
  // 远距离不碰撞
  const far = { x: 10, y: 0, z: 0 };
  assert.equal(collides(proj, far, 1.0), false);
  // 边界：距离恰好小于半径和
  const edge = { x: 1.15, y: 0, z: 0 };
  assert.equal(collides(proj, edge, 1.0), true);
  // 刚好不碰撞
  const justOut = { x: 1.21, y: 0, z: 0 };
  assert.equal(collides(proj, justOut, 1.0), false);
});

test('弹丸生命周期：生命耗尽或越界时死亡', () => {
  assert.equal(projectileAlive(1.0, 0, 50), true);
  assert.equal(projectileAlive(0, 0, 50), false);   // 生命耗尽
  assert.equal(projectileAlive(1.0, -3, 50), false); // 低于地面
  assert.equal(projectileAlive(1.0, 0, 121), false); // 超出范围
  assert.equal(projectileAlive(1.0, 0, 120), true);  // 边界 120 仍存活
  assert.equal(projectileAlive(1.0, 0, 119), true);
  assert.equal(projectileAlive(1.0, -2, 0), true);   // y=-2 边界仍存活
  assert.equal(projectileAlive(1.0, -2.01, 0), false); // 略低于 -2 死亡
});

test('爆炸碎片物理：重力使 y 速度递减', () => {
  // 复刻碎片更新中的重力逻辑
  const vel = { x: 2, y: 8, z: -1 };
  const dt = 0.016;
  const pos = { x: 0, y: 5, z: 0 };
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;
  vel.y -= 14 * dt; // 重力
  assert.ok(vel.y < 8, '受重力后 y 速度应减小');
  assert.ok(pos.y > 5, '初始上升阶段 y 应增加');
});

test('目标漂浮 y 坐标围绕基准值上下波动', () => {
  const baseY = 5;
  const bobAmp = 0.3;
  const bobSpeed = 1.2;
  const bobPhase = 0.5;
  // 多个时间点采样
  const ys = [];
  for (let t = 0; t < 10; t += 0.2) {
    ys.push(baseY + Math.sin(t * bobSpeed + bobPhase) * bobAmp);
  }
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  assert.ok(minY >= baseY - bobAmp - 1e-9, 'y 不应低于 baseY - 振幅');
  assert.ok(maxY <= baseY + bobAmp + 1e-9, 'y 不应高于 baseY + 振幅');
  assert.ok(maxY > minY, '应有波动');
});

test('弹丸拖尾点数上限为 20', () => {
  // 复刻拖尾逻辑
  let trailPts = [{ x: 0, y: 0, z: 0 }];
  for (let i = 0; i < 30; i++) {
    trailPts.push({ x: i, y: 0, z: 0 });
    if (trailPts.length > 20) trailPts.shift();
  }
  assert.equal(trailPts.length, 20, '拖尾点数应稳定在 20');
});
