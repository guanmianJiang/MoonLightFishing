// Development-only composition capture; never reads or writes the player's save.
import './create-fight-status-preview.mjs';
import {readFile, writeFile} from 'node:fs/promises';
const source = new URL('../src/__fight-status-preview.html', import.meta.url);
const html = (await readFile(source, 'utf8'))
  .replace("$('#fight').hidden=false;$('#fightControl').hidden=false;", "$('#fight').hidden=true;$('#fightControl').hidden=true;")
  .replace('</style>', '#previewControls,#previewShow{display:none!important}</style>');
await writeFile(new URL('../src/__reel-design-scene.html', import.meta.url), html);
console.log('Created src/__reel-design-scene.html for the control design background.');
