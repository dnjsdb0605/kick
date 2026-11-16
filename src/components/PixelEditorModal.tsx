import React, { useState } from 'react';
import { createDefaultCustomPixels } from '../types/game';
import { Check, Eraser, FlipHorizontal, Palette, RotateCcw, Sparkles, X } from 'lucide-react';

interface PixelEditorModalProps {
  initialPixels: string[];
  onSave: (pixels: string[]) => void;
  onClose: () => void;
}

const PALETTE = [
  '#0f172a',
  '#1e293b',
  '#f8fafc',
  '#38bdf8',
  '#06b6d4',
  '#10b981',
  '#facc15',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#3b82f6',
];

function makePreset(type: 'cyber' | 'mint' | 'rainbow' | 'star'): string[] {
  const px = new Array<string>(256).fill('#0f172a');
  if (type === 'cyber') return createDefaultCustomPixels();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const i = y * 16 + x;
      if (type === 'mint') {
        if (x === 1 || x === 14) px[i] = '#10b981';
        else if (x >= 5 && x <= 10 && (y + x) % 3 === 0) px[i] = '#38bdf8';
        else if (y === 0 || y === 15) px[i] = '#facc15';
      } else if (type === 'rainbow') {
        const bands = ['#ef4444', '#f97316', '#facc15', '#10b981', '#38bdf8', '#a855f7', '#ec4899'];
        if (x >= 2 && x <= 13) {
          px[i] = bands[Math.floor((y / 16) * bands.length)];
        } else {
          px[i] = '#f8fafc';
        }
      } else if (type === 'star') {
        const dx = Math.abs(x - 7.5);
        const dy = Math.abs(y - 7.5);
        if (dx + dy <= 4.5 || (dx < 1.5 && dy < 7) || (dy < 1.5 && dx < 7)) {
          px[i] = '#facc15';
        } else if (x === 0 || x === 15 || y === 0 || y === 15) {
          px[i] = '#ec4899';
        }
      }
    }
  }
  return px;
}

export const PixelEditorModal: React.FC<PixelEditorModalProps> = ({
  initialPixels,
  onSave,
  onClose,
}) => {
  const [pixels, setPixels] = useState<string[]>(() => [...initialPixels]);
  const [selectedColor, setSelectedColor] = useState<string>('#38bdf8');
  const [mirrorX, setMirrorX] = useState<boolean>(true);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  const paintCell = (idx: number, color: string) => {
    setPixels((prev) => {
      const next = [...prev];
      next[idx] = color;
      if (mirrorX) {
        const y = Math.floor(idx / 16);
        const x = idx % 16;
        const mx = 15 - x;
        next[y * 16 + mx] = color;
      }
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4"
      onPointerUp={() => setIsDrawing(false)}
      onPointerLeave={() => setIsDrawing(false)}
    >
      <div className="w-full max-w-2xl bg-[#0b1220] border border-slate-700 rounded-2xl p-5 md:p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-300">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                커스텀 킥보드 픽셀 스튜디오 (16×16)
              </h2>
              <p className="text-xs text-slate-400">
                드래그하여 발판과 전면 실드 데칼을 직접 디자인하세요
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-start">
          {/* 16x16 Interactive Grid */}
          <div className="mx-auto bg-slate-900 p-2.5 rounded-xl border border-slate-700 select-none touch-none">
            <div
              className="grid gap-[1px] bg-slate-800"
              style={{
                gridTemplateColumns: 'repeat(16, 16px)',
                gridTemplateRows: 'repeat(16, 16px)',
              }}
            >
              {pixels.map((col, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`픽셀 ${idx}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setIsDrawing(true);
                    paintCell(idx, selectedColor);
                  }}
                  onPointerEnter={() => {
                    if (isDrawing) paintCell(idx, selectedColor);
                  }}
                  className="w-4 h-4 block cursor-crosshair border-0 p-0"
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          {/* Palette, Symmetry & Presets */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2">색상 팔레트</div>
              <div className="grid grid-cols-6 gap-2">
                {PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setSelectedColor(hex)}
                    className={`h-8 rounded-lg border-2 transition-transform cursor-pointer ${
                      selectedColor === hex
                        ? 'border-white scale-105'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMirrorX((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  mirrorX
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>좌우 대칭 {mirrorX ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedColor('#0f172a')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>지우개</span>
              </button>

              <button
                type="button"
                onClick={() => setPixels(new Array<string>(256).fill('#0f172a'))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>전체 초기화</span>
              </button>
            </div>

            <div>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-300 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>빠른 프리셋</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPixels(makePreset('cyber'))}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                >
                  사이버 불꽃
                </button>
                <button
                  type="button"
                  onClick={() => setPixels(makePreset('mint'))}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                >
                  에메랄드 민트
                </button>
                <button
                  type="button"
                  onClick={() => setPixels(makePreset('rainbow'))}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                >
                  레인보우 라인
                </button>
                <button
                  type="button"
                  onClick={() => setPixels(makePreset('star'))}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                >
                  스타 엠블럼
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSave(pixels)}
                className="flex-1 flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-400 text-slate-950 font-extrabold text-sm py-3 px-4 rounded-xl cursor-pointer transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>3D 킥보드에 적용하기</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
