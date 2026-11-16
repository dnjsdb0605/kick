import React, { useEffect } from 'react';
import { CitationTicket } from '../types/game';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

interface TicketModalProps {
  ticket: CitationTicket;
  totalFines: number;
  onAcknowledge: () => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  ticket,
  totalFines,
  onAcknowledge,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onAcknowledge();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAcknowledge]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-md bg-[#0f172a] border-2 border-rose-500 rounded-2xl shadow-2xl overflow-hidden">
        {/* Police Citation Header */}
        <div className="bg-rose-600 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-extrabold text-sm tracking-wide">
              경찰청 PM 교통법규 위반 범칙금 고지서
            </span>
          </div>
          <span className="text-xs font-mono font-bold bg-rose-900/70 text-rose-100 px-2 py-0.5 rounded">
            NO.{String(ticket.id).padStart(3, '0')}
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="text-xs font-bold text-rose-400 mb-1">
              {ticket.lawArticle}
            </div>
            <h2 className="text-xl font-extrabold text-white mb-2">
              {ticket.title}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {ticket.description}
            </p>
          </div>

          <div className="flex items-center justify-between bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-3">
            <div>
              <div className="text-xs text-slate-400 font-semibold">이번 범칙금</div>
              <div className="text-2xl font-black tabular-nums text-rose-400">
                ₩{ticket.fineAmount.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-semibold">누적 벌금 합계</div>
              <div className="text-lg font-extrabold tabular-nums text-slate-200">
                ₩{totalFines.toLocaleString('ko-KR')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onAcknowledge}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm py-3.5 rounded-xl transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>범칙금 납부 및 주행 재개 (Enter / Space)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
