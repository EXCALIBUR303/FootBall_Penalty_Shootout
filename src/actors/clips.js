// Keyframed clips the free Quaternius library doesn't include, authored for its rig (see pose.js).
// Character space: X = character's left, Y = up, Z = forward (towards the camera for the keeper).
// Angles are degrees relative to the rig's T-pose rest.
//
// Handy sign reminders (from the rest T-pose):
//   upperarm_l [['z', +a]] raises the left arm,  upperarm_r [['z', -a]] raises the right arm
//   upperarm_l [['y', -a]] swings the left arm forward, upperarm_r [['y', +a]] the right arm
//   thigh [['x', -a]] lifts the knee forwards,  [['x', +a]] swings the leg back
//   calf [['x', +a]] bends the knee,  spine [['x', +a]] leans forward,  spine [['z', -a]] bends to the left (+X)

const ARMS_DOWN = { upperarm_l: [['z', -68]], upperarm_r: [['z', 68]] };

// Goalkeeper "set" position: on the toes, knees soft, hands out low and wide.
export const READY = {
  name: 'GK_Ready',
  duration: 1.2,
  keys: [0, 0.6, 1.2].map((t, i) => ({
    t,
    pose: {
      spine_01: [['x', 10]],
      spine_02: [['x', 6 + (i === 1 ? 2 : 0)]], // slight breathing bob
      upperarm_l: [['z', -45], ['y', -25]],
      upperarm_r: [['z', 45], ['y', 25]],
      lowerarm_l: [['y', -25]],
      lowerarm_r: [['y', 25]],
      thigh_l: [['x', -22], ['z', 6]],
      thigh_r: [['x', -22], ['z', -6]],
      calf_l: [['x', 40]],
      calf_r: [['x', 40]],
      foot_l: [['x', -18]],
      foot_r: [['x', -18]],
    },
  })),
};

// Low dive to the keeper's LEFT (+X). Mirrored at runtime for the other side.
// Root motion (sideways travel, rise and the body roll onto the side) is applied in code by Keeper.
const diveStretch = (high) => ({
  spine_01: [['z', high ? -6 : -10]],
  spine_02: [['z', high ? -6 : -10]],
  spine_03: [['z', -6]],
  neck_01: [['z', -8]],
  // Both arms go overhead along the body line. In a dive to the left the body rolls onto its left
  // side, so an arm left "out to the side" would point at the grass, not the corner.
  upperarm_l: [['z', high ? 112 : 106]], // lead arm
  upperarm_r: [['z', high ? -78 : -82]], // trail arm closes in beside it
  lowerarm_l: [['y', -6]],
  lowerarm_r: [['y', 6]],
  thigh_l: [['z', 18]],
  thigh_r: [['z', 4], ['x', 12]],
  calf_r: [['x', 45]],
  foot_l: [['x', 20]],
  foot_r: [['x', 20]],
});

const diveLoad = {
  spine_01: [['x', 14]],
  upperarm_l: [['z', -20], ['y', -30]],
  upperarm_r: [['z', 20], ['y', 30]],
  thigh_l: [['x', -40], ['z', 10]],
  thigh_r: [['x', -30]],
  calf_l: [['x', 70]],
  calf_r: [['x', 55]],
};

const landed = (high) => ({
  ...diveStretch(high),
  upperarm_l: [['z', 100], ['y', -20]],
  upperarm_r: [['z', -70]],
  thigh_r: [['x', -20]],
  calf_r: [['x', 70]],
});

export const DIVE_LOW = {
  name: 'GK_DiveLow_L',
  duration: 1.6,
  keys: [
    { t: 0, pose: READY.keys[0].pose },
    { t: 0.12, pose: diveLoad },
    { t: 0.42, pose: diveStretch(false) },
    { t: 0.9, pose: diveStretch(false) },
    { t: 1.6, pose: landed(false) },
  ],
};

// High dive = parry: higher, more vertical, top hand reaching up into the corner.
export const DIVE_HIGH = {
  name: 'GK_DiveHigh_L',
  duration: 1.7,
  keys: [
    { t: 0, pose: READY.keys[0].pose },
    { t: 0.12, pose: diveLoad },
    { t: 0.45, pose: diveStretch(true) },
    { t: 0.85, pose: diveStretch(true) },
    { t: 1.7, pose: landed(true) },
  ],
};

// Centre, low/medium: drop into a block with the hands together in front of the body.
const blockPose = {
  spine_01: [['x', 28]],
  spine_02: [['x', 10]],
  upperarm_l: [['y', -78], ['x', 30]],
  upperarm_r: [['y', 78], ['x', 30]],
  lowerarm_l: [['y', -20]],
  lowerarm_r: [['y', 20]],
  thigh_l: [['x', -62], ['z', 10]],
  thigh_r: [['x', -62], ['z', -10]],
  calf_l: [['x', 95]],
  calf_r: [['x', 95]],
  foot_l: [['x', -30]],
  foot_r: [['x', -30]],
};
export const BLOCK = {
  name: 'GK_Block',
  duration: 1.4,
  keys: [
    { t: 0, pose: READY.keys[0].pose },
    { t: 0.22, pose: blockPose },
    { t: 1.4, pose: blockPose },
  ],
};

// Centre, high: spring straight up with both hands above the head.
const jumpUp = {
  upperarm_l: [['z', 96], ['y', -12]],
  upperarm_r: [['z', -96], ['y', 12]],
  thigh_l: [['x', -10]],
  thigh_r: [['x', -25]],
  calf_r: [['x', 40]],
  foot_l: [['x', 25]],
  foot_r: [['x', 25]],
};
export const JUMP = {
  name: 'GK_Jump',
  duration: 1.3,
  keys: [
    { t: 0, pose: READY.keys[0].pose },
    { t: 0.12, pose: diveLoad },
    { t: 0.38, pose: jumpUp },
    { t: 0.8, pose: jumpUp },
    { t: 1.3, pose: READY.keys[0].pose },
  ],
};

// Striker: right-footed instep drive. Ball contact happens at KICK_CONTACT seconds into the clip.
export const KICK_CONTACT = 0.28;
export const KICK = {
  name: 'ST_Kick',
  duration: 0.9,
  keys: [
    { t: 0, pose: { ...ARMS_DOWN, thigh_r: [['x', 15]], calf_r: [['x', 30]] } },
    {
      t: 0.13, // backswing; plant foot (left) loads
      pose: {
        spine_01: [['x', 6], ['y', -10]],
        upperarm_l: [['z', -30], ['y', -40]],
        upperarm_r: [['z', 40], ['y', 20]],
        thigh_l: [['x', -12]],
        calf_l: [['x', 28]],
        thigh_r: [['x', 42]],
        calf_r: [['x', 88]],
        foot_r: [['x', 30]],
      },
    },
    {
      t: KICK_CONTACT, // contact: knee over the ball, ankle locked
      pose: {
        spine_01: [['x', -6], ['y', 6]],
        upperarm_l: [['z', -25], ['y', -20]],
        upperarm_r: [['z', 50], ['y', -10]],
        thigh_l: [['x', -14]],
        calf_l: [['x', 26]],
        thigh_r: [['x', -28]],
        calf_r: [['x', 18]],
        foot_r: [['x', 35]],
      },
    },
    {
      t: 0.48, // follow-through
      pose: {
        spine_01: [['x', -12], ['y', 14]],
        upperarm_l: [['z', -30], ['y', 10]],
        upperarm_r: [['z', 55], ['y', -30]],
        thigh_l: [['x', -6]],
        calf_l: [['x', 12]],
        thigh_r: [['x', -78]],
        calf_r: [['x', 6]],
        foot_r: [['x', 30]],
      },
    },
    { t: 0.9, pose: { ...ARMS_DOWN, thigh_r: [['x', -15]], calf_r: [['x', 20]] } },
  ],
};

export const AUTHORED = [READY, DIVE_LOW, DIVE_HIGH, BLOCK, JUMP, KICK];
