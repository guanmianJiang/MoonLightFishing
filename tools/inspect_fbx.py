import bpy
import json
import sys


def main():
    source = sys.argv[sys.argv.index("--") + 1]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=source)
    meshes = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        meshes.append({
            "name": obj.name,
            "vertices": len(obj.data.vertices),
            "polygons": len(obj.data.polygons),
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "dimensions": [round(v, 4) for v in obj.dimensions],
        })
    print("ASSET_SUMMARY=" + json.dumps({"source": source, "meshes": meshes}, ensure_ascii=False))


if __name__ == "__main__":
    main()
