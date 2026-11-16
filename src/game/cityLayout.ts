import * as THREE from 'three';
import {
  CheckpointDef,
  PedLightState,
  SurfaceZone,
} from '../types/game';
import {
  CornerPedSignalRig,
  createCornerPedestrianSignalPole,
  createRoadSign,
  createSchoolCampus,
  createStreetLamp,
  createStreetTree,
  createTrafficSignalPole,
  TrafficSignalRig,
} from './models';
import { TextureLibrary } from './textures';

export const LOOP_X = 90; // East/West street centerlines at x = ±90
export const LOOP_Z = 70; // North/South street centerlines at z = ±70
export const ROAD_HALF = 7.0; // Car road width = 14m (±7m from centerline)
export const BIKE_W = 2.4; // Dedicated bike lane width on North & South streets
export const SIDEWALK_W = 5.2; // Outer sidewalk width
export const INNER_SIDEWALK_W = 4.0;
export const CURB_HEIGHT = 0.16;
export const SIGNAL_CYCLE = 44; // 44s total cycle: 15s green + 5s blink + 2s clearance per axis

export interface CircleCollider {
  x: number;
  z: number;
  r: number;
}

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ZoneQueryResult {
  zone: SurfaceZone;
  hasBikeLaneHere: boolean;
  isWrongWay: boolean;
  inCrosswalkAxis: 'ew' | 'ns' | null; // 'ew' = crosses E-W road, 'ns' = crosses N-S road
}

export const CHECKPOINTS: CheckpointDef[] = [
  {
    id: 1,
    label: '구간 1 · 자전거도로 주행',
    hint: '남쪽 대로의 빨간색 전용 자전거도로를 따라 동쪽으로 이동하세요.',
    x: 0,
    z: 78.2,
    radius: 4.5,
  },
  {
    id: 2,
    label: '교차로 1 · 횡단보도 하차 보행',
    hint: '남동 교차로 횡단보도에서 [E]키로 하차한 뒤 녹색 신호에 끌고 건너세요.',
    x: 96.0,
    z: 52.0,
    radius: 5.0,
  },
  {
    id: 3,
    label: '구간 2 · 차도 우측 가장자리',
    hint: '자전거도로가 없는 구간입니다! 차도 우측 가장자리에 붙어 주행하세요.',
    x: 96.0,
    z: 0,
    radius: 4.5,
  },
  {
    id: 4,
    label: '교차로 2 · 횡단보도 하차 보행',
    hint: '북동 교차로 횡단보도에서 내려서 끌고 건넌 뒤 북쪽 자전거도로로 진입하세요.',
    x: 72.0,
    z: -78.2,
    radius: 5.0,
  },
  {
    id: 5,
    label: '구간 3 · 자전거도로 주행',
    hint: '북쪽 대로의 전용 자전거도로를 이용해 서쪽으로 이동하세요.',
    x: 0,
    z: -78.2,
    radius: 4.5,
  },
  {
    id: 6,
    label: '교차로 3 · 차도 우측 가장자리 합류',
    hint: '북서 교차로 횡단보도를 끌고 건넌 뒤 서쪽 차도 우측 가장자리로 합류하세요.',
    x: -96.0,
    z: -52.0,
    radius: 5.0,
  },
  {
    id: 7,
    label: '최종 목적지 · 푸른솔 학교 정문',
    hint: '남서 교차로 횡단보도를 내려서 건너면 푸른솔 학교 정문 도착 지점입니다!',
    x: -72.0,
    z: 78.2,
    radius: 5.2,
  },
];

export const SCHOOL_GOAL = { x: -72.0, z: 78.2 };

export function computeRemainingRouteMeters(
  px: number,
  pz: number,
  checkpointIndex: number,
  isMission: boolean
): number {
  if (!isMission || checkpointIndex >= CHECKPOINTS.length) {
    return Math.hypot(px - SCHOOL_GOAL.x, pz - SCHOOL_GOAL.z);
  }
  let total = Math.hypot(
    CHECKPOINTS[checkpointIndex].x - px,
    CHECKPOINTS[checkpointIndex].z - pz
  );
  for (let i = checkpointIndex; i < CHECKPOINTS.length - 1; i++) {
    total += Math.hypot(
      CHECKPOINTS[i + 1].x - CHECKPOINTS[i].x,
      CHECKPOINTS[i + 1].z - CHECKPOINTS[i].z
    );
  }
  return total;
}

// Crosswalk rectangles:
// 'ns' crosses a North-South road (x in [83..97] or [-97..-83]) -> green when E-W cars have green
// 'ew' crosses an East-West road (z in [63..77] or [-77..-63]) -> green when N-S cars have green
export interface CrosswalkRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'ew' | 'ns';
}

export const CROSSWALK_RECTS: CrosswalkRect[] = [
  // SE corner (90, 70)
  { minX: 78.2, maxX: 83.0, minZ: 63.0, maxZ: 77.0, axis: 'ew' },
  { minX: 97.0, maxX: 101.8, minZ: 63.0, maxZ: 77.0, axis: 'ew' },
  { minX: 83.0, maxX: 97.0, minZ: 58.2, maxZ: 63.0, axis: 'ns' },
  { minX: 83.0, maxX: 97.0, minZ: 77.0, maxZ: 81.8, axis: 'ns' },
  // NE corner (90, -70)
  { minX: 78.2, maxX: 83.0, minZ: -77.0, maxZ: -63.0, axis: 'ew' },
  { minX: 97.0, maxX: 101.8, minZ: -77.0, maxZ: -63.0, axis: 'ew' },
  { minX: 83.0, maxX: 97.0, minZ: -81.8, maxZ: -77.0, axis: 'ns' },
  { minX: 83.0, maxX: 97.0, minZ: -63.0, maxZ: -58.2, axis: 'ns' },
  // NW corner (-90, -70)
  { minX: -101.8, maxX: -97.0, minZ: -77.0, maxZ: -63.0, axis: 'ew' },
  { minX: -83.0, maxX: -78.2, minZ: -77.0, maxZ: -63.0, axis: 'ew' },
  { minX: -97.0, maxX: -83.0, minZ: -81.8, maxZ: -77.0, axis: 'ns' },
  { minX: -97.0, maxX: -83.0, minZ: -63.0, maxZ: -58.2, axis: 'ns' },
  // SW corner (-90, 70)
  { minX: -101.8, maxX: -97.0, minZ: 63.0, maxZ: 77.0, axis: 'ew' },
  { minX: -83.0, maxX: -78.2, minZ: 63.0, maxZ: 77.0, axis: 'ew' },
  { minX: -97.0, maxX: -83.0, minZ: 58.2, maxZ: 63.0, axis: 'ns' },
  { minX: -97.0, maxX: -83.0, minZ: 77.0, maxZ: 81.8, axis: 'ns' },
];

export function getSignalPhase(cycleTime: number): {
  ewGreen: boolean;
  ewYellow: boolean;
  nsGreen: boolean;
  nsYellow: boolean;
  ewPed: PedLightState;
  nsPed: PedLightState;
  ewPedRemaining: number;
  nsPedRemaining: number;
  blinkOn: boolean;
} {
  const t = ((cycleTime % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  const blinkOn = Math.floor(t * 3.5) % 2 === 0;

  // 0..20: EW cars Green -> NS crosswalk ('ns' axis across N-S road) is GREEN (0..15) / BLINKING (15..20)
  // 20..22: EW cars Yellow -> All ped Red (clearance)
  // 22..42: NS cars Green -> EW crosswalk ('ew' axis across E-W road) is GREEN (22..37) / BLINKING (37..42)
  // 42..44: NS cars Yellow -> All ped Red (clearance)
  let ewGreen = false;
  let ewYellow = false;
  let nsGreen = false;
  let nsYellow = false;
  let nsCrosswalkPed: PedLightState = 'red';
  let ewCrosswalkPed: PedLightState = 'red';
  let nsPedRemaining = 0;
  let ewPedRemaining = 0;

  if (t < 20) {
    ewGreen = true;
    nsCrosswalkPed = t >= 15 ? 'blinking' : 'green';
    nsPedRemaining = Math.max(1, Math.ceil(20 - t));
    ewPedRemaining = Math.max(1, Math.ceil(22 - t));
  } else if (t < 22) {
    ewYellow = true;
    nsPedRemaining = Math.max(1, Math.ceil(44 - t));
    ewPedRemaining = Math.max(1, Math.ceil(22 - t));
  } else if (t < 42) {
    nsGreen = true;
    ewCrosswalkPed = t >= 37 ? 'blinking' : 'green';
    ewPedRemaining = Math.max(1, Math.ceil(42 - t));
    nsPedRemaining = Math.max(1, Math.ceil(44 - t));
  } else {
    nsYellow = true;
    ewPedRemaining = Math.max(1, Math.ceil(44 - t + 22));
    nsPedRemaining = Math.max(1, Math.ceil(44 - t));
  }

  return {
    ewGreen,
    ewYellow,
    nsGreen,
    nsYellow,
    ewPed: ewCrosswalkPed,
    nsPed: nsCrosswalkPed,
    ewPedRemaining,
    nsPedRemaining,
    blinkOn,
  };
}

function isInIntersectionBox(x: number, z: number): boolean {
  const inX = Math.abs(Math.abs(x) - LOOP_X) <= ROAD_HALF;
  const inZ = Math.abs(Math.abs(z) - LOOP_Z) <= ROAD_HALF;
  return inX && inZ;
}

export function getCrosswalkAt(x: number, z: number): CrosswalkRect | null {
  for (let i = 0; i < CROSSWALK_RECTS.length; i++) {
    const cw = CROSSWALK_RECTS[i];
    if (x >= cw.minX && x <= cw.maxX && z >= cw.minZ && z <= cw.maxZ) {
      return cw;
    }
  }
  return null;
}

export function isNearCrosswalk(x: number, z: number, margin = 14): CrosswalkRect | null {
  let closest: CrosswalkRect | null = null;
  let closestDistSq = Infinity;
  for (let i = 0; i < CROSSWALK_RECTS.length; i++) {
    const cw = CROSSWALK_RECTS[i];
    if (
      x >= cw.minX - margin &&
      x <= cw.maxX + margin &&
      z >= cw.minZ - margin &&
      z <= cw.maxZ + margin
    ) {
      const cx = (cw.minX + cw.maxX) * 0.5;
      const cz = (cw.minZ + cw.maxZ) * 0.5;
      const dSq = (x - cx) * (x - cx) + (z - cz) * (z - cz);
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closest = cw;
      }
    }
  }
  return closest;
}

/**
 * Computes realistic surface elevation for roads (0), bike lanes (+0.025), and sidewalks (+0.16)
 * with smooth curb transitions so the player can physically climb onto sidewalks.
 */
export function getGroundHeightAt(x: number, z: number): number {
  if (isInIntersectionBox(x, z)) return 0;
  if (getCrosswalkAt(x, z)) return 0.01;

  // Check if on East-West streets (South z=+70 or North z=-70)
  const dzSouth = Math.abs(z - LOOP_Z);
  const dzNorth = Math.abs(z + LOOP_Z);
  const dxEast = Math.abs(x - LOOP_X);
  const dxWest = Math.abs(x + LOOP_X);

  // On road asphalt
  if (dzSouth <= ROAD_HALF || dzNorth <= ROAD_HALF || dxEast <= ROAD_HALF || dxWest <= ROAD_HALF) {
    return 0;
  }

  // On red bike lanes (South z in [77.0, 79.4], North z in [-79.4, -77.0])
  if (
    (z > LOOP_Z + ROAD_HALF && z <= LOOP_Z + ROAD_HALF + BIKE_W) ||
    (z < -LOOP_Z - ROAD_HALF && z >= -LOOP_Z - ROAD_HALF - BIKE_W)
  ) {
    // At corners where East/West road meets, keep curb ramp flat at crosswalk
    if (dxEast <= ROAD_HALF || dxWest <= ROAD_HALF) return 0.01;
    return 0.025;
  }

  // Smooth curb ramp up to sidewalk height (0.16m)
  const minDistToRoadEdge = Math.min(
    Math.abs(dzSouth - (ROAD_HALF + (z > LOOP_Z ? BIKE_W : 0))),
    Math.abs(dzNorth - (ROAD_HALF + (z < -LOOP_Z ? BIKE_W : 0))),
    Math.abs(dxEast - ROAD_HALF),
    Math.abs(dxWest - ROAD_HALF)
  );
  if (minDistToRoadEdge < 0.35) {
    return THREE.MathUtils.lerp(0.02, CURB_HEIGHT, minDistToRoadEdge / 0.35);
  }
  return CURB_HEIGHT;
}

/**
 * Classifies the exact traffic zone at world position (x, z) and player heading.
 * Heading convention: 0 = -Z (North), -PI/2 = +X (East), PI = +Z (South), +PI/2 = -X (West)
 * because forward vector is (-sin(heading), 0, -cos(heading)).
 */
export function getZoneInfoAt(x: number, z: number, heading: number): ZoneQueryResult {
  const cw = getCrosswalkAt(x, z);
  if (cw) {
    return {
      zone: 'crosswalk',
      hasBikeLaneHere: false,
      isWrongWay: false,
      inCrosswalkAxis: cw.axis,
    };
  }

  if (isInIntersectionBox(x, z)) {
    return {
      zone: 'intersection',
      hasBikeLaneHere: false,
      isWrongWay: false,
      inCrosswalkAxis: null,
    };
  }

  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);

  // Determine closest street segment
  const dSouth = Math.abs(z - LOOP_Z);
  const dNorth = Math.abs(z + LOOP_Z);
  const dEast = Math.abs(x - LOOP_X);
  const dWest = Math.abs(x + LOOP_X);

  const minD = Math.min(dSouth, dNorth, dEast, dWest);

  // South Street (z ≈ +70, HAS bike lane at z ∈ [77.0, 79.4], forward = +X)
  if (minD === dSouth) {
    const hasBike = Math.abs(x) < LOOP_X - ROAD_HALF || Math.abs(x) > LOOP_X + ROAD_HALF;
    if (z >= LOOP_Z + ROAD_HALF && z <= LOOP_Z + ROAD_HALF + BIKE_W && hasBike) {
      return {
        zone: 'bike_lane',
        hasBikeLaneHere: true,
        isWrongWay: fx < -0.35,
        inCrosswalkAxis: null,
      };
    }
    if (z >= LOOP_Z && z < LOOP_Z + ROAD_HALF) {
      return {
        zone: z >= LOOP_Z + 5.0 ? 'road_right_edge' : 'road_center',
        hasBikeLaneHere: hasBike,
        isWrongWay: fx < -0.35,
        inCrosswalkAxis: null,
      };
    }
    if (z < LOOP_Z && z >= LOOP_Z - ROAD_HALF) {
      // Opposing lane (Westbound) - riding East here is wrong way
      return {
        zone: fx > 0.25 ? 'wrong_way' : z <= LOOP_Z - 5.0 ? 'road_right_edge' : 'road_center',
        hasBikeLaneHere: hasBike,
        isWrongWay: fx > 0.25,
        inCrosswalkAxis: null,
      };
    }
    return {
      zone: 'sidewalk',
      hasBikeLaneHere: hasBike,
      isWrongWay: false,
      inCrosswalkAxis: null,
    };
  }

  // North Street (z ≈ -70, HAS bike lane at z ∈ [-79.4, -77.0], forward = -X)
  if (minD === dNorth) {
    const hasBike = Math.abs(x) < LOOP_X - ROAD_HALF || Math.abs(x) > LOOP_X + ROAD_HALF;
    if (z <= -LOOP_Z - ROAD_HALF && z >= -LOOP_Z - ROAD_HALF - BIKE_W && hasBike) {
      return {
        zone: 'bike_lane',
        hasBikeLaneHere: true,
        isWrongWay: fx > 0.35,
        inCrosswalkAxis: null,
      };
    }
    if (z <= -LOOP_Z && z > -LOOP_Z - ROAD_HALF) {
      return {
        zone: z <= -LOOP_Z - 5.0 ? 'road_right_edge' : 'road_center',
        hasBikeLaneHere: hasBike,
        isWrongWay: fx > 0.35,
        inCrosswalkAxis: null,
      };
    }
    if (z > -LOOP_Z && z <= -LOOP_Z + ROAD_HALF) {
      return {
        zone: fx < -0.25 ? 'wrong_way' : z >= -LOOP_Z + 5.0 ? 'road_right_edge' : 'road_center',
        hasBikeLaneHere: hasBike,
        isWrongWay: fx < -0.25,
        inCrosswalkAxis: null,
      };
    }
    return {
      zone: 'sidewalk',
      hasBikeLaneHere: hasBike,
      isWrongWay: false,
      inCrosswalkAxis: null,
    };
  }

  // East Street (x ≈ +90, NO bike lane! Forward = -Z, Right Edge = x ∈ [95.0, 97.0])
  if (minD === dEast) {
    if (x >= LOOP_X && x <= LOOP_X + ROAD_HALF) {
      return {
        zone: x >= LOOP_X + 5.0 ? 'road_right_edge' : 'road_center',
        hasBikeLaneHere: false,
        isWrongWay: fz > 0.35,
        inCrosswalkAxis: null,
      };
    }
    if (x < LOOP_X && x >= LOOP_X - ROAD_HALF) {
      return {
        zone: fz < -0.25 ? 'wrong_way' : x <= LOOP_X - 5.0 ? 'road_right_edge' : 'road_center',
        hasBikeLaneHere: false,
        isWrongWay: fz < -0.25,
        inCrosswalkAxis: null,
      };
    }
    return {
      zone: 'sidewalk',
      hasBikeLaneHere: false,
      isWrongWay: false,
      inCrosswalkAxis: null,
    };
  }

  // West Street (x ≈ -90, NO bike lane! Forward = +Z, Right Edge = x ∈ [-97.0, -95.0])
  if (x <= -LOOP_X && x >= -LOOP_X - ROAD_HALF) {
    return {
      zone: x <= -LOOP_X - 5.0 ? 'road_right_edge' : 'road_center',
      hasBikeLaneHere: false,
      isWrongWay: fz < -0.35,
      inCrosswalkAxis: null,
    };
  }
  if (x > -LOOP_X && x <= -LOOP_X + ROAD_HALF) {
    return {
      zone: fz > 0.25 ? 'wrong_way' : x >= -LOOP_X + 5.0 ? 'road_right_edge' : 'road_center',
      hasBikeLaneHere: false,
      isWrongWay: fz > 0.25,
      inCrosswalkAxis: null,
    };
  }
  return {
    zone: 'sidewalk',
    hasBikeLaneHere: false,
    isWrongWay: false,
    inCrosswalkAxis: null,
  };
}

export interface CityBuildResult {
  circleColliders: CircleCollider[];
  boxColliders: BoxCollider[];
  signalRigs: Array<{ rig: TrafficSignalRig; roadAxis: 'ew' | 'ns' }>;
  cornerPedRigs: CornerPedSignalRig[];
  checkpointGroup: THREE.Group;
  checkpointRing: THREE.Mesh;
  checkpointBeacon: THREE.Mesh;
}

export function buildCityEnvironment(
  scene: THREE.Scene,
  textures: TextureLibrary
): CityBuildResult {
  const circleColliders: CircleCollider[] = [];
  const boxColliders: BoxCollider[] = [];
  const signalRigs: Array<{ rig: TrafficSignalRig; roadAxis: 'ew' | 'ns' }> = [];
  const cornerPedRigs: CornerPedSignalRig[] = [];

  // 1. Base ground & outer grass/urban earth plane
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.grass,
    roughness: 0.92,
    metalness: 0,
  });
  const baseGround = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMat);
  baseGround.rotation.x = -Math.PI / 2;
  baseGround.position.y = -0.04;
  baseGround.receiveShadow = true;
  scene.add(baseGround);

  // 2. Sidewalk base slab covering the city district at y = CURB_HEIGHT (or recessed under roads)
  // Instead of overlapping with roads, build clean sidewalk strips alongside every street!
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalk,
    roughness: 0.85,
    metalness: 0.05,
  });
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.72,
    metalness: 0.05,
  });

  const addSidewalkSlab = (cx: number, cz: number, w: number, d: number, repX: number, repY: number) => {
    const tex = textures.sidewalk.clone();
    tex.needsUpdate = true;
    tex.repeat.set(repX, repY);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, CURB_HEIGHT, d), [
      curbMat,
      curbMat,
      mat,
      curbMat,
      curbMat,
      curbMat,
    ]);
    mesh.position.set(cx, CURB_HEIGHT / 2, cz);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };

  // Outer sidewalks (South, North, East, West) + Inner loop sidewalk ring
  addSidewalkSlab(0, LOOP_Z + ROAD_HALF + BIKE_W + SIDEWALK_W / 2, 166, SIDEWALK_W, 24, 1);
  addSidewalkSlab(0, -(LOOP_Z + ROAD_HALF + BIKE_W + SIDEWALK_W / 2), 166, SIDEWALK_W, 24, 1);
  addSidewalkSlab(LOOP_X + ROAD_HALF + SIDEWALK_W / 2, 0, SIDEWALK_W, 126, 1, 18);
  addSidewalkSlab(-(LOOP_X + ROAD_HALF + SIDEWALK_W / 2), 0, SIDEWALK_W, 126, 1, 18);

  // Corner sidewalk plazas (outer 4 corners so pedestrian routes wrap cleanly)
  const corners: [number, number][] = [
    [LOOP_X + ROAD_HALF + SIDEWALK_W / 2 + 2.5, LOOP_Z + ROAD_HALF + BIKE_W + SIDEWALK_W / 2],
    [-(LOOP_X + ROAD_HALF + SIDEWALK_W / 2 + 2.5), LOOP_Z + ROAD_HALF + BIKE_W + SIDEWALK_W / 2],
    [LOOP_X + ROAD_HALF + SIDEWALK_W / 2 + 2.5, -(LOOP_Z + ROAD_HALF + BIKE_W + SIDEWALK_W / 2)],
    [-(LOOP_X + ROAD_HALF + SIDEWALK_W / 2 + 2.5), -(LOOP_Z + ROAD_HALF + BIKE_W + SIDEWALK_W / 2)],
  ];
  corners.forEach(([cx, cz]) => {
    addSidewalkSlab(cx, cz, 12, 10, 2, 2);
  });

  // Inner block sidewalk perimeter
  addSidewalkSlab(0, LOOP_Z - ROAD_HALF - INNER_SIDEWALK_W / 2, 166, INNER_SIDEWALK_W, 24, 1);
  addSidewalkSlab(0, -(LOOP_Z - ROAD_HALF - INNER_SIDEWALK_W / 2), 166, INNER_SIDEWALK_W, 24, 1);
  addSidewalkSlab(LOOP_X - ROAD_HALF - INNER_SIDEWALK_W / 2, 0, INNER_SIDEWALK_W, 118, 1, 18);
  addSidewalkSlab(-(LOOP_X - ROAD_HALF - INNER_SIDEWALK_W / 2), 0, INNER_SIDEWALK_W, 118, 1, 18);

  // 3. Road Asphalt Segments (two-way 4-lane roads)
  const addRoadSegment = (
    cx: number,
    cz: number,
    length: number,
    horizontal: boolean
  ) => {
    const tex = textures.asphalt.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, Math.max(1, Math.round(length / 18)));
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.88,
      metalness: 0.04,
    });
    const geo = new THREE.PlaneGeometry(ROAD_HALF * 2, length);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    if (horizontal) {
      mesh.rotation.z = Math.PI / 2;
    }
    mesh.position.set(cx, 0.002, cz);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };

  // South & North roads (between intersections + outer stubs)
  addRoadSegment(0, LOOP_Z, 166, true);
  addRoadSegment(0, -LOOP_Z, 166, true);
  addRoadSegment(LOOP_X + 18, LOOP_Z, 22, true);
  addRoadSegment(-(LOOP_X + 18), LOOP_Z, 22, true);
  addRoadSegment(LOOP_X + 18, -LOOP_Z, 22, true);
  addRoadSegment(-(LOOP_X + 18), -LOOP_Z, 22, true);

  // East & West roads (between intersections + outer stubs)
  addRoadSegment(LOOP_X, 0, 126, false);
  addRoadSegment(-LOOP_X, 0, 126, false);
  addRoadSegment(LOOP_X, LOOP_Z + 18, 22, false);
  addRoadSegment(LOOP_X, -(LOOP_Z + 18), 22, false);
  addRoadSegment(-LOOP_X, LOOP_Z + 18, 22, false);
  addRoadSegment(-LOOP_X, -(LOOP_Z + 18), 22, false);

  // 4 Intersection Squares
  const interMat = new THREE.MeshStandardMaterial({
    map: textures.intersectionAsphalt,
    roughness: 0.88,
  });
  const cornerCoords: [number, number][] = [
    [LOOP_X, LOOP_Z],
    [LOOP_X, -LOOP_Z],
    [-LOOP_X, -LOOP_Z],
    [-LOOP_X, LOOP_Z],
  ];
  cornerCoords.forEach(([ix, iz]) => {
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_HALF * 2), interMat);
    sq.rotation.x = -Math.PI / 2;
    sq.position.set(ix, 0.003, iz);
    sq.receiveShadow = true;
    scene.add(sq);
  });

  // 4. Dedicated Red Bike Lanes (South Street & North Street ONLY!)
  const addBikeLane = (cx: number, cz: number, length: number, rotY: number) => {
    const tex = textures.bikeLane.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, Math.round(length / 10));
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.8,
      metalness: 0.05,
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BIKE_W, 0.025, length), mat);
    slab.position.set(cx, 0.0125, cz);
    slab.rotation.y = rotY;
    slab.receiveShadow = true;
    scene.add(slab);
  };

  // South Street bike lane (Eastbound +X, so rotY = -Math.PI/2 makes texture arrow point +X!)
  addBikeLane(0, LOOP_Z + ROAD_HALF + BIKE_W / 2, 166, -Math.PI / 2);
  // North Street bike lane (Westbound -X, so rotY = +Math.PI/2 makes texture arrow point -X!)
  addBikeLane(0, -(LOOP_Z + ROAD_HALF + BIKE_W / 2), 166, Math.PI / 2);

  // 5. Sharrow Decals on NO-Bike-Lane Roads (East & West Streets right edge!)
  const sharrowMat = new THREE.MeshStandardMaterial({
    map: textures.sharrowDecal,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  [-44, -22, 0, 22, 44].forEach((zPos) => {
    // East Street right edge (going North -Z)
    const sEast = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), sharrowMat);
    sEast.rotation.x = -Math.PI / 2;
    sEast.position.set(LOOP_X + 5.8, 0.02, zPos);
    scene.add(sEast);

    // West Street right edge (going South +Z)
    const sWest = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), sharrowMat);
    sWest.rotation.x = -Math.PI / 2;
    sWest.rotation.z = Math.PI;
    sWest.position.set(-(LOOP_X + 5.8), 0.02, zPos);
    scene.add(sWest);
  });

  // 6. Zebra Crosswalks
  const cwMat = new THREE.MeshStandardMaterial({
    map: textures.crosswalk,
    roughness: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  CROSSWALK_RECTS.forEach((cw) => {
    const w = cw.maxX - cw.minX;
    const d = cw.maxZ - cw.minZ;
    const cx = (cw.minX + cw.maxX) / 2;
    const cz = (cw.minZ + cw.maxZ) / 2;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(cw.axis === 'ew' ? d : w, cw.axis === 'ew' ? w : d),
      cwMat
    );
    mesh.rotation.x = -Math.PI / 2;
    if (cw.axis === 'ew') mesh.rotation.z = Math.PI / 2;
    mesh.position.set(cx, 0.015, cz);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  // 7. Traffic Signal Poles + Dual-Axis Pedestrian Signals at ALL 4 corners of every intersection
  cornerCoords.forEach(([ix, iz]) => {
    // Overhead vehicle signals (double-sided)
    const sigEW = createTrafficSignalPole();
    sigEW.root.position.set(ix - 8.2, CURB_HEIGHT, iz + 8.5);
    sigEW.root.rotation.y = -Math.PI / 2;
    scene.add(sigEW.root);
    signalRigs.push({ rig: sigEW, roadAxis: 'ew' });

    const sigNS = createTrafficSignalPole();
    sigNS.root.position.set(ix + 8.5, CURB_HEIGHT, iz + 8.2);
    sigNS.root.rotation.y = 0;
    scene.add(sigNS.root);
    signalRigs.push({ rig: sigNS, roadAxis: 'ns' });

    // Dedicated dual-axis corner pedestrian signals at all 4 corners of the intersection
    const cornerOffsets: [number, number][] = [
      [-8.1, 8.1],
      [8.1, 8.1],
      [8.1, -8.1],
      [-8.1, -8.1],
    ];
    cornerOffsets.forEach(([ox, oz]) => {
      const px = ix + ox;
      const pz = iz + oz;
      const pedPole = createCornerPedestrianSignalPole();
      pedPole.root.position.set(px, CURB_HEIGHT, pz);
      scene.add(pedPole.root);
      cornerPedRigs.push(pedPole);
      circleColliders.push({ x: px, z: pz, r: 0.25 });
    });
  });

  // 8. Korean Traffic Rule Signs (placed cleanly on sidewalks so they teach visually!)
  const placeSign = (
    type: keyof TextureLibrary['signs'],
    x: number,
    z: number,
    rotY: number
  ) => {
    const sign = createRoadSign(textures.signs[type]);
    sign.position.set(x, CURB_HEIGHT, z);
    sign.rotation.y = rotY;
    scene.add(sign);
    circleColliders.push({ x, z, r: 0.35 });
  };

  // South Street signs
  placeSign('bike_lane', -55, 80.2, -Math.PI / 2);
  placeSign('no_sidewalk', -18, 80.6, -Math.PI / 2);
  placeSign('crosswalk_walk', 75, 80.2, -Math.PI / 2);

  // East Street signs
  placeSign('bike_end', 98.0, 50, Math.PI);
  placeSign('no_sidewalk', 98.4, 15, Math.PI);
  placeSign('crosswalk_walk', 98.0, -54, Math.PI);

  // North Street signs
  placeSign('bike_lane', 55, -80.2, Math.PI / 2);
  placeSign('no_sidewalk', 18, -80.6, Math.PI / 2);
  placeSign('crosswalk_walk', -75, -80.2, Math.PI / 2);

  // West Street signs
  placeSign('bike_end', -98.0, -50, 0);
  placeSign('no_sidewalk', -98.4, -15, 0);
  placeSign('crosswalk_walk', -98.0, 54, 0);

  // 9. Streetlights & Trees along sidewalks (carefully placed clear of riding lanes!)
  for (let x = -64; x <= 64; x += 32) {
    // South outer sidewalk
    const lampS = createStreetLamp();
    lampS.position.set(x, CURB_HEIGHT, 83.2);
    scene.add(lampS);
    circleColliders.push({ x, z: 83.2, r: 0.3 });

    const treeS = createStreetTree(Math.abs(x));
    treeS.position.set(x + 14, CURB_HEIGHT, 83.4);
    scene.add(treeS);
    circleColliders.push({ x: x + 14, z: 83.4, r: 0.55 });

    // North outer sidewalk
    const lampN = createStreetLamp();
    lampN.position.set(x, CURB_HEIGHT, -83.2);
    lampN.rotation.y = Math.PI;
    scene.add(lampN);
    circleColliders.push({ x, z: -83.2, r: 0.3 });

    const treeN = createStreetTree(Math.abs(x) + 1);
    treeN.position.set(x - 14, CURB_HEIGHT, -83.4);
    scene.add(treeN);
    circleColliders.push({ x: x - 14, z: -83.4, r: 0.55 });
  }

  for (let z = -44; z <= 44; z += 28) {
    const lampE = createStreetLamp();
    lampE.position.set(101.4, CURB_HEIGHT, z);
    lampE.rotation.y = Math.PI / 2;
    scene.add(lampE);
    circleColliders.push({ x: 101.4, z, r: 0.3 });

    const lampW = createStreetLamp();
    lampW.position.set(-101.4, CURB_HEIGHT, z);
    lampW.rotation.y = -Math.PI / 2;
    scene.add(lampW);
    circleColliders.push({ x: -101.4, z, r: 0.3 });
  }

  // 10. Urban City Buildings (Inner Block + Outer Skyline Perimeter)
  const addBuilding = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    texIdx: number
  ) => {
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const facadeMat = new THREE.MeshStandardMaterial({
      map: textures.buildings[texIdx % textures.buildings.length],
      roughness: 0.45,
      metalness: 0.15,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
      facadeMat,
      facadeMat,
      roofMat,
      roofMat,
      facadeMat,
      facadeMat,
    ]);
    b.position.set(cx, CURB_HEIGHT + h / 2, cz);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);

    // Roof parapet detail
    const penthouse = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.45, 2.2, d * 0.45),
      roofMat
    );
    penthouse.position.set(cx, CURB_HEIGHT + h + 1.1, cz);
    scene.add(penthouse);

    boxColliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
  };

  // Inner city block buildings (leaving a central green park plaza in the middle!)
  const innerBuildings: [number, number, number, number, number, number][] = [
    [-56, 40, 26, 22, 24, 0],
    [-22, 42, 24, 18, 18, 1],
    [22, 42, 26, 18, 28, 2],
    [56, 40, 26, 22, 22, 3],
    [-56, -40, 26, 22, 26, 2],
    [-22, -42, 24, 18, 20, 0],
    [22, -42, 26, 18, 24, 3],
    [56, -40, 26, 22, 30, 1],
    [-58, 0, 22, 30, 22, 1],
    [58, 0, 22, 30, 26, 0],
  ];
  innerBuildings.forEach(([x, z, w, d, h, t]) => addBuilding(x, z, w, d, h, t));

  // Central park trees inside inner block
  [
    [-16, 0],
    [16, 0],
    [0, 14],
    [0, -14],
    [-28, 12],
    [28, -12],
  ].forEach(([tx, tz], i) => {
    const t = createStreetTree(i);
    t.position.set(tx, 0, tz);
    t.scale.setScalar(1.35);
    scene.add(t);
  });

  // Outer perimeter buildings (natural city boundary beyond sidewalks!)
  for (let x = -110; x <= 110; x += 34) {
    if (x === -76) {
      // Dedicated School Campus ("푸른솔 학교 정문") facing the South bike lane
      const school = createSchoolCampus(textures.schoolBanner, textures.buildings[0]);
      school.position.set(-74, CURB_HEIGHT, 95.5);
      scene.add(school);
      boxColliders.push({
        minX: -86,
        maxX: -62,
        minZ: 96.5,
        maxZ: 105.5,
      });
      circleColliders.push({ x: -78.4, z: 85.7, r: 0.7 });
      circleColliders.push({ x: -69.6, z: 85.7, r: 0.7 });
    } else {
      addBuilding(x, 102, 26, 24, 22 + ((Math.abs(x) * 7) % 18), Math.abs(x));
    }
    addBuilding(x, -102, 26, 24, 24 + ((Math.abs(x) * 5) % 18), Math.abs(x) + 1);
  }
  for (let z = -68; z <= 68; z += 34) {
    addBuilding(120, z, 24, 26, 22 + ((Math.abs(z) * 7) % 18), Math.abs(z) + 2);
    addBuilding(-120, z, 24, 26, 24 + ((Math.abs(z) * 5) % 18), Math.abs(z) + 3);
  }

  // Road barriers at stub ends so player stays inside the main district naturally
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
  const addStubBarrier = (x: number, z: number, horizontal: boolean) => {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? 14 : 1.0, 1.0, horizontal ? 1.0 : 14),
      barrierMat
    );
    b.position.set(x, 0.5, z);
    b.castShadow = true;
    scene.add(b);
    boxColliders.push({
      minX: x - (horizontal ? 7 : 0.6),
      maxX: x + (horizontal ? 7 : 0.6),
      minZ: z - (horizontal ? 0.6 : 7),
      maxZ: z + (horizontal ? 0.6 : 7),
    });
  };
  addStubBarrier(118, 70, false);
  addStubBarrier(-118, 70, false);
  addStubBarrier(118, -70, false);
  addStubBarrier(-118, -70, false);
  addStubBarrier(90, 98, true);
  addStubBarrier(90, -98, true);
  addStubBarrier(-90, 98, true);
  addStubBarrier(-90, -98, true);

  // 11. Active Checkpoint Glowing Ring + Floating Pillar
  const checkpointGroup = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.85,
  });
  const checkpointRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.14, 12, 32).rotateX(Math.PI / 2),
    ringMat
  );
  checkpointRing.position.y = 0.18;
  checkpointGroup.add(checkpointRing);

  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const checkpointBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 8.5, 24, 1, true),
    beaconMat
  );
  checkpointBeacon.position.y = 4.25;
  checkpointGroup.add(checkpointBeacon);
  scene.add(checkpointGroup);

  return {
    circleColliders,
    boxColliders,
    signalRigs,
    cornerPedRigs,
    checkpointGroup,
    checkpointRing,
    checkpointBeacon,
  };
}
