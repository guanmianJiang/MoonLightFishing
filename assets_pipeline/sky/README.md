# 天空球第二版资源

完成版本：`2026.10-sky-v2`。六个天空 ID 与发布默认 02 / 82° 保持兼容。

## 目录与生成来源

- `assets_pipeline/sky/v1/`：本轮开始前的六张原图与共享天空 shader 快照，供回退和同镜头对照；不是构建资源。
- `assets_pipeline/sky/v2/prompts.json`：各图的完整首轮提示词、01 的修订词、02–06 按顺序使用的修订词文件。所有创作和云层位置修改均使用内置 `image_gen`，逐图生成/编辑；未使用外部图片 CLI。
- `assets_pipeline/sky/v2/sky-toon-01-raw.png` 至 `sky-toon-06-raw.png`：最终生成源，1774×887。
- `assets_pipeline/sky/v2/*-draft.png`：构图迭代中保留的草稿；不进入构建。
- `assets_pipeline/sky/v2/sky-toon-01.png` 至 `sky-toon-06.png`：球面接缝/极区规范化后的最终资源。
- `assets_pipeline/sky/v2/manifest.json`：发布路径、生成源、尺寸、字节数、SHA-256 与像素检查指标。

发布资源分别为：

1. `public/assets/sky-toon-01.png`：三簇圆润云，清亮蓝天。
2. `public/assets/sky-toon-02.png`：疏朗三簇云，较鲜明的海蓝。
3. `public/assets/sky-toon-03.png`：两簇舒展云岸，偏柔和蓝青。
4. `public/assets/sky-toon-04.png`：两簇较饱满的积云，浅蓝青天空。
5. `public/assets/sky-toon-05.png`：大中央云和两侧小云，圆润体积感。
6. `public/assets/sky-toon-06.png`：三簇较低矮的远云，较开阔的淡青天空。

## 重建与质量门槛

运行 `node tools/prepare-sky-textures.mjs` 可从最终生成源确定性重建六张最终 PNG、发布贴图和清单。工具只做 PNG 编码、两端各 3.5% 的接缝校正和上下各 12% 的极区经度收束，不绘制云或重新着色天空。接缝颜色修正钳制在 0–255，避免字节下溢生成亮点。

六张图全部满足尺寸、接缝、极点、赤道渐变和下半球蓝色门槛后才开始替换发布资源；任意一张检查失败则在写入之前退出。门槛与接口见 `docs/design/scene-water-spec.md`，测试见 `tests/sky-textures.test.mjs`。像素规则只能排除一部分技术错误，云形和球面投影仍需要看图与实画检查。

图像上半部对应天空、中心对应地平线、下半部是连续的环境颜色填充。不可垂直平铺；经度重复由运行时 `RepeatWrapping` 处理。天空球和倒影共用 `src/sky-settings.mjs` 的方向与旋转，天空、水面和普通材质共用 `src/height-atmosphere.mjs` 的高度密度与线性散射。

同参数修改前/后、六个选项、旋转与屏幕兼容记录见 `docs/validation/sky-v2-2026-10-01/report.md`。

`2026.10-air-light` 的距离雾修订及 `docs/validation/fog-light-2026-10-01/report.md` 保留为历史记录。当前运行时以 `docs/design/height-atmosphere-spec.md` 的高度空气层为准，不改变六张图片、清单与资源哈希。旧预览源码归档在 `legacy-preview-tools/`；对应工具入口已转发至当前高度散射预览。
