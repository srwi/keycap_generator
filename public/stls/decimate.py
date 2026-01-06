# This script is meant to be run in Blender script mode (tested with Blender 5.0)

import bpy
import os

input_dir = "/path/to/input_stl"
output_dir = "/path/to/output_stl"
decimate_ratio = 0.3

def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

clean_scene()

for root, _, files in os.walk(input_dir):
    rel_dir = os.path.relpath(root, input_dir)
    out_dir = os.path.join(output_dir, rel_dir)
    os.makedirs(out_dir, exist_ok=True)

    for filename in files:
        if not filename.lower().endswith(".stl"):
            continue

        in_path = os.path.join(root, filename)
        out_path = os.path.join(out_dir, filename)

        bpy.ops.wm.stl_import(filepath=in_path)
        obj = bpy.context.selected_objects[0]

        mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
        mod.ratio = decimate_ratio
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)

        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

        bpy.ops.wm.stl_export(filepath=out_path)

        bpy.ops.object.delete()
