"""Read asset pixels and demonstrate the old normal cutoff; no UI or render capture."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

source = Path('public/assets/Tex_Water_Normal_07.png')
pixels = np.asarray(Image.open(source).convert('RGB'), dtype=np.float64) / 255.0
height, width, _ = pixels.shape

def box_filter(data, x_radius, y_radius):
    # Periodic box average approximates an anisotropic UV footprint. This is
    # a diagnostic, not an implementation of a driver's anisotropic sampler.
    expanded = np.pad(data, ((y_radius, y_radius), (x_radius, x_radius), (0, 0)), mode='wrap')
    summed = np.pad(expanded.cumsum(0).cumsum(1), ((1, 0), (1, 0), (0, 0)))
    dx, dy = x_radius * 2 + 1, y_radius * 2 + 1
    return (summed[dy:, dx:] - summed[:-dy, dx:] - summed[dy:, :-dx] + summed[:-dy, :-dx]) / (dx * dy)

def metrics(data):
    decoded = data * 2 - 1
    # Normalization cancels in component/up ratio above the safe floor.
    length = np.linalg.norm(decoded, axis=2, keepdims=True)
    unit = decoded / np.maximum(length, 1e-9)
    slopes = -unit[:, :, :2] / np.maximum(unit[:, :, 2:3], .38)
    return {'slope_rms': float(np.sqrt(np.mean(np.sum(slopes ** 2, axis=2)))),
            'slope_mean': slopes.mean((0, 1)).tolist(),
            'slope_std': slopes.std((0, 1)).tolist()}

window = {'x_texels': 9, 'y_texels': 97}
filtered = box_filter(pixels, 4, 48)
normal_uv_scale = .276  # Recorded illustrative UV scale; not screenshot state.
world_footprint = window['y_texels'] / (height * normal_uv_scale)
result = {'asset': source.as_posix(), 'size': [width, height],
          'raw': metrics(pixels), 'anisotropic_box': {**window, **metrics(filtered)},
          'illustrative_uv_scale': normal_uv_scale,
          'illustrative_world_footprint_metres': world_footprint,
          'old_extra_fade_at_this_footprint': 0 if world_footprint >= .32 else None,
          'limit': 'Asset-only periodic box diagnostic, not GPU sampling or a recreation of the screenshot.'}
assert world_footprint > .32 and result['anisotropic_box']['slope_rms'] > .001
destination = Path('docs/validation/water-normal-filter-2026-10-01')
destination.mkdir(parents=True, exist_ok=True)
(destination / 'normal-filter-metrics.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
