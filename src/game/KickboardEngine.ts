import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from '../audio/soundEngine';
import {
  CameraPreset,
  CitationTicket,
  createDefaultCustomPixels,
  GameMode,
  GamePhase,
  PedLightState,
  RuleStatus,
  SCOOTER_SPECS,
  ScooterType,
  TelemetrySnapshot,
  VIOLATION_RULES,
  ViolationCode,
} from '../types/game';
import {
  buildCityEnvironment,
  CHECKPOINTS,
  CityBuildResult,
  computeRemainingRouteMeters,
  getGroundHeightAt,
  getSignalPhase,
  getZoneInfoAt,
  isNearCrosswalk,
  LOOP_X,
  LOOP_Z,
} from './cityLayout';
import {
  BicycleRig,
  createBicycleRig,
  createKickboardRig,
  createMotorcycleRig,
  createPedestrian,
  createPetRig,
  createPhoneWalkerRig,
  createPoliceCarRig,
  createRoadRock,
  createTrafficCar,
  createWaterPuddle,
  KickboardRig,
  MotorcycleRig,
  PetRig,
  PhoneWalkerRig,
  PoliceCarRig,
} from './models';
import {
  createPixelArtTexture,
  createTextureLibrary,
  TextureLibrary,
} from './textures';

// Reusable scratch math objects (Zero GC inside tick loop)
const _v3A = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _camDesiredLook = new THREE.Vector3();

interface EngineCallbacks {
  onTelemetry: (snap: TelemetrySnapshot) => void;
  onTicketIssued: (ticket: CitationTicket) => void;
  onCheckpointReached: (label: string, isFinal: boolean) => void;
  onMissionComplete: () => void;
}

interface TrafficAgent {
  rig: { root: THREE.Group; wheels: THREE.Mesh[] };
  path: Array<{ x: number; z: number }>;
  segIndex: number;
  t: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  maxSpeed: number;
}

interface PedestrianAgent {
  rig: {
    root: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
  };
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  progress: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
}

interface CyclistAgent {
  rig: BicycleRig;
  path: Array<{ x: number; z: number }>;
  segIndex: number;
  t: number;
  speed: number;
  x: number;
  z: number;
  phase: number;
}

interface PhoneWalkerAgent {
  rig: PhoneWalkerRig;
  x0: number;
  x1: number;
  baseZ: number;
  yieldZ: number;
  x: number;
  z: number;
  progress: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  yieldedTimer: number;
}

interface RockHazard {
  x: number;
  z: number;
  radius: number;
}

interface PuddleHazard {
  x: number;
  z: number;
  radius: number;
  splashCooldown: number;
}

interface PetAgent {
  rig: PetRig;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  safeX: number;
  safeZ: number;
  x: number;
  z: number;
  progress: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  yieldedTimer: number;
}

interface MotorcycleAgent {
  rig: MotorcycleRig;
  path: Array<{ x: number; z: number }>;
  segIndex: number;
  t: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  maxSpeed: number;
}

interface PoliceAgent {
  rig: PoliceCarRig;
  x: number;
  z: number;
  heading: number;
  speed: number;
  patrolIndex: number;
  state: 'patrol' | 'chasing';
  targetViolation: ViolationCode | null;
  chaseElapsed: number;
}

const ROAD_CCW_PATH: Array<{ x: number; z: number }> = [
  { x: -87.0, z: 72.2 }, // seg 0: South street Eastbound
  { x: 87.0, z: 72.2 },
  { x: 91.0, z: 71.0 },
  { x: 92.2, z: 67.0 },  // seg 3: East street Northbound
  { x: 92.2, z: -67.0 },
  { x: 91.0, z: -71.0 },
  { x: 87.0, z: -72.2 }, // seg 6: North street Westbound
  { x: -87.0, z: -72.2 },
  { x: -91.0, z: -71.0 },
  { x: -92.2, z: -67.0 }, // seg 9: West street Southbound
  { x: -92.2, z: 67.0 },
  { x: -91.0, z: 71.0 },
];

const ROAD_CW_PATH: Array<{ x: number; z: number }> = [
  { x: 84.2, z: 66.5 },  // seg 0: South street Westbound
  { x: -84.2, z: 66.5 },
  { x: -85.7, z: 65.7 },
  { x: -86.5, z: 64.2 }, // seg 3: West street Northbound
  { x: -86.5, z: -64.2 },
  { x: -85.7, z: -65.7 },
  { x: -84.2, z: -66.5 }, // seg 6: North street Eastbound
  { x: 84.2, z: -66.5 },
  { x: 85.7, z: -65.7 },
  { x: 86.5, z: -64.2 }, // seg 9: East street Southbound
  { x: 86.5, z: 64.2 },
  { x: 85.7, z: 65.7 },
];

const POLICE_PATROL_LOOP: Array<{ x: number; z: number }> = [
  { x: -88.0, z: 73.2 },
  { x: 88.0, z: 73.2 },
  { x: 92.2, z: 72.2 },
  { x: 93.2, z: 68.0 },
  { x: 93.2, z: -68.0 },
  { x: 92.2, z: -72.2 },
  { x: 88.0, z: -73.2 },
  { x: -88.0, z: -73.2 },
  { x: -92.2, z: -72.2 },
  { x: -93.2, z: -68.0 },
  { x: -93.2, z: 68.0 },
  { x: -92.2, z: 72.2 },
];

export class KickboardEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private sound = new SoundEngine();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private textures!: TextureLibrary;
  private city!: CityBuildResult;
  private kickboard!: KickboardRig;

  private policeAgents: PoliceAgent[] = [];
  private trafficAgents: TrafficAgent[] = [];
  private motorcycles: MotorcycleAgent[] = [];
  private pedestrians: PedestrianAgent[] = [];
  private cyclists: CyclistAgent[] = [];
  private phoneWalkers: PhoneWalkerAgent[] = [];
  private pets: PetAgent[] = [];
  private rockHazards: RockHazard[] = [];
  private puddleHazards: PuddleHazard[] = [];

  private scooterType: ScooterType = 'standard';
  private customPixels: string[] = createDefaultCustomPixels();
  private customPixelTex: THREE.CanvasTexture | null = null;

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private elapsed = 0;
  private hitstopTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private rockHitCooldown = 0;
  private fallTimer = 0;
  private readonly fallDuration = 1.5;
  private hazardAlertMessage: string | null = null;
  private hazardAlertTimer = 0;

  // Game state
  private phase: GamePhase = 'title';
  private mode: GameMode = 'mission';
  private cameraPreset: CameraPreset = 'chase';

  // Player kinematics
  private px = -48;
  private pz = 78.2;
  private py = 0.025;
  private heading = -Math.PI / 2; // Facing East (+X)
  private speedMps = 0;
  private steerAngle = 0;
  private leanAngle = 0;
  private isDismounted = false;

  // Rule & score state
  private score = 100;
  private totalFines = 0;
  private violationCount = 0;
  private ticketCounter = 0;
  private suspicion = 0;
  private activeViolation: ViolationCode | null = null;
  private graceTimer = 0;
  private checkpointIndex = 0;
  private lapCount = 0;
  private missionElapsed = 0;
  private enteredCrosswalkOnRed = false;
  private wasInCrosswalk = false;

  // Input state
  private heldKeys = new Set<string>();
  private virtualInput = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
  };

  private telemetryAccum = 0;
  private titleOrbitAngle = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.initScene();
    this.bindEvents();
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initScene() {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbce0f7);
    this.scene.fog = new THREE.Fog(0xbce0f7, 75, 225);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      56,
      (this.container.clientWidth || window.innerWidth) /
        (this.container.clientHeight || window.innerHeight),
      0.15,
      360
    );

    // 3-point warm/cool outdoor daylight rig
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x334155, 0.85);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff5e1, 2.0);
    this.sunLight.position.set(45, 70, 35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 175;
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.45);
    rimLight.position.set(-40, 28, -50);
    this.scene.add(rimLight);

    // Procedural textures & city build
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createTextureLibrary(maxAniso);
    this.city = buildCityEnvironment(this.scene, this.textures);

    // Player kickboard + rider
    this.kickboard = createKickboardRig(
      this.textures.contactShadow,
      this.scooterType
    );
    this.scene.add(this.kickboard.root);

    // Spawn Police Cruisers, Traffic, Motorcycles, Pedestrians, Cyclists, Phone Walkers, Pets & Road Hazards
    this.spawnPolicePatrols();
    this.spawnTrafficCars();
    this.spawnMotorcycles();
    this.spawnPedestrians();
    this.spawnCyclists();
    this.spawnPhoneWalkers();
    this.spawnPets();
    this.spawnRoadHazards();

    this.resetPlayerState();
    this.syncCheckpointVisual();

    // Pre-warm shaders on hardware GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private spawnPolicePatrols() {
    const startIndices = [3, 9];
    startIndices.forEach((idx) => {
      const rig = createPoliceCarRig(
        this.textures.policeSide,
        this.textures.contactShadow
      );
      const p = POLICE_PATROL_LOOP[idx];
      const next = POLICE_PATROL_LOOP[(idx + 1) % POLICE_PATROL_LOOP.length];
      const h = Math.atan2(-(next.x - p.x), -(next.z - p.z));
      rig.root.position.set(p.x, 0, p.z);
      rig.root.rotation.y = h;
      this.scene.add(rig.root);
      this.policeAgents.push({
        rig,
        x: p.x,
        z: p.z,
        heading: h,
        speed: 9.5,
        patrolIndex: (idx + 1) % POLICE_PATROL_LOOP.length,
        state: 'patrol',
        targetViolation: null,
        chaseElapsed: 0,
      });
    });
  }

  private spawnTrafficCars() {
    const colors = [
      0x3b82f6, 0x64748b, 0xef4444, 0xf59e0b,
      0x10b981, 0xe2e8f0, 0x6366f1, 0xec4899,
      0x0ea5e9, 0x14b8a6, 0xf97316, 0x8b5cf6,
      0x334155, 0x22c55e, 0xeab308, 0xf43f5e,
    ];
    // 16 total cars (8 CCW outer lane + 8 CW inner lane) evenly spaced on the 4 avenues
    const straightSegs = [0, 3, 6, 9];
    const tSlots = [0.22, 0.72];

    for (let i = 0; i < 16; i++) {
      const isCcw = i < 8;
      const laneIdx = i % 8;
      const path = isCcw ? ROAD_CCW_PATH : ROAD_CW_PATH;
      const segIndex = straightSegs[Math.floor(laneIdx / 2)];
      const t = tSlots[laneIdx % 2] + (isCcw ? 0 : 0.06);
      const p0 = path[segIndex];
      const p1 = path[(segIndex + 1) % path.length];
      const x = THREE.MathUtils.lerp(p0.x, p1.x, t);
      const z = THREE.MathUtils.lerp(p0.z, p1.z, t);
      const heading = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
      const maxSpeed = 8.5 + (i % 4) * 1.1;

      const rig = createTrafficCar(colors[i % colors.length], this.textures.contactShadow);
      rig.root.position.set(x, 0, z);
      rig.root.rotation.y = heading;
      this.scene.add(rig.root);
      this.trafficAgents.push({
        rig,
        path,
        segIndex,
        t,
        x,
        z,
        heading,
        speed: maxSpeed,
        maxSpeed,
      });
    }
  }

  private spawnMotorcycles() {
    const bikeColors = [0xdc2626, 0x0284c7, 0xfacc15, 0x10b981, 0xf97316];
    const configs = [
      { path: ROAD_CCW_PATH, segIndex: 0, t: 0.48, maxSpeed: 12.6 },
      { path: ROAD_CW_PATH, segIndex: 0, t: 0.44, maxSpeed: 13.0 },
      { path: ROAD_CCW_PATH, segIndex: 3, t: 0.5, maxSpeed: 12.2 },
      { path: ROAD_CCW_PATH, segIndex: 6, t: 0.48, maxSpeed: 13.4 },
      { path: ROAD_CW_PATH, segIndex: 9, t: 0.45, maxSpeed: 12.8 },
    ];
    configs.forEach((cfg, i) => {
      const p0 = cfg.path[cfg.segIndex];
      const p1 = cfg.path[(cfg.segIndex + 1) % cfg.path.length];
      const x = THREE.MathUtils.lerp(p0.x, p1.x, cfg.t);
      const z = THREE.MathUtils.lerp(p0.z, p1.z, cfg.t);
      const heading = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
      const rig = createMotorcycleRig(bikeColors[i % bikeColors.length], this.textures.contactShadow);
      rig.root.position.set(x, 0, z);
      rig.root.rotation.y = heading;
      this.scene.add(rig.root);
      this.motorcycles.push({
        rig,
        path: cfg.path,
        segIndex: cfg.segIndex,
        t: cfg.t,
        x,
        z,
        heading,
        speed: cfg.maxSpeed,
        maxSpeed: cfg.maxSpeed,
      });
    });
  }

  private spawnPedestrians() {
    const shirts = [0xe11d48, 0x0284c7, 0x16a34a, 0xd97706, 0x7c3aed, 0x0f766e];
    const pants = [0x1e293b, 0x334155, 0x3f3f46];
    const walks: Array<[number, number, number, number]> = [
      [-65, 81.2, 55, 81.2],
      [60, 81.8, -50, 81.8],
      [99.6, 52, 99.6, -52],
      [100.5, -45, 100.5, 45],
      [60, -81.2, -60, -81.2],
      [-55, -81.8, 50, -81.8],
      [-99.6, -52, -99.6, 52],
      [-100.5, 45, -100.5, -45],
      // Crosswalk walkers near corners
      [81, 66, 81, 75],
      [86, 79.2, 96, 79.2],
      [-86, -79.2, -96, -79.2],
      [-99.2, 65, -99.2, 75],
    ];
    walks.forEach(([x0, z0, x1, z1], i) => {
      const rig = createPedestrian(
        shirts[i % shirts.length],
        pants[i % pants.length],
        this.textures.contactShadow
      );
      this.scene.add(rig.root);
      this.pedestrians.push({
        rig,
        x0,
        z0,
        x1,
        z1,
        progress: (i * 0.23) % 1,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 1.35 + (i % 3) * 0.2,
        phase: i * 1.3,
      });
    });
  }

  private spawnCyclists() {
    const bikeLoop = [
      { x: -75, z: 78.2 },
      { x: 75, z: 78.2 },
      { x: 96.0, z: 62 },
      { x: 96.0, z: -62 },
      { x: 75, z: -78.2 },
      { x: -75, z: -78.2 },
      { x: -96.0, z: -62 },
      { x: -96.0, z: 62 },
    ];
    const bikePresets = [
      { seg: 0, t: 0.36, speed: 5.0, frame: 0x0ea5e9, shirt: 0xf97316 }, // Ahead on South lane
      { seg: 0, t: 0.04, speed: 7.4, frame: 0x22c55e, shirt: 0xeab308 }, // Overtaking from behind!
      { seg: 2, t: 0.28, speed: 5.6, frame: 0xef4444, shirt: 0x38bdf8 }, // East right edge
      { seg: 4, t: 0.42, speed: 5.4, frame: 0xa855f7, shirt: 0x10b981 }, // North bike lane
      { seg: 6, t: 0.35, speed: 5.8, frame: 0xf59e0b, shirt: 0xec4899 }, // West right edge
    ];

    bikePresets.forEach((cfg, i) => {
      const rig = createBicycleRig(
        cfg.frame,
        cfg.shirt,
        this.textures.contactShadow
      );
      const p0 = bikeLoop[cfg.seg];
      const p1 = bikeLoop[(cfg.seg + 1) % bikeLoop.length];
      const x = THREE.MathUtils.lerp(p0.x, p1.x, cfg.t);
      const z = THREE.MathUtils.lerp(p0.z, p1.z, cfg.t);
      rig.root.position.set(x, getGroundHeightAt(x, z), z);
      rig.root.rotation.y = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
      this.scene.add(rig.root);
      this.cyclists.push({
        rig,
        path: bikeLoop,
        segIndex: cfg.seg,
        t: cfg.t,
        speed: cfg.speed,
        x,
        z,
        phase: i * 1.1,
      });
    });
  }

  private spawnPhoneWalkers() {
    const spots: Array<{
      x0: number;
      x1: number;
      baseZ: number;
      yieldZ: number;
      shirt: number;
      pants: number;
    }> = [
      { x0: -26, x1: 4, baseZ: 78.2, yieldZ: 82.0, shirt: 0xec4899, pants: 0x1e293b },
      { x0: 22, x1: 58, baseZ: 78.2, yieldZ: 82.0, shirt: 0x8b5cf6, pants: 0x334155 },
      { x0: 56, x1: 20, baseZ: -78.2, yieldZ: -82.0, shirt: 0x06b6d4, pants: 0x1e293b },
      { x0: -12, x1: -54, baseZ: -78.2, yieldZ: -82.0, shirt: 0xf97316, pants: 0x3f3f46 },
    ];
    spots.forEach((s, i) => {
      const rig = createPhoneWalkerRig(
        s.shirt,
        s.pants,
        this.textures.contactShadow
      );
      const progress = (i * 0.27 + 0.2) % 1;
      const x = THREE.MathUtils.lerp(s.x0, s.x1, progress);
      rig.root.position.set(x, getGroundHeightAt(x, s.baseZ), s.baseZ);
      this.scene.add(rig.root);
      this.phoneWalkers.push({
        rig,
        x0: s.x0,
        x1: s.x1,
        baseZ: s.baseZ,
        yieldZ: s.yieldZ,
        x,
        z: s.baseZ,
        progress,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 0.95 + (i % 2) * 0.15,
        phase: i * 1.4,
        yieldedTimer: 0,
      });
    });
  }

  private spawnPets() {
    const petSpecs: Array<{
      kind: 'dog' | 'cat';
      fur: number;
      x0: number;
      z0: number;
      x1: number;
      z1: number;
      safeX: number;
      safeZ: number;
      speed: number;
    }> = [
      { kind: 'dog', fur: 0xd97706, x0: -32, z0: 81.2, x1: -24, z1: 78.7, safeX: -28, safeZ: 82.6, speed: 1.55 },
      { kind: 'cat', fur: 0xfb923c, x0: 42, z0: 81.0, x1: 50, z1: 78.7, safeX: 46, safeZ: 82.6, speed: 1.35 },
      { kind: 'dog', fur: 0x92400e, x0: 99.6, z0: 26, x1: 96.4, z1: 18, safeX: 100.8, safeZ: 22, speed: 1.5 },
      { kind: 'cat', fur: 0xfef3c7, x0: 24, z0: -81.0, x1: 14, z1: -78.7, safeX: 19, safeZ: -82.6, speed: 1.3 },
      { kind: 'dog', fur: 0x334155, x0: -99.6, z0: -18, x1: -96.4, z1: -10, safeX: -100.8, safeZ: -14, speed: 1.6 },
    ];
    petSpecs.forEach((s, i) => {
      const rig = createPetRig(s.kind, s.fur, this.textures.contactShadow);
      const progress = (i * 0.29) % 1;
      const x = THREE.MathUtils.lerp(s.x0, s.x1, progress);
      const z = THREE.MathUtils.lerp(s.z0, s.z1, progress);
      rig.root.position.set(x, getGroundHeightAt(x, z), z);
      this.scene.add(rig.root);
      this.pets.push({
        rig,
        x0: s.x0,
        z0: s.z0,
        x1: s.x1,
        z1: s.z1,
        safeX: s.safeX,
        safeZ: s.safeZ,
        x,
        z,
        progress,
        dir: i % 2 === 0 ? 1 : -1,
        speed: s.speed,
        phase: i * 1.7,
        yieldedTimer: 0,
      });
    });
  }

  private spawnRoadHazards() {
    // 10 road rock outcrops (돌부리) placed along bike lanes & right edges with room to steer past
    const rockCoords: [number, number][] = [
      [-20, 77.7],
      [16, 78.7],
      [48, 77.8],
      [96.3, 34],
      [95.4, -18],
      [44, -77.8],
      [-18, -78.6],
      [-52, -77.8],
      [-96.3, -26],
      [-95.5, 28],
    ];
    rockCoords.forEach(([rx, rz], i) => {
      const rock = createRoadRock(i);
      const y = getGroundHeightAt(rx, rz);
      rock.position.set(rx, y, rz);
      this.scene.add(rock);
      this.rockHazards.push({ x: rx, z: rz, radius: 0.44 });
    });

    // 8 glossy water puddles (물웅덩이) on bike lanes & road right edges
    const puddleCoords: [number, number, number][] = [
      [-6, 78.3, 1.05],
      [32, 78.1, 1.15],
      [62, 78.4, 1.0],
      [96.0, 14, 1.15],
      [96.1, -36, 1.05],
      [18, -78.2, 1.1],
      [-36, -78.1, 1.15],
      [-96.0, -4, 1.1],
    ];
    puddleCoords.forEach(([px, pz, r]) => {
      const puddle = createWaterPuddle(r);
      const y = getGroundHeightAt(px, pz);
      puddle.position.set(px, y, pz);
      this.scene.add(puddle);
      this.puddleHazards.push({ x: px, z: pz, radius: r, splashCooldown: 0 });
    });
  }

  private resetPlayerState() {
    this.px = -48;
    this.pz = 78.2;
    this.py = getGroundHeightAt(this.px, this.pz);
    this.heading = -Math.PI / 2; // Facing East (+X) along South bike lane
    this.speedMps = 0;
    this.steerAngle = 0;
    this.leanAngle = 0;
    this.isDismounted = false;

    this.score = 100;
    this.totalFines = 0;
    this.violationCount = 0;
    this.suspicion = 0;
    this.activeViolation = null;
    this.graceTimer = 2.0;
    this.checkpointIndex = 0;
    this.lapCount = 0;
    this.missionElapsed = 0;
    this.enteredCrosswalkOnRed = false;
    this.wasInCrosswalk = false;
    this.fallTimer = 0;
    this.rockHitCooldown = 0;
    this.hazardAlertTimer = 0;
    this.hazardAlertMessage = null;

    // Reset police patrols back to patrol state
    this.policeAgents.forEach((p, i) => {
      const idx = (i * 6 + 3) % POLICE_PATROL_LOOP.length;
      const pt = POLICE_PATROL_LOOP[idx];
      const next = POLICE_PATROL_LOOP[(idx + 1) % POLICE_PATROL_LOOP.length];
      p.x = pt.x;
      p.z = pt.z;
      p.heading = Math.atan2(-(next.x - pt.x), -(next.z - pt.z));
      p.patrolIndex = (idx + 1) % POLICE_PATROL_LOOP.length;
      p.state = 'patrol';
      p.targetViolation = null;
      p.chaseElapsed = 0;
    });

    this.kickboard.root.position.set(this.px, this.py, this.pz);
    this.kickboard.root.rotation.y = this.heading;
    this.syncCheckpointVisual();
    this.snapCameraImmediate();
  }

  private snapCameraImmediate() {
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    this.camera.position.set(this.px - fx * 6.5, this.py + 3.2, this.pz - fz * 6.5);
    this.camera.lookAt(this.px + fx * 4, this.py + 1.1, this.pz + fz * 4);
  }

  private syncCheckpointVisual() {
    if (this.mode !== 'mission') {
      this.city.checkpointGroup.visible = false;
      return;
    }
    const cp = CHECKPOINTS[this.checkpointIndex];
    if (!cp) {
      this.city.checkpointGroup.visible = false;
      return;
    }
    this.city.checkpointGroup.visible = true;
    const h = getGroundHeightAt(cp.x, cp.z);
    this.city.checkpointGroup.position.set(cp.x, h, cp.z);
  }

  // Public API for React UI
  public startGame(mode: GameMode) {
    this.sound.unlock();
    this.mode = mode;
    this.resetPlayerState();
    this.phase = 'playing';
    this.emitTelemetry(true);
  }

  public setPhase(phase: GamePhase) {
    this.phase = phase;
    if (phase !== 'playing') {
      this.heldKeys.clear();
      this.sound.updateContinuous(0, 0, this.isDismounted, false, false, false);
    }
  }

  public setCameraPreset(preset: CameraPreset) {
    this.cameraPreset = preset;
  }

  public cycleCameraPreset(): CameraPreset {
    const order: CameraPreset[] = ['chase', 'firstPerson', 'topDown'];
    const next = order[(order.indexOf(this.cameraPreset) + 1) % order.length];
    this.cameraPreset = next;
    return next;
  }

  public toggleDismount() {
    if (this.phase !== 'playing' || this.fallTimer > 0) return;
    this.sound.unlock();
    this.isDismounted = !this.isDismounted;
    if (this.isDismounted && this.speedMps > 2.0) {
      this.speedMps = 2.0;
    }
    this.sound.playDismountToggle(this.isDismounted);
    this.emitTelemetry(true);
  }

  public setScooterConfig(scooterType: ScooterType, customPixels?: string[]) {
    this.scooterType = scooterType;
    if (customPixels) {
      this.customPixels = [...customPixels];
    }
    if (this.customPixelTex) {
      this.customPixelTex.dispose();
      this.customPixelTex = null;
    }
    if (this.scooterType === 'custom') {
      this.customPixelTex = createPixelArtTexture(this.customPixels);
    }

    // Replace 3D kickboard rig cleanly
    if (this.kickboard) {
      this.scene.remove(this.kickboard.root);
      this.kickboard.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((m) => m?.dispose());
        }
      });
    }

    this.kickboard = createKickboardRig(
      this.textures.contactShadow,
      this.scooterType,
      this.customPixelTex ?? undefined
    );
    this.kickboard.root.position.set(this.px, this.py, this.pz);
    this.kickboard.root.rotation.y = this.heading;
    this.kickboard.updateAnimation(
      0.016,
      0,
      this.steerAngle,
      false,
      this.isDismounted,
      this.leanAngle
    );
    this.scene.add(this.kickboard.root);
  }

  public ringBell() {
    this.sound.unlock();
    this.sound.playBell();

    // Alert nearby smartphone-distracted walkers on the bike lane & pets near the road
    let yieldedAny = false;
    for (let i = 0; i < this.phoneWalkers.length; i++) {
      const pw = this.phoneWalkers[i];
      if (Math.hypot(pw.x - this.px, pw.z - this.pz) < 18) {
        if (pw.yieldedTimer <= 0) {
          yieldedAny = true;
        }
        pw.yieldedTimer = 7.0;
      }
    }
    for (let i = 0; i < this.pets.length; i++) {
      const pet = this.pets[i];
      if (Math.hypot(pet.x - this.px, pet.z - this.pz) < 16) {
        if (pet.yieldedTimer <= 0) {
          yieldedAny = true;
          this.sound.playPetAlert(pet.rig.kind);
        }
        pet.yieldedTimer = 7.0;
      }
    }
    if (yieldedAny && this.phase === 'playing') {
      this.score = Math.min(100, this.score + 2);
      this.emitTelemetry(true);
    }
  }

  public setMuted(muted: boolean) {
    this.sound.setMuted(muted);
  }

  public setVirtualInput(patch: Partial<typeof this.virtualInput>) {
    Object.assign(this.virtualInput, patch);
  }

  public acknowledgeTicket() {
    if (this.phase !== 'ticket') return;
    this.graceTimer = 6.0;
    this.suspicion = 0;
    this.activeViolation = null;
    this.speedMps = 0;

    // Move chasing police cruiser far along patrol loop so it doesn't linger on top of player
    this.policeAgents.forEach((p, i) => {
      if (p.state === 'chasing') {
        p.state = 'patrol';
        p.targetViolation = null;
        p.chaseElapsed = 0;
        // Pick a patrol point at least 60m away from player
        let farIdx = (i * 4 + 2) % POLICE_PATROL_LOOP.length;
        for (let k = 0; k < POLICE_PATROL_LOOP.length; k++) {
          const cand = POLICE_PATROL_LOOP[k];
          if (Math.hypot(cand.x - this.px, cand.z - this.pz) > 65) {
            farIdx = k;
            break;
          }
        }
        const pt = POLICE_PATROL_LOOP[farIdx];
        const next = POLICE_PATROL_LOOP[(farIdx + 1) % POLICE_PATROL_LOOP.length];
        p.x = pt.x;
        p.z = pt.z;
        p.heading = Math.atan2(-(next.x - pt.x), -(next.z - pt.z));
        p.patrolIndex = (farIdx + 1) % POLICE_PATROL_LOOP.length;
      }
    });

    this.phase = 'playing';
    this.emitTelemetry(true);
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)
    ) {
      e.preventDefault();
    }
    if (!e.repeat) {
      if (code === 'KeyE' && this.phase === 'playing') {
        this.toggleDismount();
      } else if (code === 'KeyB' && this.phase === 'playing') {
        this.ringBell();
      } else if (code === 'KeyC' && this.phase === 'playing') {
        this.cycleCameraPreset();
      }
    }
    this.heldKeys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.virtualInput = { throttle: false, brake: false, left: false, right: false };
  };

  private scheduleNextFrame() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.renderer.render(this.scene, this.camera);
      this.scheduleNextFrame();
      return;
    }

    this.elapsed += dt;

    // Update traffic signals continuously
    const sig = getSignalPhase(this.elapsed);
    this.city.signalRigs.forEach(({ rig, roadAxis }) => {
      if (roadAxis === 'ew') {
        rig.setPhase(sig.ewGreen, sig.ewYellow, sig.ewPed, sig.blinkOn);
      } else {
        rig.setPhase(sig.nsGreen, sig.nsYellow, sig.nsPed, sig.blinkOn);
      }
    });
    this.city.cornerPedRigs.forEach((rig) => {
      rig.setPedStates(sig.ewPed, sig.nsPed, sig.blinkOn);
    });

    // Update ambient world traffic, motorcycles, pedestrians, cyclists, phone walkers & pets
    if (this.phase === 'title' || this.phase === 'playing') {
      this.updateTrafficCars(dt, sig);
      this.updateMotorcycles(dt, sig);
      this.updatePedestrians(dt);
      this.updateCyclists(dt);
      this.updatePhoneWalkers(dt);
      this.updatePets(dt);
    }

    if (this.rockHitCooldown > 0) this.rockHitCooldown = Math.max(0, this.rockHitCooldown - dt);
    if (this.hazardAlertTimer > 0) {
      this.hazardAlertTimer = Math.max(0, this.hazardAlertTimer - dt);
      if (this.hazardAlertTimer === 0) this.hazardAlertMessage = null;
    }
    for (let i = 0; i < this.puddleHazards.length; i++) {
      if (this.puddleHazards[i].splashCooldown > 0) {
        this.puddleHazards[i].splashCooldown = Math.max(
          0,
          this.puddleHazards[i].splashCooldown - dt
        );
      }
    }

    if (this.phase === 'title') {
      this.titleOrbitAngle += dt * 0.28;
      const r = 4.6;
      this.camera.position.set(
        this.px + Math.cos(this.titleOrbitAngle) * r,
        2.35,
        this.pz + Math.sin(this.titleOrbitAngle) * r
      );
      // Offset look target slightly left in camera space so kickboard sits cleanly on the right side
      this.camera.lookAt(
        this.px + Math.sin(this.titleOrbitAngle) * 1.4,
        0.92,
        this.pz - Math.cos(this.titleOrbitAngle) * 1.4
      );
      this.updatePoliceAgents(dt, false);
    } else if (this.phase === 'playing') {
      this.missionElapsed += dt;
      if (this.graceTimer > 0) this.graceTimer = Math.max(0, this.graceTimer - dt);

      this.updatePlayerPhysics(dt);
      const ruleEval = this.evaluateRules(dt, sig);
      this.updatePoliceAgents(dt, true);
      this.updateCheckpoints(dt);
      this.updateCamera(dt);

      // Update sun shadow bounds to stay centered around player
      this.sunLight.position.set(this.px + 42, 68, this.pz + 32);
      this.sunLight.target.position.set(this.px, 0, this.pz);

      const isChasing = this.policeAgents.some((p) => p.state === 'chasing');
      this.sound.updateContinuous(
        dt,
        Math.abs(this.speedMps) * 3.6,
        this.isDismounted,
        isChasing,
        ruleEval.ruleStatus === 'violation',
        true
      );

      this.telemetryAccum += dt;
      if (this.telemetryAccum >= 0.08) {
        this.telemetryAccum = 0;
        this.emitTelemetry(false, ruleEval, sig);
      }
    } else {
      // Paused, Ticket, or Result
      this.updateCamera(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private updatePlayerPhysics(dt: number) {
    const isFalling = this.fallTimer > 0;
    if (isFalling) {
      this.fallTimer = Math.max(0, this.fallTimer - dt);
    }

    const accel =
      !isFalling &&
      (this.heldKeys.has('KeyW') ||
        this.heldKeys.has('ArrowUp') ||
        this.virtualInput.throttle);
    const rev =
      !isFalling &&
      (this.heldKeys.has('KeyS') ||
        this.heldKeys.has('ArrowDown') ||
        this.virtualInput.brake);
    const brake = !isFalling && this.heldKeys.has('Space');
    const left =
      !isFalling &&
      (this.heldKeys.has('KeyA') ||
        this.heldKeys.has('ArrowLeft') ||
        this.virtualInput.left);
    const right =
      !isFalling &&
      (this.heldKeys.has('KeyD') ||
        this.heldKeys.has('ArrowRight') ||
        this.virtualInput.right);

    const spec = SCOOTER_SPECS[this.scooterType];
    // Korean PM legal top speed: 25 km/h (~6.94 m/s); Walking while pushing: ~8 km/h (2.25 m/s)
    const maxSpeed = this.isDismounted ? 2.25 : 7.0;
    const accelRate = this.isDismounted ? 5.2 : 4.2 * spec.accelMult;

    if (isFalling) {
      this.speedMps = THREE.MathUtils.damp(this.speedMps, 0, 7.5, dt);
    } else if (brake) {
      const decel = 11.5 * (this.isDismounted ? 1 : spec.brakeMult) * dt;
      if (Math.abs(this.speedMps) <= decel) this.speedMps = 0;
      else this.speedMps -= Math.sign(this.speedMps) * decel;
    } else if (accel) {
      this.speedMps = Math.min(maxSpeed, this.speedMps + accelRate * dt);
    } else if (rev) {
      if (this.speedMps > 0.2) {
        this.speedMps = Math.max(
          0,
          this.speedMps - 8.5 * (this.isDismounted ? 1 : spec.brakeMult) * dt
        );
      } else {
        this.speedMps = Math.max(-1.6, this.speedMps - 3.0 * dt);
      }
    } else {
      // Rolling friction
      const drag = this.isDismounted ? 5.5 : 1.65;
      const drop = drag * dt;
      if (Math.abs(this.speedMps) <= drop) this.speedMps = 0;
      else this.speedMps -= Math.sign(this.speedMps) * drop;
    }

    // Steering
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const targetSteer = steerInput * 0.42;
    this.steerAngle = THREE.MathUtils.damp(this.steerAngle, targetSteer, 12, dt);

    const turnScale = this.isDismounted
      ? 2.2
      : Math.min(1, Math.abs(this.speedMps) / 1.8) * 1.9 * spec.turnMult;
    const dirSign = this.speedMps >= -0.05 ? 1 : -1;
    if (isFalling) {
      this.leanAngle = THREE.MathUtils.damp(this.leanAngle, 0, 10, dt);
    } else if (this.isDismounted) {
      this.heading += steerInput * 2.2 * dt;
    } else if (Math.abs(this.speedMps) > 0.08) {
      this.heading += steerInput * turnScale * dirSign * dt;
    }

    if (!isFalling) {
      const targetLean =
        -steerInput * Math.min(Math.abs(this.speedMps) / 7.0, 1) * 0.14;
      this.leanAngle = THREE.MathUtils.damp(this.leanAngle, targetLean, 10, dt);
    }

    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);

    let nextX = this.px + fx * this.speedMps * dt;
    let nextZ = this.pz + fz * this.speedMps * dt;

    // Keep within district outer perimeter
    nextX = THREE.MathUtils.clamp(nextX, -112, 112);
    nextZ = THREE.MathUtils.clamp(nextZ, -92, 92);

    // Collide smoothly against buildings & barriers (AABB push-out)
    const r = 0.45;
    for (let i = 0; i < this.city.boxColliders.length; i++) {
      const b = this.city.boxColliders[i];
      const closestX = THREE.MathUtils.clamp(nextX, b.minX, b.maxX);
      const closestZ = THREE.MathUtils.clamp(nextZ, b.minZ, b.maxZ);
      const dx = nextX - closestX;
      const dz = nextZ - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq) || 0.001;
        const push = r - dist;
        nextX += (dx / dist) * push;
        nextZ += (dz / dist) * push;
        this.speedMps *= 0.65;
      }
    }

    // Collide against trees, streetlights, signs
    for (let i = 0; i < this.city.circleColliders.length; i++) {
      const c = this.city.circleColliders[i];
      const dx = nextX - c.x;
      const dz = nextZ - c.z;
      const minR = r + c.r;
      const distSq = dx * dx + dz * dz;
      if (distSq < minR * minR) {
        const dist = Math.sqrt(distSq) || 0.001;
        const push = minR - dist;
        nextX += (dx / dist) * push;
        nextZ += (dz / dist) * push;
        if (Math.abs(this.speedMps) > 2.5) {
          this.sound.playCollision();
          this.shakeTimer = 0.2;
          this.shakeIntensity = 0.12;
        }
        this.speedMps *= 0.4;
      }
    }

    // Collide against moving traffic cars
    for (let i = 0; i < this.trafficAgents.length; i++) {
      const car = this.trafficAgents[i].rig.root;
      const dx = nextX - car.position.x;
      const dz = nextZ - car.position.z;
      if (dx * dx + dz * dz < 2.2 * 2.2) {
        const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
        nextX = car.position.x + (dx / dist) * 2.25;
        nextZ = car.position.z + (dz / dist) * 2.25;
        if (Math.abs(this.speedMps) > 2.0) {
          this.sound.playCollision();
          this.hitstopTimer = 0.04;
          this.shakeTimer = 0.28;
          this.shakeIntensity = 0.22;
        }
        this.speedMps *= 0.25;
      }
    }

    // Gentle collision avoidance against cyclists, smartphone walkers, motorcycles, pets, rocks & puddles
    for (let i = 0; i < this.cyclists.length; i++) {
      const c = this.cyclists[i];
      const dx = nextX - c.x;
      const dz = nextZ - c.z;
      const minR = 0.9;
      if (dx * dx + dz * dz < minR * minR) {
        const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
        nextX = c.x + (dx / dist) * minR;
        nextZ = c.z + (dz / dist) * minR;
        if (Math.abs(this.speedMps) > 2.2) {
          this.sound.playCollision();
          this.shakeTimer = 0.16;
          this.shakeIntensity = 0.1;
        }
        this.speedMps *= 0.5;
      }
    }
    for (let i = 0; i < this.phoneWalkers.length; i++) {
      const pw = this.phoneWalkers[i];
      const dx = nextX - pw.x;
      const dz = nextZ - pw.z;
      const minR = 0.72;
      if (dx * dx + dz * dz < minR * minR) {
        const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
        nextX = pw.x + (dx / dist) * minR;
        nextZ = pw.z + (dz / dist) * minR;
        if (Math.abs(this.speedMps) > 1.8) {
          this.sound.playCollision();
          this.shakeTimer = 0.16;
          this.shakeIntensity = 0.1;
        }
        this.speedMps *= 0.45;
      }
    }
    for (let i = 0; i < this.motorcycles.length; i++) {
      const mc = this.motorcycles[i];
      const dx = nextX - mc.x;
      const dz = nextZ - mc.z;
      const minR = 1.4;
      if (dx * dx + dz * dz < minR * minR) {
        const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
        nextX = mc.x + (dx / dist) * minR;
        nextZ = mc.z + (dz / dist) * minR;
        if (Math.abs(this.speedMps) > 1.8) {
          this.sound.playCollision();
          this.hitstopTimer = 0.04;
          this.shakeTimer = 0.24;
          this.shakeIntensity = 0.18;
          this.hazardAlertMessage = '🏍️ 오토바이 충돌! 차선 및 측방 안전거리를 확보하세요';
          this.hazardAlertTimer = 2.5;
        }
        this.speedMps *= 0.28;
      }
    }
    for (let i = 0; i < this.pets.length; i++) {
      const pet = this.pets[i];
      const dx = nextX - pet.x;
      const dz = nextZ - pet.z;
      const minR = 0.68;
      if (dx * dx + dz * dz < minR * minR) {
        const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
        nextX = pet.x + (dx / dist) * minR;
        nextZ = pet.z + (dz / dist) * minR;
        if (pet.yieldedTimer <= 0) {
          this.sound.playPetAlert(pet.rig.kind);
          this.score = Math.max(0, this.score - 5);
          this.hazardAlertMessage = '🐾 애완동물 접촉 주의! 발견 시 감속하거나 [B] 벨을 울리세요';
          this.hazardAlertTimer = 2.6;
        }
        pet.yieldedTimer = 6.0;
        this.speedMps *= 0.4;
      }
    }
    if (!isFalling && this.rockHitCooldown <= 0) {
      for (let i = 0; i < this.rockHazards.length; i++) {
        const rock = this.rockHazards[i];
        const dx = nextX - rock.x;
        const dz = nextZ - rock.z;
        const minR = 0.36 + rock.radius;
        if (dx * dx + dz * dz < minR * minR) {
          if (!this.isDismounted && Math.abs(this.speedMps) > 0.9) {
            // Front wheel catches the rock -> rider pitches forward onto the asphalt
            this.fallTimer = this.fallDuration;
            this.rockHitCooldown = this.fallDuration + 0.65;
            this.sound.playCollision();
            this.hitstopTimer = 0.045;
            this.shakeTimer = 0.35;
            this.shakeIntensity = 0.24;
            this.score = Math.max(0, this.score - 5);
            this.speedMps =
              Math.sign(this.speedMps) * Math.min(Math.abs(this.speedMps) * 0.52, 2.8);
            this.hazardAlertMessage =
              '🪨 돌부리에 걸려 앞으로 넘어졌습니다! 노면 장애물을 피하세요 (-5점)';
            this.hazardAlertTimer = 2.6;
          } else {
            const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
            nextX = rock.x + (dx / dist) * minR;
            nextZ = rock.z + (dz / dist) * minR;
            this.speedMps *= 0.45;
          }
          break;
        }
      }
    }
    for (let i = 0; i < this.puddleHazards.length; i++) {
      const puddle = this.puddleHazards[i];
      const dx = nextX - puddle.x;
      const dz = nextZ - puddle.z;
      const hitR = puddle.radius + 0.15;
      if (dx * dx + dz * dz < hitR * hitR) {
        if (!this.isDismounted && Math.abs(this.speedMps) > 1.0) {
          // Wet road hydroplaning drag & subtle slip wobble
          if (Math.abs(this.speedMps) > 4.2) {
            this.speedMps = THREE.MathUtils.damp(this.speedMps, 4.2 * Math.sign(this.speedMps), 5, dt);
          }
          this.leanAngle = THREE.MathUtils.damp(
            this.leanAngle,
            Math.sin(this.elapsed * 18) * 0.2,
            12,
            dt
          );
          if (puddle.splashCooldown <= 0) {
            this.sound.playSplash();
            puddle.splashCooldown = 1.1;
            this.hazardAlertMessage = '💧 물웅덩이 미끄럼 주의! 제동거리가 길어집니다';
            this.hazardAlertTimer = 2.2;
          }
        }
      }
    }

    this.px = nextX;
    this.pz = nextZ;
    const targetGroundY = getGroundHeightAt(this.px, this.pz);
    this.py = THREE.MathUtils.damp(this.py, targetGroundY, 18, dt);

    this.kickboard.root.position.set(this.px, this.py, this.pz);
    this.kickboard.root.rotation.y = this.heading;
    const fallProgress =
      this.fallTimer > 0 ? 1 - this.fallTimer / this.fallDuration : 0;
    this.kickboard.updateAnimation(
      dt,
      this.speedMps,
      this.steerAngle,
      brake || (rev && this.speedMps > 0.2),
      this.isDismounted,
      this.leanAngle,
      fallProgress
    );
  }

  private evaluateRules(
    dt: number,
    sig: ReturnType<typeof getSignalPhase>
  ): {
    zone: ReturnType<typeof getZoneInfoAt>['zone'];
    hasBikeLaneHere: boolean;
    ruleStatus: RuleStatus;
    ruleMessage: string;
    pedLightState: PedLightState | null;
    activeCrosswalkAxis: 'ew' | 'ns' | null;
    nearCrosswalk: boolean;
    violationGraceRemaining: number | null;
  } {
    const info = getZoneInfoAt(this.px, this.pz, this.heading);
    const nearCw = isNearCrosswalk(this.px, this.pz, 14);
    let pedLightState: PedLightState | null = null;
    let activeCrosswalkAxis: 'ew' | 'ns' | null = null;
    if (nearCw) {
      activeCrosswalkAxis = nearCw.axis;
      pedLightState = nearCw.axis === 'ew' ? sig.ewPed : sig.nsPed;
    }

    // Track red-light entry into crosswalk
    const inCw = info.zone === 'crosswalk';
    if (inCw && !this.wasInCrosswalk) {
      const cwLight = info.inCrosswalkAxis === 'ew' ? sig.ewPed : sig.nsPed;
      this.enteredCrosswalkOnRed = cwLight === 'red';
    } else if (!inCw) {
      this.enteredCrosswalkOnRed = false;
    }
    this.wasInCrosswalk = inCw;

    const moving = Math.abs(this.speedMps) > 0.45;
    let violation: ViolationCode | null = null;
    let ruleStatus: RuleStatus = 'legal';
    let ruleMessage = '';
    let suspicionRate = 0;

    if (this.isDismounted) {
      // Walking while pushing kickboard!
      if (inCw && this.enteredCrosswalkOnRed && moving) {
        violation = 'red_light';
        ruleStatus = 'violation';
        ruleMessage = '🚨 보행 신호 적색! 신호 위반 단속 위험!';
        suspicionRate = 1.6;
      } else if (inCw) {
        ruleStatus = 'legal';
        ruleMessage = '🚶 횡단보도 하차 보행 중 · 모범 준법 통행!';
      } else {
        ruleStatus = 'legal';
        ruleMessage = '🚶 하차 후 끌고 이동 중 · 인도/횡단보도 합법';
      }
    } else {
      // Mounted & riding!
      if (info.zone === 'sidewalk') {
        ruleStatus = 'violation';
        if (moving) {
          violation = 'sidewalk_riding';
          ruleMessage = '🚨 인도(보도) 주행 금지! 즉시 차도/자전거도로로 내려오세요!';
          suspicionRate = 0.72;
        } else {
          ruleMessage = '⚠️ 인도 위 정차 중 · [E]키로 내려서 끌고 이동하세요';
        }
      } else if (info.zone === 'crosswalk') {
        ruleStatus = 'violation';
        if (this.enteredCrosswalkOnRed && moving) {
          violation = 'red_light';
          ruleMessage = '🚨 적색 신호 + 횡단보도 탑승 주행 위반!';
          suspicionRate = 1.8;
        } else if (moving) {
          violation = 'crosswalk_mounted';
          ruleMessage = '🚨 횡단보도에서는 [E]키로 내려서 끌고 가야 합니다!';
          suspicionRate = 1.45;
        } else {
          ruleMessage = '⚠️ 횡단보도 위! [E]키로 하차하세요!';
        }
      } else if (info.zone === 'wrong_way') {
        ruleStatus = 'violation';
        if (moving) {
          violation = 'wrong_way';
          ruleMessage = '🚨 중앙선 침범 · 역주행! 즉시 우측 차로로 복귀하세요!';
          suspicionRate = 0.9;
        } else {
          ruleMessage = '⚠️ 반대 차선 진입 · 진행 방향을 맞추세요';
        }
      } else if (info.zone === 'bike_lane') {
        if (info.isWrongWay && moving) {
          ruleStatus = 'warning';
          ruleMessage = '⚠️ 자전거도로 진행 방향을 확인하세요!';
        } else {
          ruleStatus = 'legal';
          ruleMessage = '✅ 전용 자전거도로 · 완벽한 준법 주행!';
        }
      } else if (info.zone === 'road_right_edge') {
        if (info.hasBikeLaneHere) {
          ruleStatus = 'warning';
          if (moving) {
            violation = 'missing_bike_lane';
            ruleMessage = '⚠️ 옆에 전용 자전거도로가 있습니다! 자전거도로를 이용하세요!';
            suspicionRate = 0.32;
          } else {
            ruleMessage = '⚠️ 자전거도로 구간입니다 · 빨간 차로로 이동하세요';
          }
        } else {
          ruleStatus = 'legal';
          ruleMessage = '✅ 차도 우측 가장자리 · 모범 통행 중!';
        }
      } else if (info.zone === 'road_center') {
        ruleStatus = 'warning';
        if (moving) {
          violation = info.hasBikeLaneHere ? 'missing_bike_lane' : 'road_center_riding';
          ruleMessage = info.hasBikeLaneHere
            ? '⚠️ 차도 주행 금지! 우측 전용 자전거도로로 이동하세요!'
            : '⚠️ 차도 우측 가장자리로 붙어 주행하세요!';
          suspicionRate = 0.36;
        } else {
          ruleMessage = '⚠️ 차도 중앙 정차 · 우측 가장자리로 이동하세요';
        }
      } else {
        // Intersection box
        ruleStatus = 'warning';
        ruleMessage = nearCw
          ? '⚠️ 교차로 진입 · 횡단보도에서 [E] 하차 후 건너세요'
          : '⚠️ 교차로 주의 통과';
      }
    }

    // 2.5-second grace window to return to a legal lane or dismount before police dispatch
    const VIOLATION_GRACE_SECONDS = 2.5;
    const anyChasing = this.policeAgents.some((p) => p.state === 'chasing');
    let violationGraceRemaining: number | null = null;

    if (this.graceTimer <= 0 && violation && suspicionRate > 0) {
      this.activeViolation = violation;
      this.suspicion = Math.min(1, this.suspicion + dt / VIOLATION_GRACE_SECONDS);

      if (!anyChasing) {
        violationGraceRemaining = Math.max(
          0,
          (1 - this.suspicion) * VIOLATION_GRACE_SECONDS
        );
      }

      // Dispatch nearest patrolling police car after the 2.5s grace window expires
      if (this.suspicion >= 1) {
        this.dispatchPoliceChase(violation);
      }
    } else {
      // Rapidly clear suspicion as soon as player returns to legal zone or dismounts
      if (!anyChasing) {
        this.suspicion = Math.max(0, this.suspicion - 2.5 * dt);
        if (this.suspicion === 0) this.activeViolation = null;
      }
    }

    return {
      zone: info.zone,
      hasBikeLaneHere: info.hasBikeLaneHere,
      ruleStatus,
      ruleMessage,
      pedLightState,
      activeCrosswalkAxis,
      nearCrosswalk: nearCw !== null,
      violationGraceRemaining,
    };
  }

  private getNearestPoliceDistance(): number {
    let minD = Infinity;
    for (let i = 0; i < this.policeAgents.length; i++) {
      const p = this.policeAgents[i];
      const d = Math.hypot(p.x - this.px, p.z - this.pz);
      if (d < minD) minD = d;
    }
    return minD;
  }

  private dispatchPoliceChase(violation: ViolationCode) {
    // Check if one is already chasing
    if (this.policeAgents.some((p) => p.state === 'chasing')) return;

    let best: PoliceAgent | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < this.policeAgents.length; i++) {
      const p = this.policeAgents[i];
      const d = Math.hypot(p.x - this.px, p.z - this.pz);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (!best) return;

    // If the nearest cruiser is super far (> 70m), reposition it smoothly 34m behind/ahead so the chase feels snappy & dramatic!
    if (bestDist > 68) {
      const fx = -Math.sin(this.heading);
      const fz = -Math.cos(this.heading);
      best.x = THREE.MathUtils.clamp(this.px - fx * 30, -104, 104);
      best.z = THREE.MathUtils.clamp(this.pz - fz * 30, -84, 84);
      best.heading = this.heading;
    }

    best.state = 'chasing';
    best.targetViolation = violation;
    best.chaseElapsed = 0;
  }

  private updatePoliceAgents(dt: number, allowIntercept: boolean) {
    for (let i = 0; i < this.policeAgents.length; i++) {
      const p = this.policeAgents[i];
      if (p.state === 'patrol' || !allowIntercept) {
        const target = POLICE_PATROL_LOOP[p.patrolIndex];
        const dx = target.x - p.x;
        const dz = target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3.0) {
          p.patrolIndex = (p.patrolIndex + 1) % POLICE_PATROL_LOOP.length;
        } else {
          const desiredH = Math.atan2(-dx, -dz);
          p.heading = this.lerpAngle(p.heading, desiredH, 4.5 * dt);
          p.speed = 9.5;
          p.x += (-Math.sin(p.heading)) * p.speed * dt;
          p.z += (-Math.cos(p.heading)) * p.speed * dt;
        }
        p.rig.root.position.set(p.x, getGroundHeightAt(p.x, p.z), p.z);
        p.rig.root.rotation.y = p.heading;
        p.rig.updateLights(this.elapsed, false, p.speed, dt);
      } else {
        // Chasing the player!
        p.chaseElapsed += dt;
        const dx = this.px - p.x;
        const dz = this.pz - p.z;
        const dist = Math.hypot(dx, dz);

        const desiredH = Math.atan2(-dx, -dz);
        p.heading = this.lerpAngle(p.heading, desiredH, 6.5 * dt);
        p.speed = Math.min(18.5, 13.5 + p.chaseElapsed * 1.4);
        p.x += (-Math.sin(p.heading)) * p.speed * dt;
        p.z += (-Math.cos(p.heading)) * p.speed * dt;

        p.rig.root.position.set(p.x, getGroundHeightAt(p.x, p.z), p.z);
        p.rig.root.rotation.y = p.heading;
        p.rig.updateLights(this.elapsed, true, p.speed, dt);

        if (dist < 5.0 || p.chaseElapsed > 5.0) {
          this.issueTicket(p.targetViolation || this.activeViolation || 'sidewalk_riding');
          return;
        }
      }
    }
  }

  private issueTicket(code: ViolationCode) {
    const rule = VIOLATION_RULES[code];
    this.ticketCounter += 1;
    this.violationCount += 1;
    this.totalFines += rule.fineAmount;
    this.score = Math.max(0, this.score - rule.scorePenalty);

    this.hitstopTimer = 0.05;
    this.shakeTimer = 0.35;
    this.shakeIntensity = 0.25;
    this.sound.updateContinuous(0, 0, this.isDismounted, false, false, false);
    this.sound.playTicketIssued();

    this.phase = 'ticket';
    this.heldKeys.clear();

    const ticket: CitationTicket = {
      id: this.ticketCounter,
      code,
      title: rule.title,
      lawArticle: rule.lawArticle,
      description: rule.description,
      fineAmount: rule.fineAmount,
      timestamp: this.missionElapsed,
    };
    this.callbacks.onTicketIssued(ticket);
    this.emitTelemetry(true);
  }

  private updateTrafficCars(
    dt: number,
    sig: ReturnType<typeof getSignalPhase>
  ) {
    for (let i = 0; i < this.trafficAgents.length; i++) {
      const car = this.trafficAgents[i];
      const p0 = car.path[car.segIndex];
      const p1 = car.path[(car.segIndex + 1) % car.path.length];
      const segDx = p1.x - p0.x;
      const segDz = p1.z - p0.z;
      const segLen = Math.hypot(segDx, segDz) || 1;
      const dirX = segDx / segLen;
      const dirZ = segDz / segLen;

      const curX = THREE.MathUtils.lerp(p0.x, p1.x, car.t);
      const curZ = THREE.MathUtils.lerp(p0.z, p1.z, car.t);

      // Stop before red signal ONLY when approaching an intersection (never mid-exit)
      const isStraight = segLen > 20;
      const horizontal = Math.abs(segDx) > Math.abs(segDz);
      const green = horizontal ? sig.ewGreen : sig.nsGreen;
      const cornerX = (curX >= 0 ? 1 : -1) * LOOP_X;
      const cornerZ = (curZ >= 0 ? 1 : -1) * LOOP_Z;
      const distAlongTowardCorner =
        (cornerX - curX) * dirX + (cornerZ - curZ) * dirZ;
      const approachingRed =
        isStraight &&
        !green &&
        distAlongTowardCorner > 11.0 &&
        distAlongTowardCorner < 20.0;

      // Car-following headway spacing so cars queue cleanly without overlapping
      let blockedAhead = false;
      for (let j = 0; j < this.trafficAgents.length; j++) {
        if (i === j) continue;
        const other = this.trafficAgents[j];
        if (other.path !== car.path) continue;
        const ox = other.x - curX;
        const oz = other.z - curZ;
        const forwardDist = ox * dirX + oz * dirZ;
        const lateralDist = Math.abs(ox * -dirZ + oz * dirX);
        if (forwardDist > 0 && forwardDist < 9.5 && lateralDist < 2.2) {
          blockedAhead = true;
          break;
        }
      }

      const targetSpeed = approachingRed || blockedAhead ? 0 : car.maxSpeed;
      car.speed = THREE.MathUtils.damp(car.speed, targetSpeed, 7.5, dt);

      car.t += (car.speed * dt) / segLen;
      while (car.t >= 1) {
        car.t -= 1;
        car.segIndex = (car.segIndex + 1) % car.path.length;
      }

      const np0 = car.path[car.segIndex];
      const np1 = car.path[(car.segIndex + 1) % car.path.length];
      car.x = THREE.MathUtils.lerp(np0.x, np1.x, car.t);
      car.z = THREE.MathUtils.lerp(np0.z, np1.z, car.t);
      const desiredH = Math.atan2(-(np1.x - np0.x), -(np1.z - np0.z));
      car.heading = this.lerpAngle(car.heading, desiredH, 12 * dt);

      car.rig.root.position.set(car.x, 0, car.z);
      car.rig.root.rotation.y = car.heading;
      const wheelSpin = (car.speed * dt) / 0.32;
      car.rig.wheels.forEach((w) => {
        w.rotation.x -= wheelSpin;
      });
    }
  }

  private updatePedestrians(dt: number) {
    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i];
      const distTotal = Math.hypot(ped.x1 - ped.x0, ped.z1 - ped.z0) || 1;
      ped.progress += (ped.dir * ped.speed * dt) / distTotal;
      if (ped.progress >= 1) {
        ped.progress = 1;
        ped.dir = -1;
      } else if (ped.progress <= 0) {
        ped.progress = 0;
        ped.dir = 1;
      }

      const x = THREE.MathUtils.lerp(ped.x0, ped.x1, ped.progress);
      const z = THREE.MathUtils.lerp(ped.z0, ped.z1, ped.progress);
      const y = getGroundHeightAt(x, z);
      const tx = ped.dir === 1 ? ped.x1 - ped.x0 : ped.x0 - ped.x1;
      const tz = ped.dir === 1 ? ped.z1 - ped.z0 : ped.z0 - ped.z1;

      ped.rig.root.position.set(x, y, z);
      ped.rig.root.rotation.y = Math.atan2(-tx, -tz);

      ped.phase += dt * ped.speed * 5.2;
      const swing = Math.sin(ped.phase) * 0.42;
      ped.rig.leftLeg.rotation.x = swing;
      ped.rig.rightLeg.rotation.x = -swing;
      ped.rig.leftArm.rotation.x = -swing * 0.7;
      ped.rig.rightArm.rotation.x = swing * 0.7;
    }
  }

  private updateCyclists(dt: number) {
    for (let i = 0; i < this.cyclists.length; i++) {
      const c = this.cyclists[i];
      const p0 = c.path[c.segIndex];
      const p1 = c.path[(c.segIndex + 1) % c.path.length];
      const segLen = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1;

      c.t += (c.speed * dt) / segLen;
      if (c.t >= 1) {
        c.t -= 1;
        c.segIndex = (c.segIndex + 1) % c.path.length;
      }

      const np0 = c.path[c.segIndex];
      const np1 = c.path[(c.segIndex + 1) % c.path.length];
      c.x = THREE.MathUtils.lerp(np0.x, np1.x, c.t);
      c.z = THREE.MathUtils.lerp(np0.z, np1.z, c.t);

      const y = getGroundHeightAt(c.x, c.z);
      const h = Math.atan2(-(np1.x - np0.x), -(np1.z - np0.z));
      c.rig.root.position.set(c.x, y, c.z);
      c.rig.root.rotation.y = h;

      const wheelSpin = (c.speed * dt) / 0.34;
      c.rig.frontWheel.rotation.x -= wheelSpin;
      c.rig.rearWheel.rotation.x -= wheelSpin;

      c.phase += dt * c.speed * 2.2;
      const pedal = Math.sin(c.phase) * 0.42;
      c.rig.leftLeg.rotation.x = pedal;
      c.rig.rightLeg.rotation.x = -pedal;
    }
  }

  private updatePhoneWalkers(dt: number) {
    for (let i = 0; i < this.phoneWalkers.length; i++) {
      const pw = this.phoneWalkers[i];
      if (pw.yieldedTimer > 0) {
        pw.yieldedTimer = Math.max(0, pw.yieldedTimer - dt);
      }

      const distTotal = Math.abs(pw.x1 - pw.x0) || 1;
      pw.progress += (pw.dir * pw.speed * dt) / distTotal;
      if (pw.progress >= 1) {
        pw.progress = 1;
        pw.dir = -1;
      } else if (pw.progress <= 0) {
        pw.progress = 0;
        pw.dir = 1;
      }

      pw.x = THREE.MathUtils.lerp(pw.x0, pw.x1, pw.progress);
      const targetZ = pw.yieldedTimer > 0 ? pw.yieldZ : pw.baseZ;
      pw.z = THREE.MathUtils.damp(pw.z, targetZ, 4.5, dt);

      const y = getGroundHeightAt(pw.x, pw.z);
      const tx = pw.dir === 1 ? pw.x1 - pw.x0 : pw.x0 - pw.x1;
      pw.rig.root.position.set(pw.x, y, pw.z);
      pw.rig.root.rotation.y = Math.atan2(-tx, 0);

      // Look up briefly when alerted by kickboard bell
      const targetHeadX = pw.yieldedTimer > 0 ? 0.05 : 0.44;
      pw.rig.headGroup.rotation.x = THREE.MathUtils.damp(
        pw.rig.headGroup.rotation.x,
        targetHeadX,
        8,
        dt
      );

      pw.phase += dt * pw.speed * 4.8;
      const swing = Math.sin(pw.phase) * 0.36;
      pw.rig.leftLeg.rotation.x = swing;
      pw.rig.rightLeg.rotation.x = -swing;
    }
  }

  private updatePets(dt: number) {
    for (let i = 0; i < this.pets.length; i++) {
      const pet = this.pets[i];
      if (pet.yieldedTimer > 0) {
        pet.yieldedTimer = Math.max(0, pet.yieldedTimer - dt);
        // Scurry safely onto sidewalk
        const dx = pet.safeX - pet.x;
        const dz = pet.safeZ - pet.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.2) {
          const step = Math.min(dist, 2.4 * dt);
          pet.x += (dx / dist) * step;
          pet.z += (dz / dist) * step;
          pet.rig.root.rotation.y = Math.atan2(-dx, -dz);
        }
      } else {
        const distTotal = Math.hypot(pet.x1 - pet.x0, pet.z1 - pet.z0) || 1;
        pet.progress += (pet.dir * pet.speed * dt) / distTotal;
        if (pet.progress >= 1) {
          pet.progress = 1;
          pet.dir = -1;
        } else if (pet.progress <= 0) {
          pet.progress = 0;
          pet.dir = 1;
        }
        const tx = THREE.MathUtils.lerp(pet.x0, pet.x1, pet.progress);
        const tz = THREE.MathUtils.lerp(pet.z0, pet.z1, pet.progress);
        const vx = tx - pet.x;
        const vz = tz - pet.z;
        pet.x = THREE.MathUtils.damp(pet.x, tx, 8, dt);
        pet.z = THREE.MathUtils.damp(pet.z, tz, 8, dt);
        if (Math.hypot(vx, vz) > 0.002) {
          pet.rig.root.rotation.y = Math.atan2(-vx, -vz);
        }
      }

      const y = getGroundHeightAt(pet.x, pet.z);
      pet.rig.root.position.set(pet.x, y, pet.z);

      pet.phase += dt * pet.speed * 7.5;
      const trot = Math.sin(pet.phase) * 0.48;
      pet.rig.legs[0].rotation.x = trot;
      pet.rig.legs[1].rotation.x = -trot;
      pet.rig.legs[2].rotation.x = -trot;
      pet.rig.legs[3].rotation.x = trot;
      pet.rig.tailPivot.rotation.y = Math.sin(pet.phase * 1.4) * 0.45;
    }
  }

  private updateMotorcycles(
    dt: number,
    sig: ReturnType<typeof getSignalPhase>
  ) {
    for (let i = 0; i < this.motorcycles.length; i++) {
      const mc = this.motorcycles[i];
      const p0 = mc.path[mc.segIndex];
      const p1 = mc.path[(mc.segIndex + 1) % mc.path.length];
      const segDx = p1.x - p0.x;
      const segDz = p1.z - p0.z;
      const segLen = Math.hypot(segDx, segDz) || 1;
      const dirX = segDx / segLen;
      const dirZ = segDz / segLen;

      const curX = THREE.MathUtils.lerp(p0.x, p1.x, mc.t);
      const curZ = THREE.MathUtils.lerp(p0.z, p1.z, mc.t);

      const isStraight = segLen > 20;
      const horizontal = Math.abs(segDx) > Math.abs(segDz);
      const green = horizontal ? sig.ewGreen : sig.nsGreen;
      const cornerX = (curX >= 0 ? 1 : -1) * LOOP_X;
      const cornerZ = (curZ >= 0 ? 1 : -1) * LOOP_Z;
      const distAlongTowardCorner =
        (cornerX - curX) * dirX + (cornerZ - curZ) * dirZ;
      const approachingRed =
        isStraight &&
        !green &&
        distAlongTowardCorner > 11.0 &&
        distAlongTowardCorner < 20.0;

      // Keep safe following distance behind both cars and other motorcycles on same lane
      let blockedAhead = false;
      for (let j = 0; j < this.trafficAgents.length; j++) {
        const other = this.trafficAgents[j];
        if (other.path !== mc.path) continue;
        const ox = other.x - curX;
        const oz = other.z - curZ;
        const forwardDist = ox * dirX + oz * dirZ;
        const lateralDist = Math.abs(ox * -dirZ + oz * dirX);
        if (forwardDist > 0 && forwardDist < 9.0 && lateralDist < 2.2) {
          blockedAhead = true;
          break;
        }
      }
      if (!blockedAhead) {
        for (let j = 0; j < this.motorcycles.length; j++) {
          if (i === j) continue;
          const other = this.motorcycles[j];
          if (other.path !== mc.path) continue;
          const ox = other.x - curX;
          const oz = other.z - curZ;
          const forwardDist = ox * dirX + oz * dirZ;
          const lateralDist = Math.abs(ox * -dirZ + oz * dirX);
          if (forwardDist > 0 && forwardDist < 7.0 && lateralDist < 2.0) {
            blockedAhead = true;
            break;
          }
        }
      }

      const targetSpeed = approachingRed || blockedAhead ? 0 : mc.maxSpeed;
      mc.speed = THREE.MathUtils.damp(mc.speed, targetSpeed, 8, dt);

      mc.t += (mc.speed * dt) / segLen;
      while (mc.t >= 1) {
        mc.t -= 1;
        mc.segIndex = (mc.segIndex + 1) % mc.path.length;
      }

      const np0 = mc.path[mc.segIndex];
      const np1 = mc.path[(mc.segIndex + 1) % mc.path.length];
      mc.x = THREE.MathUtils.lerp(np0.x, np1.x, mc.t);
      mc.z = THREE.MathUtils.lerp(np0.z, np1.z, mc.t);
      const desiredH = Math.atan2(-(np1.x - np0.x), -(np1.z - np0.z));
      mc.heading = this.lerpAngle(mc.heading, desiredH, 12 * dt);

      mc.rig.root.position.set(mc.x, 0, mc.z);
      mc.rig.root.rotation.y = mc.heading;
      const wheelSpin = (mc.speed * dt) / 0.32;
      mc.rig.frontWheel.rotation.x -= wheelSpin;
      mc.rig.rearWheel.rotation.x -= wheelSpin;
    }
  }

  private updateCheckpoints(dt: number) {
    if (this.mode !== 'mission') return;

    this.city.checkpointRing.rotation.z += dt * 1.4;
    this.city.checkpointBeacon.rotation.y += dt * 0.8;

    const cp = CHECKPOINTS[this.checkpointIndex];
    if (!cp) return;
    const dist = Math.hypot(this.px - cp.x, this.pz - cp.z);
    if (dist <= cp.radius) {
      this.sound.playCheckpoint();
      this.score = Math.min(100, this.score + 5);
      const isFinal = this.checkpointIndex >= CHECKPOINTS.length - 1;
      this.callbacks.onCheckpointReached(cp.label, isFinal);
      if (isFinal) {
        this.lapCount += 1;
        this.phase = 'result';
        this.sound.updateContinuous(0, 0, this.isDismounted, false, false, false);
        this.callbacks.onMissionComplete();
      } else {
        this.checkpointIndex += 1;
        this.syncCheckpointVisual();
      }
      this.emitTelemetry(true);
    }
  }

  private updateCamera(dt: number) {
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);

    const fallDrop =
      this.fallTimer > 0
        ? Math.sin((1 - this.fallTimer / this.fallDuration) * Math.PI)
        : 0;

    if (this.cameraPreset === 'chase') {
      _camDesiredPos.set(
        this.px - fx * (6.4 - fallDrop * 0.7),
        this.py + 3.05 - fallDrop * 0.65,
        this.pz - fz * (6.4 - fallDrop * 0.7)
      );
      _camDesiredLook.set(
        this.px + fx * 6.0,
        this.py + 1.15 - fallDrop * 0.65,
        this.pz + fz * 6.0
      );
    } else if (this.cameraPreset === 'firstPerson') {
      _camDesiredPos.set(
        this.px + fx * (0.15 + fallDrop * 0.65),
        this.py + 1.56 - fallDrop * 1.18,
        this.pz + fz * (0.15 + fallDrop * 0.65)
      );
      _camDesiredLook.set(
        this.px + fx * 14,
        this.py + 1.32 - fallDrop * 1.25,
        this.pz + fz * 14
      );
    } else {
      // Top-down angled tactical view
      _camDesiredPos.set(
        this.px - fx * 7.5,
        this.py + 26.0,
        this.pz - fz * 7.5
      );
      _camDesiredLook.set(this.px + fx * 3.0, this.py, this.pz + fz * 3.0);
    }

    const dampLambda = this.cameraPreset === 'firstPerson' ? 18 : 8.5;
    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _camDesiredPos.x,
      dampLambda,
      dt
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _camDesiredPos.y,
      dampLambda,
      dt
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _camDesiredPos.z,
      dampLambda,
      dt
    );

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
    }

    _v3A.copy(_camDesiredLook);
    this.camera.lookAt(_v3A);
  }

  private emitTelemetry(
    force: boolean,
    ruleEval?: ReturnType<KickboardEngine['evaluateRules']>,
    sig?: ReturnType<typeof getSignalPhase>
  ) {
    const activeSig = sig ?? getSignalPhase(this.elapsed);
    const evalRes = ruleEval ?? this.evaluateRules(0, activeSig);

    let chasing = false;
    let minPoliceDist = Infinity;
    const policeCoords = this.policeAgents.map((p) => {
      const d = Math.hypot(p.x - this.px, p.z - this.pz);
      if (d < minPoliceDist) minPoliceDist = d;
      if (p.state === 'chasing') chasing = true;
      return { x: p.x, z: p.z, chasing: p.state === 'chasing' };
    });

    const policeAlert: TelemetrySnapshot['policeAlert'] = chasing
      ? 'chasing'
      : this.suspicion > 0.02
      ? 'watching'
      : 'none';

    const nearPhoneWalker = this.phoneWalkers.some(
      (pw) =>
        pw.yieldedTimer <= 0 &&
        Math.hypot(pw.x - this.px, pw.z - this.pz) < 16
    );
    const nearPet = this.pets.some(
      (pet) =>
        pet.yieldedTimer <= 0 &&
        Math.hypot(pet.x - this.px, pet.z - this.pz) < 15
    );
    const distanceToSchoolMeters = Math.round(
      computeRemainingRouteMeters(
        this.px,
        this.pz,
        this.checkpointIndex,
        this.mode === 'mission'
      )
    );

    if (force || this.phase === 'playing') {
      this.callbacks.onTelemetry({
        speedKmh: Math.round(Math.abs(this.speedMps) * 3.6),
        isDismounted: this.isDismounted,
        zone: evalRes.zone,
        hasBikeLaneHere: evalRes.hasBikeLaneHere,
        ruleStatus: evalRes.ruleStatus,
        ruleMessage: evalRes.ruleMessage,
        score: this.score,
        totalFines: this.totalFines,
        violationCount: this.violationCount,
        policeAlert,
        policeDistance: Math.round(minPoliceDist),
        suspicionProgress: this.suspicion,
        checkpointIndex: this.checkpointIndex,
        totalCheckpoints: CHECKPOINTS.length,
        lapCount: this.lapCount,
        elapsedSeconds: this.missionElapsed,
        distanceToSchoolMeters,
        nearCrosswalk: evalRes.nearCrosswalk,
        pedLightState: evalRes.pedLightState,
        activeCrosswalkAxis: evalRes.activeCrosswalkAxis,
        ewPedState: activeSig.ewPed,
        nsPedState: activeSig.nsPed,
        ewPedRemaining: activeSig.ewPedRemaining,
        nsPedRemaining: activeSig.nsPedRemaining,
        nearPhoneWalker,
        nearPet,
        hazardAlert: this.hazardAlertTimer > 0 ? this.hazardAlertMessage : null,
        playerX: this.px,
        playerZ: this.pz,
        playerHeading: this.heading,
        policeCoords,
        nextCheckpoint:
          this.mode === 'mission'
            ? CHECKPOINTS[this.checkpointIndex] || null
            : null,
        graceTimer: this.graceTimer,
        violationGraceRemaining: evalRes.violationGraceRemaining,
      });
    }
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * Math.min(t, 1);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);

    this.sound.dispose();
    this.textures.dispose();
    this.customPixelTex?.dispose();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
