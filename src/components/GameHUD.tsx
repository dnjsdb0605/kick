import React, { useState } from 'react';
import {
  CameraPreset,
  GameMode,
  SurfaceZone,
  TelemetrySnapshot,
} from '../types/game';
import {
  AlertTriangle,
  Bell,
  Camera,
  ChevronDown,
  ChevronUp,
  Flag,
  Footprints,
  GraduationCap,
  Pause,
  PawPrint,
  ShieldAlert,
  Smartphone,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface GameHUDProps {
  telemetry: TelemetrySnapshot;
  mode: GameMode;
  cameraPreset: CameraPreset;
  muted: boolean;
  checkpointToast: string | null;
  onToggleDismount: () => void;
  onCycleCamera: () => void;
  onRingBell: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onFinishFreeride: () => void;
  onVirtualInput: (patch: {
    throttle?: boolean;
    brake?: boolean;
    left?: boolean;
    right?: boolean;
  }) => void;
}

const ZONE_LABELS: Record<SurfaceZone, { text: string; color: string }> = {
  bike_lane: { text: '전용 자전거도로', color: 'text-emerald-300' },
  road_right_edge: { text: '차도 우측 가장자리', color: 'text-cyan-300' },
  road_center: { text: '차도 안쪽 차로', color: 'text-amber-300' },
  wrong_way: { text: '반대 차선 (역주행)', color: 'text-rose-400' },
  sidewalk: { text: '인도 (보도)', color: 'text-rose-400' },
  crosswalk: { text: '횡단보도', color: 'text-amber-300' },
  intersection: { text: '교차로 내부', color: 'text-amber-300' },
  plaza: { text: '보행 구역', color: 'text-slate-300' },
};

const CAMERA_LABELS: Record<CameraPreset, string> = {
  chase: '3인칭 추적',
  firstPerson: '1인칭 핸들',
  topDown: '탑다운',
};

export const GameHUD: React.FC<GameHUDProps> = ({
  telemetry,
  mode,
  cameraPreset,
  muted,
  checkpointToast,
  onToggleDismount,
  onCycleCamera,
  onRingBell,
  onToggleMute,
  onPause,
  onFinishFreeride,
  onVirtualInput,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showTouchPad, setShowTouchPad] = useState(false);

  const zoneMeta = ZONE_LABELS[telemetry.zone];

  const statusColor =
    telemetry.ruleStatus === 'legal'
      ? 'border-emerald-500/70 bg-[#0b1220]/90 text-emerald-300'
      : telemetry.ruleStatus === 'warning'
      ? 'border-amber-500/80 bg-[#1a1408]/92 text-amber-300'
      : 'border-rose-500 bg-[#22090d]/95 text-rose-300';

  // Minimap coordinate converter: world x in [-115..115], z in [-95..95] -> SVG 136x112
  const mapX = (wx: number) => ((wx + 115) / 230) * 136;
  const mapZ = (wz: number) => ((wz + 95) / 190) * 112;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-4">
      {/* TOP PERIMETER BAR */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Score, Fines, Route Progress */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center gap-3 bg-[#0b1220]/90 border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-lg">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                준법 점수
              </div>
              <div className="text-lg font-extrabold tabular-nums text-emerald-400 leading-tight">
                {telemetry.score}
                <span className="text-xs font-semibold text-slate-400 ml-0.5">점</span>
              </div>
            </div>
            <div className="w-px h-7 bg-slate-700" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                누적 벌금
              </div>
              <div
                className={`text-lg font-extrabold tabular-nums leading-tight ${
                  telemetry.totalFines > 0 ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                ₩{telemetry.totalFines.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="w-px h-7 bg-slate-700" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                주행 시간
              </div>
              <div className="text-sm font-bold tabular-nums text-slate-200 leading-tight">
                {formatTime(telemetry.elapsedSeconds)}
              </div>
            </div>
          </div>

          {/* School Distance Badge */}
          <div className="flex items-center justify-between gap-3 bg-[#0b1220]/90 border border-amber-400/50 rounded-xl px-3.5 py-2 shadow-lg">
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <GraduationCap className="w-4 h-4" />
              <span>푸른솔 학교까지</span>
            </span>
            <span className="text-sm font-black tabular-nums text-white">
              {telemetry.distanceToSchoolMeters.toLocaleString('ko-KR')}m
            </span>
          </div>

          {mode === 'mission' && telemetry.nextCheckpoint ? (
            <div className="max-w-xs bg-[#0b1220]/90 border border-cyan-500/40 rounded-xl px-3.5 py-2 shadow-lg">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-cyan-300 mb-0.5">
                <span className="flex items-center gap-1">
                  <Flag className="w-3.5 h-3.5" />
                  {telemetry.nextCheckpoint.label}
                </span>
                <span className="tabular-nums text-slate-300">
                  {telemetry.checkpointIndex + 1}/{telemetry.totalCheckpoints}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                {telemetry.nextCheckpoint.hint}
              </p>
            </div>
          ) : (
            <div className="bg-[#0b1220]/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-semibold">
              자유 주행 모드 · 법규 테스트 가능
            </div>
          )}
        </div>

        {/* Top-Center: Rule Status + Police Chase / Crosswalk Signal Alert */}
        <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
          <div
            className={`border rounded-xl px-4 py-2 text-center shadow-lg transition-colors ${statusColor}`}
          >
            <div className="text-xs md:text-sm font-bold leading-snug">
              {telemetry.ruleMessage}
            </div>
            {telemetry.graceTimer > 0 && (
              <div className="text-[11px] text-cyan-300 mt-0.5 tabular-nums">
                단속 유예 시간 {telemetry.graceTimer.toFixed(1)}초 — 안전한 차로로 복귀하세요
              </div>
            )}
          </div>

          {/* Police Alert / 5-Second Return Grace Bar */}
          {telemetry.policeAlert !== 'none' && (
            <div
              className={`w-full max-w-sm border rounded-xl px-3.5 py-2 shadow-lg ${
                telemetry.policeAlert === 'chasing'
                  ? 'bg-[#2a0910]/95 border-rose-500 text-rose-200'
                  : 'bg-[#1f1606]/92 border-amber-500 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  {telemetry.policeAlert === 'chasing'
                    ? '경찰 순찰차 단속 추격 중!'
                    : '복귀 유예 시간 (정상 차로 복귀 또는 [E] 하차)'}
                </span>
                <span className="tabular-nums">
                  {telemetry.policeAlert === 'chasing'
                    ? `거리 ${telemetry.policeDistance}m`
                    : `${(telemetry.violationGraceRemaining ?? 0).toFixed(1)}초`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    telemetry.policeAlert === 'chasing'
                      ? 'bg-rose-500'
                      : 'bg-amber-400'
                  }`}
                  style={{
                    width: `${
                      telemetry.policeAlert === 'chasing'
                        ? 100
                        : Math.round(telemetry.suspicionProgress * 100)
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Always-Accessible Crosswalk Pedestrian Signal Monitor */}
          <div className="flex items-center gap-2 bg-[#0b1220]/92 border border-slate-700/90 rounded-xl px-3 py-1.5 shadow-lg">
            {/* 'ns' crosswalk crosses North-South roads (walk East <-> West) */}
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border ${
                telemetry.activeCrosswalkAxis === 'ns'
                  ? 'border-cyan-400 bg-slate-800/95'
                  : 'border-slate-700/70 bg-slate-900/80'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${
                  telemetry.nsPedState === 'green'
                    ? 'bg-emerald-400'
                    : telemetry.nsPedState === 'blinking'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
              <div className="leading-none">
                <div className="text-[10px] font-semibold text-slate-400">
                  동↔서 횡단
                </div>
                <div
                  className={`text-xs font-extrabold tabular-nums mt-0.5 ${
                    telemetry.nsPedState === 'green'
                      ? 'text-emerald-300'
                      : telemetry.nsPedState === 'blinking'
                      ? 'text-amber-300'
                      : 'text-rose-300'
                  }`}
                >
                  {telemetry.nsPedState === 'green'
                    ? `녹색 ${telemetry.nsPedRemaining}초`
                    : telemetry.nsPedState === 'blinking'
                    ? `점멸 ${telemetry.nsPedRemaining}초`
                    : `적색 ${telemetry.nsPedRemaining}초`}
                </div>
              </div>
            </div>

            {/* 'ew' crosswalk crosses East-West roads (walk North <-> South) */}
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border ${
                telemetry.activeCrosswalkAxis === 'ew'
                  ? 'border-cyan-400 bg-slate-800/95'
                  : 'border-slate-700/70 bg-slate-900/80'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${
                  telemetry.ewPedState === 'green'
                    ? 'bg-emerald-400'
                    : telemetry.ewPedState === 'blinking'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
              <div className="leading-none">
                <div className="text-[10px] font-semibold text-slate-400">
                  남↕북 횡단
                </div>
                <div
                  className={`text-xs font-extrabold tabular-nums mt-0.5 ${
                    telemetry.ewPedState === 'green'
                      ? 'text-emerald-300'
                      : telemetry.ewPedState === 'blinking'
                      ? 'text-amber-300'
                      : 'text-rose-300'
                  }`}
                >
                  {telemetry.ewPedState === 'green'
                    ? `녹색 ${telemetry.ewPedRemaining}초`
                    : telemetry.ewPedState === 'blinking'
                    ? `점멸 ${telemetry.ewPedRemaining}초`
                    : `적색 ${telemetry.ewPedRemaining}초`}
                </div>
              </div>
            </div>
          </div>

          {telemetry.nearPhoneWalker && (
            <div className="flex items-center gap-1.5 bg-[#1e1b4b]/95 border border-cyan-400 text-cyan-200 text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg">
              <Smartphone className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>자전거도로 내 스마트폰 보행자 주의! [B] 벨을 울려주세요</span>
            </div>
          )}

          {telemetry.nearPet && (
            <div className="flex items-center gap-1.5 bg-[#2a1808]/95 border border-amber-400 text-amber-200 text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg">
              <PawPrint className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>도로 주변 애완동물 주의! 감속하거나 [B] 벨을 울려주세요</span>
            </div>
          )}

          {telemetry.hazardAlert && (
            <div className="flex items-center gap-1.5 bg-[#2a120a]/95 border border-orange-400 text-orange-200 text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-300 shrink-0" />
              <span>{telemetry.hazardAlert}</span>
            </div>
          )}

          {checkpointToast && (
            <div className="bg-emerald-950/95 border border-emerald-400 text-emerald-200 text-xs font-bold px-4 py-1.5 rounded-xl shadow-lg">
              {checkpointToast}
            </div>
          )}
        </div>

        {/* Top-Right: Minimap + Action Buttons */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-[#0b1220]/90 border border-slate-700/80 rounded-xl p-1.5 shadow-lg">
            <button
              type="button"
              onClick={onCycleCamera}
              title="시점 전환 (C)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{CAMERA_LABELS[cameraPreset]}</span>
            </button>
            <button
              type="button"
              onClick={onRingBell}
              title="경적/벨 (B)"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <Bell className="w-4 h-4 text-amber-300" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title="음소거 전환"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              )}
            </button>
            {mode === 'freeride' && (
              <button
                type="button"
                onClick={onFinishFreeride}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
              >
                주행 종료
              </button>
            )}
            <button
              type="button"
              onClick={onPause}
              title="일시정지 (Esc)"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Crisp SVG Tactical Minimap */}
          <div className="bg-[#0b1220]/90 border border-slate-700/80 rounded-xl p-2 shadow-lg">
            <svg width="136" height="112" viewBox="0 0 136 112" className="block">
              <rect width="136" height="112" rx="6" fill="#0f172a" />
              {/* City Road Loop */}
              <rect
                x={mapX(-90)}
                y={mapZ(-70)}
                width={mapX(90) - mapX(-90)}
                height={mapZ(70) - mapZ(-70)}
                fill="none"
                stroke="#475569"
                strokeWidth="8"
              />
              {/* Red Bike Lanes on South & North streets */}
              <line
                x1={mapX(-83)}
                y1={mapZ(78)}
                x2={mapX(83)}
                y2={mapZ(78)}
                stroke="#dc2626"
                strokeWidth="2.5"
              />
              <line
                x1={mapX(-83)}
                y1={mapZ(-78)}
                x2={mapX(83)}
                y2={mapZ(-78)}
                stroke="#dc2626"
                strokeWidth="2.5"
              />
              {/* School Destination Marker */}
              <g>
                <rect
                  x={mapX(-82)}
                  y={mapZ(84)}
                  width={12}
                  height={8}
                  rx="2"
                  fill="#facc15"
                  stroke="#0f172a"
                  strokeWidth="1"
                />
                <text
                  x={mapX(-72)}
                  y={mapZ(90)}
                  fill="#fef08a"
                  fontSize="7"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  학교
                </text>
              </g>
              {/* Checkpoint Marker */}
              {telemetry.nextCheckpoint && (
                <circle
                  cx={mapX(telemetry.nextCheckpoint.x)}
                  cy={mapZ(telemetry.nextCheckpoint.z)}
                  r="4.5"
                  fill="#10b981"
                  stroke="#ecfdf5"
                  strokeWidth="1.2"
                />
              )}
              {/* Police Cruisers */}
              {telemetry.policeCoords.map((p, idx) => (
                <circle
                  key={idx}
                  cx={mapX(p.x)}
                  cy={mapZ(p.z)}
                  r="3.2"
                  fill={p.chasing ? '#f43f5e' : '#3b82f6'}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              ))}
              {/* Player Indicator */}
              <circle
                cx={mapX(telemetry.playerX)}
                cy={mapZ(telemetry.playerZ)}
                r="4"
                fill="#22d3ee"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>
            <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 px-0.5">
              <span className="text-red-400 font-semibold">━ 자전거도로</span>
              <span className="text-amber-300 font-semibold">■ 학교</span>
              <span className="text-blue-400 font-semibold">● 경찰</span>
            </div>
          </div>
        </div>
      </div>

      {/* Optional On-Screen Touch Drive Controls */}
      {showTouchPad && (
        <div className="flex items-end justify-between px-2 mb-14 pointer-events-auto">
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => onVirtualInput({ left: true })}
              onPointerUp={() => onVirtualInput({ left: false })}
              onPointerLeave={() => onVirtualInput({ left: false })}
              className="w-14 h-14 rounded-xl bg-[#0b1220]/90 border border-slate-600 text-white font-bold text-lg active:bg-cyan-600 cursor-pointer"
            >
              ◀
            </button>
            <button
              type="button"
              onPointerDown={() => onVirtualInput({ right: true })}
              onPointerUp={() => onVirtualInput({ right: false })}
              onPointerLeave={() => onVirtualInput({ right: false })}
              className="w-14 h-14 rounded-xl bg-[#0b1220]/90 border border-slate-600 text-white font-bold text-lg active:bg-cyan-600 cursor-pointer"
            >
              ▶
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => onVirtualInput({ brake: true })}
              onPointerUp={() => onVirtualInput({ brake: false })}
              onPointerLeave={() => onVirtualInput({ brake: false })}
              className="w-16 h-14 rounded-xl bg-[#0b1220]/90 border border-rose-500/70 text-rose-300 font-bold text-xs active:bg-rose-700 cursor-pointer"
            >
              감속/후진
            </button>
            <button
              type="button"
              onPointerDown={() => onVirtualInput({ throttle: true })}
              onPointerUp={() => onVirtualInput({ throttle: false })}
              onPointerLeave={() => onVirtualInput({ throttle: false })}
              className="w-16 h-14 rounded-xl bg-cyan-600/90 border border-cyan-400 text-white font-extrabold text-xs active:bg-cyan-500 cursor-pointer"
            >
              가속 ▲
            </button>
          </div>
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM CONTROL DOCK */}
      <div className="flex flex-col items-center pointer-events-auto">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="flex items-center gap-1 px-3 py-1 rounded-t-lg bg-[#0b1220]/90 border border-b-0 border-slate-700/80 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>계기판 열기</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>계기판 접기</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full max-w-2xl bg-[#0b1220]/92 border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
            {/* Speedometer */}
            <div className="flex items-baseline gap-1.5 min-w-[92px]">
              <span className="text-2xl md:text-3xl font-black tabular-nums text-white">
                {telemetry.speedKmh}
              </span>
              <span className="text-xs font-bold text-slate-400">km/h</span>
            </div>

            {/* Current Zone & Mode */}
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  현재 주행 구역
                </div>
                <div className={`text-xs font-bold ${zoneMeta.color}`}>
                  {zoneMeta.text}
                </div>
              </div>
              <div className="w-px h-7 bg-slate-700" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  도로 유형
                </div>
                <div className="text-xs font-bold text-slate-200">
                  {telemetry.hasBikeLaneHere ? '자전거도로 있음' : '차도 우측 가장자리'}
                </div>
              </div>
            </div>

            {/* Primary Dismount / Mount Action + Touch Pad toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleDismount}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                  telemetry.isDismounted
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {telemetry.isDismounted ? (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>[E] 다시 탑승하기</span>
                  </>
                ) : (
                  <>
                    <Footprints className="w-3.5 h-3.5" />
                    <span>[E] 내려서 끌고 걷기</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowTouchPad((v) => !v)}
                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-semibold text-slate-300 cursor-pointer"
              >
                {showTouchPad ? '터치패드 끄기' : '터치패드'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
