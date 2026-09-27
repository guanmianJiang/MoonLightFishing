import bpy
import math
import os
import sys


def image_node(nodes, path, colorspace):
    image = bpy.data.images.load(path, check_existing=False)
    image.scale(1024, 1024)
    image.colorspace_settings.name = colorspace
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    return node


def main():
    source, out_dir = sys.argv[sys.argv.index("--") + 1:]
    os.makedirs(out_dir, exist_ok=True)
    source_dir = os.path.dirname(source)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=source)
    model = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")

    # Web LOD: retain the authored silhouette and plank damage while keeping the
    # model light enough for mobile browsers.
    bpy.context.view_layer.objects.active = model
    model.select_set(True)
    decimate = model.modifiers.new("WebLOD", "DECIMATE")
    decimate.ratio = 0.34
    decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    bpy.ops.object.shade_smooth_by_angle()

    # Normalize the long axis to 3.35 m and place the hull at the origin.
    scale = 3.35 / max(model.dimensions)
    model.scale = [scale, scale, scale]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    model.name = "GF_RowBoat_335_A"
    model.data.name = "GF_RowBoat_335_A_Mesh"

    material = bpy.data.materials.new("M_RowBoat_PBR")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    base = image_node(nodes, os.path.join(source_dir, "texture_pbr_20250901.png"), "sRGB")
    normal = image_node(nodes, os.path.join(source_dir, "texture_pbr_20250901_normal.png"), "Non-Color")
    rough = image_node(nodes, os.path.join(source_dir, "texture_pbr_20250901_roughness.png"), "Non-Color")
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.72
    links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    model.data.materials.clear()
    model.data.materials.append(material)

    # Consistent neutral preview for visual QA.
    world = bpy.context.scene.world or bpy.data.worlds.new("PreviewWorld")
    bpy.context.scene.world = world
    world.color = (0.035, 0.045, 0.05)
    bpy.ops.object.light_add(type="AREA", location=(4, -5, 6))
    key = bpy.context.object
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = 4
    bpy.ops.object.light_add(type="AREA", location=(-4, 1, 3))
    bpy.context.object.data.energy = 420
    bpy.context.object.data.size = 3
    bpy.ops.object.camera_add(location=(4.8, -5.3, 3.4))
    camera = bpy.context.object
    direction = model.location - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 58
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(out_dir, "gf_rowboat_335_a_preview.png")
    scene.render.film_transparent = True
    bpy.ops.render.render(write_still=True)

    # Save an editable source, then export only the model as a compact GLB.
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "gf_rowboat_335_a.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    model.select_set(True)
    bpy.context.view_layer.objects.active = model
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out_dir, "gf_rowboat_335_a.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_image_format="WEBP",
        export_image_add_webp=True,
        export_image_webp_fallback=False,
    )


if __name__ == "__main__":
    main()
