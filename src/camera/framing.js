/** Preserve enough horizontal field on portrait screens to see the striker, ball and full goal. */
export function fitPortraitFov(base, aspect) {
  if (aspect >= 1.1) return base;
  const radians = base * Math.PI / 180;
  return Math.min(85, 2 * Math.atan(Math.tan(radians / 2) * 1.1 / Math.max(0.1, aspect)) * 180 / Math.PI);
}
