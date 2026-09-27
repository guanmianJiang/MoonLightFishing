import {writeFileSync} from 'node:fs';
import {coastGeometry} from '../src/coast.js';
const g=coastGeometry();
writeFileSync(new URL('../assets_pipeline/terrain/positions.bin',import.meta.url),Buffer.from(g.attributes.position.array.buffer));
writeFileSync(new URL('../assets_pipeline/terrain/indices.bin',import.meta.url),Buffer.from(g.index.array.buffer));
