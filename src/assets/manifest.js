// Single list of everything the game loads. To swap a model, drop a new GLB at the same path
// (or change `url`) — nothing else in the code refers to file names.
//
// Pitch space (metres): goal line at z = 0, goal faces +z, penalty spot at z = 11, x is left/right, y is up.

/**
 * @typedef {{ id: string, type: 'glb' | 'hdr' | 'image', url: string, label: string, optional?: boolean }} AssetEntry
 * optional: the game works without it (logged, not shown as an error).
 */

/** @type {AssetEntry[]} */
export const GAME_ASSETS = [
  // Lighting: a small HDR (it is blurred into the environment map anyway).
  { id: 'hdri', type: 'hdr', url: 'assets/hdri/stadium_01_1k.hdr', label: 'lighting' },
  // What you see: the same panorama as a sharp, tonemapped 4K photo (projected onto the pitch and stands).
  { id: 'backdrop', type: 'image', url: 'assets/hdri/stadium_01_bg_4k.jpg', label: 'stadium', optional: true },
  { id: 'stadium', type: 'glb', url: 'assets/models/stadium.glb', label: 'stadium', optional: true }, // HDRI covers it
  { id: 'goal', type: 'glb', url: 'assets/models/goal.glb', label: 'goal', optional: true }, // CC0 soccerGoal; the physics goal exists regardless
  { id: 'ball', type: 'glb', url: 'assets/models/ball.glb', label: 'ball' },
  // One Quaternius rig serves both players; the scene clones it per role and tints the kit.
  { id: 'character', type: 'glb', url: 'assets/models/character.glb', label: 'players' },
];

// Pipeline smoke test (`?test=1`): Khronos sample models stand in for keeper and striker so the
// loader, Draco, skinning and animation can be checked before the real assets are downloaded.
// These never ship — `npm run assets` skips assets/raw/khronos unless --test is passed.
/** @type {AssetEntry[]} */
export const TEST_ASSETS = [
  { id: 'keeper', type: 'glb', url: 'assets/models/Fox.glb', label: 'test keeper (Fox)' },
  { id: 'striker', type: 'glb', url: 'assets/models/CesiumMan.glb', label: 'test striker (CesiumMan)' },
];

/** Target real-world sizes used to normalise whatever model is dropped in (metres). */
export const TARGET_SIZE = {
  goalOuterWidth: 7.56, // 7.32 m between the posts + two 12 cm posts
  ballDiameter: 0.22,
  keeperHeight: 1.88,
  strikerHeight: 1.80,
};

export const PITCH = { penaltySpotZ: 11, ballRadius: 0.11 };
