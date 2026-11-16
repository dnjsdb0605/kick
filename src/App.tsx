import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { PixelEditorModal } from './components/PixelEditorModal';
import { ResultModal } from './components/ResultModal';
import { TicketModal } from './components/TicketModal';
import { TitleScreen } from './components/TitleScreen';
import { CHECKPOINTS } from './game/cityLayout';
import { KickboardEngine } from './game/KickboardEngine';
import {
  CameraPreset,
  CitationTicket,
  createDefaultCustomPixels,
  GameMode,
  GamePhase,
  ScooterType,
  TelemetrySnapshot,
} from './types/game';

const INITIAL_TELEMETRY: TelemetrySnapshot = {
  speedKmh: 0,
  isDismounted: false,
  zone: 'bike_lane',
  hasBikeLaneHere: true,
  ruleStatus: 'legal',
  ruleMessage: '✅ 전용 자전거도로 · 완벽한 준법 주행!',
  score: 100,
  totalFines: 0,
  violationCount: 0,
  policeAlert: 'none',
  policeDistance: 99,
  suspicionProgress: 0,
  checkpointIndex: 0,
  totalCheckpoints: CHECKPOINTS.length,
  lapCount: 0,
  elapsedSeconds: 0,
  distanceToSchoolMeters: 590,
  nearCrosswalk: false,
  pedLightState: null,
  activeCrosswalkAxis: null,
  ewPedState: 'red',
  nsPedState: 'green',
  ewPedRemaining: 22,
  nsPedRemaining: 20,
  nearPhoneWalker: false,
  playerX: -48,
  playerZ: 78.2,
  playerHeading: -Math.PI / 2,
  policeCoords: [],
  nextCheckpoint: CHECKPOINTS[0],
  graceTimer: 0,
  violationGraceRemaining: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<KickboardEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [mode, setMode] = useState<GameMode>('mission');
  const [scooterType, setScooterType] = useState<ScooterType>('standard');
  const [customPixels, setCustomPixels] = useState<string[]>(() =>
    createDefaultCustomPixels()
  );
  const [pixelEditorOpen, setPixelEditorOpen] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('chase');
  const [muted, setMuted] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(INITIAL_TELEMETRY);
  const [activeTicket, setActiveTicket] = useState<CitationTicket | null>(null);
  const [ticketHistory, setTicketHistory] = useState<CitationTicket[]>([]);
  const [checkpointToast, setCheckpointToast] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new KickboardEngine(mount, {
      onTelemetry: (snap) => {
        setTelemetry(snap);
      },
      onTicketIssued: (ticket) => {
        setActiveTicket(ticket);
        setTicketHistory((prev) => [...prev, ticket]);
        setPhase('ticket');
      },
      onCheckpointReached: (label, isFinal) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setCheckpointToast(
          isFinal ? `🏁 ${label} 완료!` : `✅ ${label} 통과! (+5점)`
        );
        toastTimerRef.current = window.setTimeout(() => {
          setCheckpointToast(null);
        }, 2800);
      },
      onMissionComplete: () => {
        setPhase('result');
      },
    });

    engineRef.current = engine;

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback((selectedMode: GameMode) => {
    setMode(selectedMode);
    setTicketHistory([]);
    setActiveTicket(null);
    setCheckpointToast(null);
    setPhase('playing');
    engineRef.current?.startGame(selectedMode);
  }, []);

  const handlePause = useCallback(() => {
    if (phase === 'playing') {
      setPhase('paused');
      engineRef.current?.setPhase('paused');
    } else if (phase === 'paused') {
      setPhase('playing');
      engineRef.current?.setPhase('playing');
    }
  }, [phase]);

  const handleQuitToTitle = useCallback(() => {
    setPhase('title');
    setActiveTicket(null);
    engineRef.current?.setPhase('title');
  }, []);

  const handleAcknowledgeTicket = useCallback(() => {
    setActiveTicket(null);
    setPhase('playing');
    engineRef.current?.acknowledgeTicket();
  }, []);

  const handleToggleDismount = useCallback(() => {
    engineRef.current?.toggleDismount();
  }, []);

  const handleCycleCamera = useCallback(() => {
    if (!engineRef.current) return;
    const next = engineRef.current.cycleCameraPreset();
    setCameraPreset(next);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleFinishFreeride = useCallback(() => {
    engineRef.current?.setPhase('result');
    setPhase('result');
  }, []);

  const handleSelectScooter = useCallback(
    (type: ScooterType) => {
      setScooterType(type);
      engineRef.current?.setScooterConfig(type, customPixels);
    },
    [customPixels]
  );

  const handleSaveCustomPixels = useCallback((pixels: string[]) => {
    setCustomPixels(pixels);
    setScooterType('custom');
    engineRef.current?.setScooterConfig('custom', pixels);
    setPixelEditorOpen(false);
  }, []);

  // Global keyboard shortcuts for Title start & Esc pause/resume
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (pixelEditorOpen) {
          e.preventDefault();
          setPixelEditorOpen(false);
        } else if (phase === 'playing' || phase === 'paused') {
          e.preventDefault();
          handlePause();
        }
      } else if (
        phase === 'title' &&
        !pixelEditorOpen &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        handleStart('mission');
      } else if (phase === 'playing' && e.code === 'KeyC' && !e.repeat) {
        // Sync camera label in React HUD when user presses C
        setCameraPreset((prev) => {
          const order: CameraPreset[] = ['chase', 'firstPerson', 'topDown'];
          return order[(order.indexOf(prev) + 1) % order.length];
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, pixelEditorOpen, handlePause, handleStart]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b1220]">
      {/* Isolated WebGL2 Canvas Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Game Shell Overlays */}
      {phase === 'title' && (
        <TitleScreen
          scooterType={scooterType}
          customPixels={customPixels}
          onSelectScooter={handleSelectScooter}
          onOpenPixelEditor={() => {
            setScooterType('custom');
            engineRef.current?.setScooterConfig('custom', customPixels);
            setPixelEditorOpen(true);
          }}
          onStart={handleStart}
        />
      )}

      {pixelEditorOpen && (
        <PixelEditorModal
          initialPixels={customPixels}
          onSave={handleSaveCustomPixels}
          onClose={() => setPixelEditorOpen(false)}
        />
      )}

      {(phase === 'playing' || phase === 'paused' || phase === 'ticket') && (
        <GameHUD
          telemetry={telemetry}
          mode={mode}
          cameraPreset={cameraPreset}
          muted={muted}
          checkpointToast={checkpointToast}
          onToggleDismount={handleToggleDismount}
          onCycleCamera={handleCycleCamera}
          onRingBell={() => engineRef.current?.ringBell()}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onFinishFreeride={handleFinishFreeride}
          onVirtualInput={(patch) => engineRef.current?.setVirtualInput(patch)}
        />
      )}

      {phase === 'ticket' && activeTicket && (
        <TicketModal
          ticket={activeTicket}
          totalFines={telemetry.totalFines}
          onAcknowledge={handleAcknowledgeTicket}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          onResume={handlePause}
          onRestart={() => handleStart(mode)}
          onQuit={handleQuitToTitle}
        />
      )}

      {phase === 'result' && (
        <ResultModal
          mode={mode}
          score={telemetry.score}
          totalFines={telemetry.totalFines}
          elapsedSeconds={telemetry.elapsedSeconds}
          tickets={ticketHistory}
          onRestart={() => handleStart(mode)}
          onQuit={handleQuitToTitle}
        />
      )}
    </div>
  );
}
