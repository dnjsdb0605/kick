import React from 'react';
import { Play, RotateCcw, Home } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onQuit,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/70">
      <div className="w-full max-w-sm bg-[#0f172a] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">
            Paused
          </p>
          <h2 className="text-2xl font-extrabold text-white">일시 정지</h2>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5">
          <div>• <strong className="text-white">W / A / S / D</strong> : 가속 · 조향 · 감속</div>
          <div>• <strong className="text-white">Space</strong> : 급제동 브레이크</div>
          <div>• <strong className="text-white">E</strong> : 킥보드 하차(끌고 걷기) / 승차</div>
          <div>• <strong className="text-white">B</strong> : 벨 울리기 · <strong className="text-white">C</strong> : 카메라 시점 전환</div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm py-3 rounded-xl cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>계속 주행 (Esc)</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm py-3 rounded-xl cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>처음부터 다시하기</span>
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm py-3 rounded-xl cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>타이틀 화면으로</span>
          </button>
        </div>
      </div>
    </div>
  );
};
