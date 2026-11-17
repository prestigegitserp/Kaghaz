"""Targeted stock camera review from the saved authored scene; does not re-export models."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
s=bpy.context.scene;c=s.camera
c.location=(2.8,-1.7,2.2);c.rotation_euler=(Vector((2.45,.8,.7))-c.location).to_track_quat('-Z','Y').to_euler();c.data.lens=48
s.render.filepath=str(root/'.asset-build/renders/stock-and-roll.png')
bpy.ops.render.render(write_still=True)
