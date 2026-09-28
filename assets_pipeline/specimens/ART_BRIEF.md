# Specimen collection art brief

Art-directed stylized models for the seven living catches in Moonwater Fishing.
The supplied game references establish the soft faceted style, readable silhouettes,
and restrained aquatic palette. Each species must remain recognizable at the small
result-viewer size without relying on a name label.

- carp: deep silver body, warm fins, large regular scales;
- minnow: narrow silver-blue body, forked translucent tail, bright lateral stripe;
- shrimp: segmented coral shell, long antennae, fan tail and walking legs;
- perch: compact olive predator, red fins and four dark bars;
- catfish: broad flat head, long body, whiskers and subdued mottling;
- oldgold: massive gold carp, darker dorsal ridge and visibly damaged tail;
- moon: tall crescent-like silver body, luminous blue edge accents.

Models use metre-like normalized authoring units, +X nose-forward orientation and a
body-centred pivot. Palette PBR materials are embedded in GLB files. The runtime
animates a named Tail group where present. These are art-directed assets, not a
skeletal production rig or baked texture set.

Every exported catch GLB must include one non-rendering node named `MouthAnchor` at
the mouth rim (+X head, before runtime rotation). Keep the `{id}_Tail` node and
body-centred pivot. Never infer the mouth from overall bounds: whiskers, antennae,
fins and asymmetrical tails make those bounds species-dependent. Add the anchor in
`tools/generate_specimens.py` and let the asset tests reject missing exports.
