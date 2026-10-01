import './create-height-atmosphere-preview.mjs';
import { copyFile } from 'node:fs/promises';
await copyFile('src/__height-atmosphere-preview.html', 'src/__fog-preview.html');
console.log('旧距离雾预览入口已转发至当前高度散射模型。');
