import React from 'react';
import { GameMode, SCOOTER_SPECS, ScooterType } from '../types/game';
import {
  Bike,
  Compass,
  GraduationCap,
  Palette,
  Play,
  ShieldAlert,
  Footprints,
} from 'lucide-react';

interface TitleScreenProps {
  scooterType: ScooterType;
  customPixels: string[];
  onSelectScooter: (type: ScooterType) => void;
  onOpenPixelEditor: () => void;
  onStart: (mode: GameMode) => void;
}

const SCOOTER_ORDER: ScooterType[] = ['standard', 'ssing', 'premium', 'custom'];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  scooterType,
  customPixels,
  onSelectScooter,
  onOpenPixelEditor,
  onStart,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 md:p-8 pointer-events-none overflow-y-auto">
      {/* Left Editorial Title & Garage Lockup (keeps right side open for live 3D kickboard showcase) */}
      <div className="max-w-lg bg-[#0b1220]/92 border border-slate-700/80 rounded-2xl p-5 md:p-6 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-3 mb-3">
          <svg
            width="44"
            height="44"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden="true"
          >
            <rect width="48" height="48" rx="12" fill="#0f172a" stroke="#06b6d4" strokeWidth="2" />
            <circle cx="14" cy="34" r="5" stroke="#38bdf8" strokeWidth="2.5" />
            <circle cx="34" cy="34" r="5" stroke="#38bdf8" strokeWidth="2.5" />
            <path
              d="M14 34H30L33 16H27"
              stroke="#f8fafc"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M31 16L36 16" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
            <path d="M18 14C18 10.6863 20.6863 8 24 8C27.3137 8 30 10.6863 30 14H18Z" fill="#facc15" />
          </svg>
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-cyan-400">
              WebGL2 3D PM Traffic Simulator
            </p>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
              전동킥보드 안전 등교 시뮬레이터
            </h1>
          </div>
        </div>

        <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-4 flex items-start gap-1.5">
          <GraduationCap className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <span>
            도로교통법을 지키며 자전거·스마트폰 보행자를 피해{' '}
            <strong className="text-amber-300">푸른솔 학교 정문</strong>까지 안전하게 등교하세요.
          </span>
        </p>

        {/* 4 Scooter Selector */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">
              기체 선택 (우측 3D 화면 실시간 확인)
            </span>
            {scooterType === 'custom' && (
              <button
                type="button"
                onClick={onOpenPixelEditor}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500 hover:bg-pink-400 text-slate-950 text-[11px] font-extrabold cursor-pointer transition-colors"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>픽셀 제작</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SCOOTER_ORDER.map((type) => {
              const spec = SCOOTER_SPECS[type];
              const active = scooterType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSelectScooter(type)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-slate-800/95 border-cyan-400 ring-1 ring-cyan-400/60'
                      : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-500'
                  }`}
                >
                  {type === 'custom' ? (
                    <div
                      className="w-8 h-8 rounded-lg shrink-0 overflow-hidden border border-slate-600 grid"
                      style={{
                        gridTemplateColumns: 'repeat(16, 1fr)',
                        gridTemplateRows: 'repeat(16, 1fr)',
                      }}
                    >
                      {customPixels.map((c, idx) => (
                        <span key={idx} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  ) : (
                    <span
                      className="w-8 h-8 rounded-lg shrink-0 border border-white/20 flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${spec.primaryColor} 45%, ${spec.accentColor} 100%)`,
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: spec.accentColor }}
                      />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">
                      {spec.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {spec.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Core Rules */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-900/90 border border-slate-700/70 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold mb-0.5">
              <Bike className="w-3.5 h-3.5" />
              <span>자전거도로·우측</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug">
              자전거도로 우선, 없으면 차도 우측 가장자리 통행
            </p>
          </div>
          <div className="bg-slate-900/90 border border-slate-700/70 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-rose-400 text-[11px] font-bold mb-0.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>인도 주행 금지</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug">
              인도 진입 후 2.5초 내 미복귀 시 경찰 출동·벌금
            </p>
          </div>
          <div className="bg-slate-900/90 border border-slate-700/70 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-amber-400 text-[11px] font-bold mb-0.5">
              <Footprints className="w-3.5 h-3.5" />
              <span>하차 보행 · 벨</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug">
              횡단보도 [E] 하차 보행 · 보행자 발견 시 [B] 벨
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onStart('mission')}
            className="flex-1 min-w-[170px] flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-extrabold text-sm py-3 px-4 rounded-xl transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>학교 등교 미션 시작</span>
          </button>
          <button
            type="button"
            onClick={() => onStart('freeride')}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 font-bold text-sm py-3 px-4 rounded-xl transition-colors cursor-pointer"
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>자유 주행</span>
          </button>
        </div>
      </div>

      {/* Single flat control-hint line at bottom */}
      <div className="self-start mt-3 bg-[#0b1220]/90 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-slate-300 font-medium pointer-events-auto">
        W/A/S/D 주행 · Space 브레이크 · E 하차/끌고걷기 · B 벨(보행자 비켜줌) · C 시점전환 · Esc 일시정지
      </div>
    </div>
  );
};
