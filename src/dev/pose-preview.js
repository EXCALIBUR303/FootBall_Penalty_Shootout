// Dev-only: freeze a player at a moment of a move to check authored clips.
//   ?pose=low&side=1&t=0.42   keeper low dive to +X at 0.42 s   (kinds: low, high, block, jump, ready)
//   ?pose=kick&t=0.28         striker at ball contact
export function applyPosePreview(world, params) {
  const kind = params.get('pose');
  const t = Number(params.get('t') ?? 0.4);
  const { keeper, striker, camera, ball } = world;
  const step = (actor, total) => { for (let s = 0; s < total; s += 1 / 120) actor.update(1 / 120); };
  if (kind === 'kick') {
    striker.runUp(ball.position, () => {}, 1.0);
    step(striker, 1.0 + t);
    camera.position.set(4, 1.4, 11.2);
    camera.lookAt(striker.root.position.x, 0.9, striker.root.position.z);
  } else {
    if (kind !== 'ready') keeper.dive({ kind, side: Number(params.get('side') ?? 1), reach: 1.6 });
    step(keeper, t);
    camera.position.set(0, 1.3, 6.5);
    camera.lookAt(0, 1.0, 0);
  }
  // freeze
  keeper.update = () => {};
  striker.update = () => {};
}
