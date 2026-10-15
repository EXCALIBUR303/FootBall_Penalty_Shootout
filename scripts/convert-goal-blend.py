# Dev-only: Blender (the `bpy` PyPI module, installed in a throwaway venv, not a project dependency) script that
# produced assets/raw/goal/goal.glb from the CC0 "soccerGoal" .blend. Usage: python scripts/convert-goal-blend.py soccerGoalNormal.blend out.glb
# then `node scripts/optimize-assets.mjs assets/raw/goal/goal.glb`.
# Converts almaPerdida's "soccerGoal" (CC0, OpenGameArt) into a game-ready GLB in pitch space:
# goal line at z=0, net extending to -z (goal faces +z), centred on x=0, ground at y=0.
import bpy, bmesh, sys, math, mathutils
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
for o in list(bpy.data.objects):
    if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
M = mathutils.Matrix.Rotation(math.pi, 4, 'Z') @ mathutils.Matrix.Translation((-3.66, 0.0, 1.21))
dg = bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
    e = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(e)   # bakes the decimate modifier
    o.modifiers.clear()
    o.data = me
    if o.name == 'soccerGoal':
        # The source has two free-standing poles ~1.4 m outside the posts (and 3.5 m deep); drop them.
        bm = bmesh.new(); bm.from_mesh(me)
        stray = [v for v in bm.verts if (lambda w: w.x < -0.6 or w.x > 8.0 or w.y < -2.0)(o.matrix_world @ v.co)]  # world coordinates
        print("REMOVING", len(stray), "of", len(bm.verts))
        bmesh.ops.delete(bm, geom=stray, context='VERTS')
        bm.to_mesh(me); bm.free()
    me.transform(M @ o.matrix_world)
    o.matrix_world = mathutils.Matrix.Identity(4)
for o in bpy.data.objects:
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    print("BOUNDS", o.name, [round(min(v[i] for v in bb), 2) for i in range(3)], [round(max(v[i] for v in bb), 2) for i in range(3)])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True)
print("EXPORTED", out)
