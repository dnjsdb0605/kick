import React from 'react';
import { CitationTicket, GameMode } from '../types/game';
import { Award, RotateCcw, Home } from 'lucide-react';

interface ResultModalProps {
  mode: GameMode;
  score: number;
  totalFines: number;
  elapsedSeconds: number;
  tickets: CitationTicket[];
  onRestart: () => void;
  onQuit: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  mode,
  score,
  totalFines,
  elapsedSeconds,
  tickets,
  onRestart,
  onQuit,
}) => {
  const grade =
    score >= 95 && totalFines === 0
      ? 'S'
      : score >= 80
      ? 'A'
      : score >= 60
      ? 'B'
      : 'C';

  const gradeColor =
    grade === 'S'
      ? 'text-emerald-400 border-emerald-500/60 bg-emerald-950/60'
      : grade === 'A'
      ? 'text-cyan-400 border-cyan-500/60 bg-cyan-950/60'
      : grade === 'B'
      ? 'text-amber-400 border-amber-500/60 bg-amber-950/60'
      : 'text-rose-400 border-rose-500/60 bg-rose-950/60';

  const m = Math.floor(elapsedSeconds / 60);
  const s = Math.floor(elapsedSeconds % 60);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/80">
      <div className="w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">
              {mode === 'mission' ? '푸른솔 학교 정문 안전 등교 완료!' : 'Free Ride Report'}
            </p>
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-400" />
              <span>{mode === 'mission' ? '학교 도착 안전 평가 리포트' : '안전 주행 평가 리포트'}</span>
            </h2>
          </div>
          <div
            className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center ${gradeColor}`}
          >
            <span className="text-[10px] font-bold uppercase opacity-80">등급</span>
            <span className="text-3xl font-black leading-none">{grade}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className="text-[11px] text-slate-400 font-semibold">최종 준법 점수</div>
            <div className="text-xl font-black tabular-nums text-emerald-400 mt-0.5">
              {score}점
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className="text-[11px] text-slate-400 font-semibold">총 납부 벌금</div>
            <div
              className={`text-xl font-black tabular-nums mt-0.5 ${
                totalFines > 0 ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              ₩{totalFines.toLocaleString('ko-KR')}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className="text-[11px] text-slate-400 font-semibold">소요 시간</div>
            <div className="text-xl font-black tabular-nums text-cyan-300 mt-0.5">
              {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-h-44 overflow-y-auto">
          <div className="text-xs font-bold text-slate-300 mb-2">
            단속 적발 내역 ({tickets.length}건)
          </div>
          {tickets.length === 0 ? (
            <p className="text-sm text-emerald-400 font-semibold">
              단 한 건의 법규 위반도 없이 완벽하게 주행했습니다!
            </p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5 last:border-b-0 last:pb-0"
                >
                  <div>
                    <span className="font-bold text-rose-300">{t.title}</span>
                    <span className="text-slate-500 ml-2">{t.lawArticle}</span>
                  </div>
                  <span className="font-bold tabular-nums text-rose-400">
                    -₩{t.fineAmount.toLocaleString('ko-KR')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm py-3 rounded-xl cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>다시 주행하기</span>
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm px-5 py-3 rounded-xl cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>타이틀</span>
          </button>
        </div>
      </div>
    </div>
  );
};
