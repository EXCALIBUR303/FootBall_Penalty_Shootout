/**
 * Inline SVG of a team's shirt (same colours and pattern the players wear), used as the team badge in the
 * setup screen, scoreboard and end screen. Decorative: always paired with the team name in text.
 * @param {{ shirt: string, shirt2?: string, trim?: string, pattern?: string }} kit
 */
let uid = 0;
export function shirtIcon(kit, { size = 40, className = '' } = {}) {
  const id = `kit${++uid}`;
  const accent = kit.shirt2 ?? kit.trim ?? kit.shirt;
  const pattern = {
    stripes: `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${kit.shirt}"/><rect x="5" width="5" height="10" fill="${accent}"/></pattern>`,
    hoops: `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${kit.shirt}"/><rect y="5" width="10" height="5" fill="${accent}"/></pattern>`,
    sash: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0.43" stop-color="${kit.shirt}"/><stop offset="0.43" stop-color="${accent}"/><stop offset="0.57" stop-color="${accent}"/><stop offset="0.57" stop-color="${kit.shirt}"/></linearGradient>`,
  }[kit.pattern];
  const fill = pattern ? `url(#${id})` : kit.shirt;
  const trim = kit.trim ?? accent;
  return `<svg class="shirt ${className}" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    ${pattern ? `<defs>${pattern}</defs>` : ''}
    <path d="M14 4 L8 6 L2 13 L7 18 L10 15 L10 36 L30 36 L30 15 L33 18 L38 13 L32 6 L26 4 Q20 9 14 4 Z" fill="${fill}" stroke="rgb(0 0 0 / 0.35)" stroke-width="1" stroke-linejoin="round"/>
    <path d="M10 35 L30 35" stroke="${trim}" stroke-width="1.5"/>
    <text x="20" y="25" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="900" fill="${trim}" stroke="${kit.shirt}" stroke-width="0.4">9</text>
    <path d="M14 4 Q20 9 26 4" fill="none" stroke="${trim}" stroke-width="2" stroke-linecap="round"/>
    <path d="M2 13 L7 18" stroke="${trim}" stroke-width="2"/><path d="M38 13 L33 18" stroke="${trim}" stroke-width="2"/>
  </svg>`;
}
