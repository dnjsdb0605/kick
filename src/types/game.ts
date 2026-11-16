export type GamePhase = 'title' | 'playing' | 'paused' | 'ticket' | 'result';

export type GameMode = 'mission' | 'freeride';

export type CameraPreset = 'chase' | 'firstPerson' | 'topDown';

export type ScooterType = 'standard' | 'ssing' | 'premium' | 'custom';

export interface ScooterSpec {
  id: ScooterType;
  name: string;
  subtitle: string;
  primaryColor: string;
  accentColor: string;
  accelMult: number;
  brakeMult: number;
  turnMult: number;
}

export const SCOOTER_SPECS: Record<ScooterType, ScooterSpec> = {
  standard: {
    id: 'standard',
    name: '전동킥보드',
    subtitle: '균형 잡힌 도심형 기본 모델',
    primaryColor: '#334155',
    accentColor: '#06b6d4',
    accelMult: 1.0,
    brakeMult: 1.0,
    turnMult: 1.0,
  },
  ssing: {
    id: 'ssing',
    name: '씽씽이',
    subtitle: '바구니 · 경쾌한 회전의 공유 모델',
    primaryColor: '#facc15',
    accentColor: '#1e293b',
    accelMult: 0.96,
    brakeMult: 1.05,
    turnMult: 1.15,
  },
  premium: {
    id: 'premium',
    name: '고급전동킥보드',
    subtitle: '듀얼 서스펜션 · 고출력 가속/제동',
    primaryColor: '#0f172a',
    accentColor: '#f59e0b',
    accelMult: 1.24,
    brakeMult: 1.22,
    turnMult: 1.08,
  },
  custom: {
    id: 'custom',
    name: '커스텀',
    subtitle: '직접 그린 픽셀 아트 데칼 장착',
    primaryColor: '#1e293b',
    accentColor: '#ec4899',
    accelMult: 1.1,
    brakeMult: 1.1,
    turnMult: 1.1,
  },
};

export function createDefaultCustomPixels(): string[] {
  // 16x16 crisp cyber-flame / racing stripe pixel pattern
  const pixels = new Array<string>(256).fill('#0f172a');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = y * 16 + x;
      if (x === 0 || x === 15) {
        pixels[idx] = '#38bdf8';
      } else if (x === 7 || x === 8) {
        pixels[idx] = y % 2 === 0 ? '#facc15' : '#f97316';
      } else if (x >= 4 && x <= 11 && y >= 5 && y <= 10) {
        if ((x === 5 || x === 10) && (y === 6 || y === 9)) {
          pixels[idx] = '#ec4899';
        } else {
          pixels[idx] = '#1e293b';
        }
      }
    }
  }
  return pixels;
}

export type SurfaceZone =
  | 'bike_lane'
  | 'road_right_edge'
  | 'road_center'
  | 'wrong_way'
  | 'sidewalk'
  | 'crosswalk'
  | 'intersection'
  | 'plaza';

export type RuleStatus = 'legal' | 'warning' | 'violation';

export type ViolationCode =
  | 'sidewalk_riding'
  | 'crosswalk_mounted'
  | 'missing_bike_lane'
  | 'road_center_riding'
  | 'wrong_way'
  | 'red_light';

export interface CitationTicket {
  id: number;
  code: ViolationCode;
  title: string;
  lawArticle: string;
  description: string;
  fineAmount: number;
  timestamp: number;
}

export interface CheckpointDef {
  id: number;
  label: string;
  hint: string;
  x: number;
  z: number;
  radius: number;
}

export type PedLightState = 'green' | 'blinking' | 'red';

export interface TelemetrySnapshot {
  speedKmh: number;
  isDismounted: boolean;
  zone: SurfaceZone;
  hasBikeLaneHere: boolean;
  ruleStatus: RuleStatus;
  ruleMessage: string;
  score: number;
  totalFines: number;
  violationCount: number;
  policeAlert: 'none' | 'watching' | 'chasing';
  policeDistance: number;
  suspicionProgress: number;
  checkpointIndex: number;
  totalCheckpoints: number;
  lapCount: number;
  elapsedSeconds: number;
  distanceToSchoolMeters: number;
  nearCrosswalk: boolean;
  pedLightState: PedLightState | null;
  activeCrosswalkAxis: 'ew' | 'ns' | null;
  ewPedState: PedLightState;
  nsPedState: PedLightState;
  ewPedRemaining: number;
  nsPedRemaining: number;
  nearPhoneWalker: boolean;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  policeCoords: Array<{ x: number; z: number; chasing: boolean }>;
  nextCheckpoint: CheckpointDef | null;
  graceTimer: number;
  violationGraceRemaining: number | null;
}

export const VIOLATION_RULES: Record<
  ViolationCode,
  {
    title: string;
    lawArticle: string;
    description: string;
    fineAmount: number;
    scorePenalty: number;
  }
> = {
  sidewalk_riding: {
    title: '인도(보도) 주행 위반',
    lawArticle: '도로교통법 제13조 제1항 (차마의 보도 통행 금지)',
    description:
      '전동킥보드는 보도(인도)나 보행자 전용도로로 주행할 수 없습니다. 인도에서는 반드시 하차(E키)하여 끌고 이동해야 합니다.',
    fineAmount: 30000,
    scorePenalty: 25,
  },
  crosswalk_mounted: {
    title: '횡단보도 탑승 주행 위반',
    lawArticle: '도로교통법 제13조의2 제6항 (횡단보도 횡단 방법)',
    description:
      '횡단보도를 건널 때는 전동킥보드에서 내려서(E키) 기체를 끌고 보행해야 합니다. 탑승한 채 건너면 범칙금 대상입니다.',
    fineAmount: 30000,
    scorePenalty: 25,
  },
  missing_bike_lane: {
    title: '자전거도로 미이용 위반',
    lawArticle: '도로교통법 제13조의2 제1항 (자전거도로 통행 의무)',
    description:
      '자전거도로가 설치된 구간에서는 일반 차도가 아닌 전용 자전거도로로 주행해야 합니다.',
    fineAmount: 20000,
    scorePenalty: 15,
  },
  road_center_riding: {
    title: '차도 우측 가장자리 통행 위반',
    lawArticle: '도로교통법 제13조의2 제2항 (차도 우측 가장자리 통행)',
    description:
      '자전거도로가 없는 구간에서는 차도의 중앙이나 좌측 차선이 아닌 우측 가장자리에 붙어 통행해야 합니다.',
    fineAmount: 20000,
    scorePenalty: 15,
  },
  wrong_way: {
    title: '중앙선 침범 · 역주행 위반',
    lawArticle: '도로교통법 제13조 제3항 (진행 방향 준수)',
    description:
      '차량 진행 방향과 반대로 역주행하거나 중앙선을 침범하면 대형 사고 위험 및 단속 대상이 됩니다.',
    fineAmount: 40000,
    scorePenalty: 30,
  },
  red_light: {
    title: '보행 · 교차로 신호 위반',
    lawArticle: '도로교통법 제5조 (신호 또는 지시에 따를 의무)',
    description:
      '교차로 및 횡단보도의 적색 신호를 무시하고 진입했습니다. 녹색 보행 신호를 확인한 뒤 끌고 건너세요.',
    fineAmount: 30000,
    scorePenalty: 25,
  },
};
