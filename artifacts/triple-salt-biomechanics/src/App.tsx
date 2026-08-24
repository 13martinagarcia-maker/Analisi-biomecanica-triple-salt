import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import referenceImage from '@assets/IMG-20260708-WA0000_1787472726299.jpg';
import {
  Activity,
  ArrowDownToLine,
  Check,
  ChevronDown,
  Crosshair,
  FileVideo,
  Gauge,
  Grid3X3,
  Info,
  Layers3,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ScanLine,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Target,
  UserRound,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

type PhaseKey = 'HOP' | 'STEP' | 'JUMP';
type PointKey = 'hip' | 'knee' | 'ankle';
type GuideKey = 'horizontal' | 'vertical' | 'grid';
type AngleMode = 'vertex' | 'segments';
type AnglePoint = {
  id: string;
  x: number;
  y: number;
  source: 'landmark' | 'manual';
  landmarkIndex?: number;
  corrected?: boolean;
};
type FrameSlot = {
  frame: number | null;
  points: AnglePoint[];
  angleMode: AngleMode;
  label: string;
  referenceId: '' | 'lead' | 'trail' | 'internal' | 'trajectory';
};

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type PoseResult = {
  poseLandmarks?: Landmark[];
};

type MultiPoseResult = {
  landmarks: Landmark[][];
};

type PoseInstance = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: PoseResult) => void) => void;
  send: (payload: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

type PoseLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => MultiPoseResult;
  close?: () => void;
};

declare global {
  interface Window {
    Pose?: new (options: { locateFile: (file: string) => string }) => PoseInstance;
  }
}

type PhaseMark = {
  start: string;
  end: string;
};

type Measurement = {
  primary: string;
  secondary: string;
  internal: string;
  trajectory: string;
};

type ManualPoint = {
  x: number;
  y: number;
};

const makePointId = () => `angle-point-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const REFERENCE_ROWS: Array<{
  phase: PhaseKey;
  lead: string;
  trail: string;
  internal: string;
  trajectory: string;
}> = [
  { phase: 'HOP', lead: '69±3°', trail: '62±3°', internal: 'α 142±3°', trajectory: '17±1°' },
  { phase: 'STEP', lead: '68±2°', trail: '61±3°', internal: 'β 138±3°', trajectory: '14±1°' },
  { phase: 'JUMP', lead: '66±2°', trail: '63±3°', internal: 'γ 135±3°', trajectory: '18±2°' },
];

const CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
];

const LANDMARK_NAMES = [
  'Nas', 'Ull esquerre', 'Ull dret', 'Orella esquerra', 'Orella dreta',
  'Espatlla esquerra', 'Espatlla dreta', 'Colze esquerre', 'Colze dret',
  'Canell esquerre', 'Canell dret', 'Dit petit esquerre', 'Dit petit dret',
  'Dit índex esquerre', 'Dit índex dret', 'Polze esquerre', 'Polze dret',
  'Maluc esquerre', 'Maluc dret', 'Genoll esquerre', 'Genoll dret',
  'Turmell esquerre', 'Turmell dret', 'Taló esquerre', 'Taló dret',
  'Peu esquerre', 'Peu dret', 'Punta peu esquerre', 'Punta peu dret',
  'Taló esquerre 2', 'Taló dret 2', 'Punta esquerra 2', 'Punta dreta 2',
];

const INITIAL_PHASES: Record<PhaseKey, PhaseMark> = {
  HOP: { start: '', end: '' },
  STEP: { start: '', end: '' },
  JUMP: { start: '', end: '' },
};

const INITIAL_MEASUREMENTS: Record<PhaseKey, Measurement> = {
  HOP: { primary: '', secondary: '', internal: '', trajectory: '' },
  STEP: { primary: '', secondary: '', internal: '', trajectory: '' },
  JUMP: { primary: '', secondary: '', internal: '', trajectory: '' },
};

const createEmptyFrameSlots = (): Record<PhaseKey, FrameSlot[]> => ({
  HOP: [0, 1, 2].map(() => ({ frame: null, points: [], angleMode: 'vertex', label: '', referenceId: '' })),
  STEP: [0, 1, 2].map(() => ({ frame: null, points: [], angleMode: 'vertex', label: '', referenceId: '' })),
  JUMP: [0, 1, 2].map(() => ({ frame: null, points: [], angleMode: 'vertex', label: '', referenceId: '' })),
});

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '00:00.000';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(3).padStart(6, '0')}`;
};

const frameForTime = (time: number, fps: number) => Math.max(0, Math.round(time * fps));

const calculateAngle = (
  first: { x: number; y: number },
  vertex: { x: number; y: number },
  last: { x: number; y: number },
) => {
  const firstVector = { x: first.x - vertex.x, y: first.y - vertex.y };
  const lastVector = { x: last.x - vertex.x, y: last.y - vertex.y };
  const numerator = firstVector.x * lastVector.x + firstVector.y * lastVector.y;
  const denominator = Math.hypot(firstVector.x, firstVector.y) * Math.hypot(lastVector.x, lastVector.y);
  if (!denominator) return null;
  return Math.acos(Math.min(1, Math.max(-1, numerator / denominator))) * (180 / Math.PI);
};

const calculateSegmentAngle = (
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
) => {
  const firstVector = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const secondVector = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  const denominator = Math.hypot(firstVector.x, firstVector.y) * Math.hypot(secondVector.x, secondVector.y);
  if (!denominator) return null;
  const numerator = firstVector.x * secondVector.x + firstVector.y * secondVector.y;
  return Math.acos(Math.min(1, Math.max(-1, numerator / denominator))) * (180 / Math.PI);
};

const parseReferenceRange = (value: string) => {
  const match = value.match(/(\d+(?:\.\d+)?)±(\d+(?:\.\d+)?)/);
  return match ? { target: Number(match[1]), tolerance: Number(match[2]) } : null;
};

const initials = (name: string) =>
  name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<PoseInstance | null>(null);
  const multiPoseRef = useRef<PoseLandmarkerInstance | null>(null);
  const trackedPoseRef = useRef<Landmark[] | null>(null);
  const athleteLockedRef = useRef(false);
  const selectedPoseIndexRef = useRef<number | null>(null);
  const poseEngineLoadingRef = useRef(false);
  const poseLoadingRef = useRef(false);
  const poseBusyRef = useRef(false);
  const lastInferenceAtRef = useRef(0);
  const playbackLoopRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const suppressCanvasClickRef = useRef(false);
  const [athletes, setAthletes] = useState(['Maya Carter', 'Noah Williams', 'Inez Bell']);
  const [athlete, setAthlete] = useState('Maya Carter');
  const [createAthleteOpen, setCreateAthleteOpen] = useState(false);
  const [newAthlete, setNewAthlete] = useState('');
  const [toast, setToast] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
  const [fileName, setFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(30);
  const [poseStatus, setPoseStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [poseCandidates, setPoseCandidates] = useState<Landmark[][]>([]);
  const [selectedPoseIndex, setSelectedPoseIndex] = useState<number | null>(null);
  const [athleteLocked, setAthleteLocked] = useState(false);
  const [athleteSelectionMode, setAthleteSelectionMode] = useState(false);
  const [trackingWarning, setTrackingWarning] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [frameCorrections, setFrameCorrections] = useState<Record<number, Partial<Record<PointKey, ManualPoint>>>>({});
  const [confidence, setConfidence] = useState<number | null>(null);
  const [phases, setPhases] = useState<Record<PhaseKey, PhaseMark>>(INITIAL_PHASES);
  const [activePhase, setActivePhase] = useState<PhaseKey>('HOP');
  const [proposals, setProposals] = useState<Array<{ frame: number; time: number; score: number; reason: string }>>([]);
  const [guides, setGuides] = useState<Record<GuideKey, boolean>>({
    horizontal: true,
    vertical: false,
    grid: false,
  });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [manualPointMode, setManualPointMode] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PointKey>('knee');
  const [manualPoints, setManualPoints] = useState<Partial<Record<PointKey, ManualPoint>>>({});
  const [angleSelectionMode, setAngleSelectionMode] = useState(false);
  const [draggingAnglePointId, setDraggingAnglePointId] = useState<string | null>(null);
  const [activeClipPhase, setActiveClipPhase] = useState<PhaseKey>('HOP');
  const [activeFrameSlot, setActiveFrameSlot] = useState(0);
  const [frameSlots, setFrameSlots] = useState<Record<PhaseKey, FrameSlot[]>>(createEmptyFrameSlots);
  const [landmarkCache, setLandmarkCache] = useState<Record<number, Landmark[]>>({});
  const [angleDefinition, setAngleDefinition] = useState<'internal' | 'segment-horizontal' | 'trajectory-horizontal'>('internal');
  const [measurements, setMeasurements] = useState<Record<PhaseKey, Measurement>>(INITIAL_MEASUREMENTS);
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const currentFrame = frameForTime(currentTime, fps);
  const activeReference = REFERENCE_ROWS.find((row) => row.phase === activePhase)!;
  const activeMeasurement = measurements[activePhase];
  const activeSlot = frameSlots[activeClipPhase][activeFrameSlot];
  const requiredAnglePointCount = activeSlot.angleMode === 'segments' ? 4 : 3;
  const activeClipMark = phases[activeClipPhase];
  const activeClipStart = activeClipMark.start ? Number(activeClipMark.start) / fps : 0;
  const activeClipEnd = activeClipMark.end ? Number(activeClipMark.end) / fps : duration;
  const allFramesSelected = (['HOP', 'STEP', 'JUMP'] as PhaseKey[])
    .every((phase) => frameSlots[phase].every((slot) => slot.frame !== null));

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  const drawOverlay = useCallback((poseLandmarks: Landmark[] | null, candidates = poseCandidates, selectedIndex = selectedPoseIndex) => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(height * pixelRatio));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    const video = videoRef.current;
    const videoWidth = video?.videoWidth || 16;
    const videoHeight = video?.videoHeight || 9;
    const scale = Math.min(width / videoWidth, height / videoHeight);
    const offsetX = (width - videoWidth * scale) / 2;
    const offsetY = (height - videoHeight * scale) / 2;
    const point = (landmark: Landmark) => ({
      x: offsetX + landmark.x * videoWidth * scale,
      y: offsetY + landmark.y * videoHeight * scale,
    });

    if (guides.grid) {
      context.strokeStyle = 'rgba(255, 211, 101, .14)';
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 32) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += 32) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
    }
    context.setLineDash([8, 7]);
    context.lineWidth = 1.25;
    context.strokeStyle = 'rgba(255, 211, 101, .8)';
    if (guides.horizontal) {
      context.beginPath();
      context.moveTo(0, height * .69);
      context.lineTo(width, height * .69);
      context.stroke();
    }
    if (guides.vertical) {
      context.beginPath();
      context.moveTo(width * .5, 0);
      context.lineTo(width * .5, height);
      context.stroke();
    }
    context.setLineDash([]);

    const drawPose = (candidate: Landmark[], isSelected: boolean) => {
      context.strokeStyle = isSelected ? '#ffd365' : 'rgba(249, 240, 221, .42)';
      context.lineWidth = isSelected ? 2.5 : 1.25;
      CONNECTIONS.forEach(([start, end]) => {
        const first = candidate[start];
        const last = candidate[end];
        if (!first || !last) return;
        const firstPoint = point(first);
        const lastPoint = point(last);
        context.beginPath();
        context.moveTo(firstPoint.x, firstPoint.y);
        context.lineTo(lastPoint.x, lastPoint.y);
        context.stroke();
      });
      candidate.forEach((landmark, index) => {
        if ((landmark.visibility ?? 1) < .35) return;
        const position = point(landmark);
        context.fillStyle = isSelected ? (index === 25 || index === 26 ? '#df5b31' : '#ffd365') : 'rgba(249, 240, 221, .65)';
        context.beginPath();
        context.arc(position.x, position.y, isSelected && (index === 25 || index === 26) ? 4.4 : 2.6, 0, Math.PI * 2);
        context.fill();
      });
    };

    if (candidates.length) candidates.forEach((candidate, index) => drawPose(candidate, index === selectedIndex));
    else if (poseLandmarks && poseLandmarks.length > 32) drawPose(poseLandmarks, true);

    const selectedAnglePoints = frameSlots[activeClipPhase][activeFrameSlot]?.points ?? [];
    if (selectedAnglePoints.length) {
      context.strokeStyle = '#df5b31';
      context.lineWidth = 3;
      selectedAnglePoints.slice(0, -1).forEach((anglePoint, pointIndex) => {
        const from = point(anglePoint);
        const to = point(selectedAnglePoints[pointIndex + 1]);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      });
      selectedAnglePoints.forEach((anglePoint, pointIndex) => {
        const position = point(anglePoint);
        context.fillStyle = anglePoint.source === 'landmark' ? '#ffd365' : '#df5b31';
        context.strokeStyle = anglePoint.source === 'landmark' ? '#172234' : '#f9f0dd';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(position.x, position.y, 6, 0, Math.PI * 2);
        if (anglePoint.source === 'manual') {
          context.stroke();
        } else {
          context.fill();
          context.stroke();
        }
        context.fillStyle = '#f9f0dd';
        context.font = '600 10px "DM Mono", monospace';
        const sourceLabel = anglePoint.source === 'landmark'
          ? LANDMARK_NAMES[anglePoint.landmarkIndex ?? -1] ?? 'Landmark'
          : 'Manual';
        context.fillText(`${pointIndex + 1} ${sourceLabel}`, position.x + 9, position.y + 3);
      });
    }

    Object.entries(manualPoints).forEach(([key, position]) => {
      if (!position) return;
      context.fillStyle = '#df5b31';
      context.strokeStyle = '#f9f0dd';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(point({ x: position.x, y: position.y }).x, point({ x: position.x, y: position.y }).y, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#f9f0dd';
      context.font = '600 10px "DM Mono", monospace';
      const manualPosition = point({ x: position.x, y: position.y });
      context.fillText(key.toUpperCase(), manualPosition.x + 9, manualPosition.y + 3);
    });
  }, [activeClipPhase, activeFrameSlot, frameSlots, guides, manualPoints, poseCandidates, selectedPoseIndex]);

  useEffect(() => {
    drawOverlay(landmarks);
    const onResize = () => drawOverlay(landmarks);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawOverlay, landmarks]);

  const handlePoseResults = useCallback((results: PoseResult) => {
    const nextLandmarks = results.poseLandmarks ?? null;
    setLandmarks(nextLandmarks);
    setPoseCandidates(nextLandmarks ? [nextLandmarks] : []);
    if (nextLandmarks) setLandmarkCache((previous) => ({ ...previous, [frameForTime(videoRef.current?.currentTime ?? 0, fps)]: nextLandmarks }));
    if (nextLandmarks?.length) {
      const visible = nextLandmarks
        .map((landmark) => landmark.visibility ?? 0)
        .filter((value) => value > 0);
      setConfidence(visible.length ? visible.reduce((sum, value) => sum + value, 0) / visible.length : null);
    } else {
      setConfidence(null);
    }
  }, [fps]);

  const sendFrameToPose = useCallback((force = false) => {
    const video = videoRef.current;
    if ((!poseRef.current && !multiPoseRef.current) || !video || video.readyState < 2 || poseBusyRef.current) return;
    const now = performance.now();
    if (!force && now - lastInferenceAtRef.current < 66) return;
    lastInferenceAtRef.current = now;
    poseBusyRef.current = true;
    try {
      if (multiPoseRef.current) {
        const result = multiPoseRef.current.detectForVideo(video, Math.round(video.currentTime * 1000));
        const nextCandidates = result.landmarks ?? [];
        setPoseCandidates(nextCandidates);
        if (!nextCandidates.length) {
          setLandmarks(null);
          setSelectedPoseIndex(null);
          setTrackingWarning('No person detected on this frame');
          setConfidence(null);
        } else {
          const previous = trackedPoseRef.current;
          let nextIndex = selectedPoseIndexRef.current ?? 0;
          if (athleteLockedRef.current && previous) {
            const descriptor = (pose: Landmark[]) => {
              const leftHip = pose[23];
              const rightHip = pose[24];
              const leftShoulder = pose[11];
              const rightShoulder = pose[12];
              const hips = leftHip && rightHip ? { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 } : pose[0] ?? { x: 0, y: 0 };
              const shoulders = leftShoulder && rightShoulder ? { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 } : hips;
              const torso = Math.max(.02, Math.hypot(hips.x - shoulders.x, hips.y - shoulders.y));
              const shoulderWidth = leftShoulder && rightShoulder ? Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y) : torso;
              return { hips, torso, shoulderWidth };
            };
            const prior = descriptor(previous);
            const ranked = nextCandidates.map((candidate, index) => {
              const current = descriptor(candidate);
              const positionCost = Math.hypot(current.hips.x - prior.hips.x, current.hips.y - prior.hips.y) / prior.torso;
              const torsoCost = Math.abs(Math.log(current.torso / prior.torso));
              const widthCost = Math.abs(Math.log(current.shoulderWidth / prior.shoulderWidth));
              const visibility = candidate.filter((landmark) => (landmark.visibility ?? 1) >= .45).length / Math.max(1, candidate.length);
              return { index, score: positionCost + torsoCost * .55 + widthCost * .35 + (1 - visibility) * .25 };
            }).sort((a, b) => a.score - b.score);
            nextIndex = ranked[0].index;
            const ambiguous = ranked[0].score > 1.05 || (ranked[1] && ranked[1].score - ranked[0].score < .16);
            if (ambiguous) {
              setTrackingWarning('Revisar detecció: la identitat no és prou clara. Selecciona de nou l’atleta per continuar.');
              setAthleteLocked(false);
              athleteLockedRef.current = false;
              setAthleteSelectionMode(true);
              setSelectedPoseIndex(null);
              selectedPoseIndexRef.current = null;
              setLandmarks(null);
              setConfidence(null);
              return;
            } else {
              setTrackingWarning('');
            }
          }
          setSelectedPoseIndex(nextIndex);
           selectedPoseIndexRef.current = nextIndex;
          const selected = nextCandidates[nextIndex];
          trackedPoseRef.current = selected ?? null;
          setLandmarks(selected ?? null);
           if (selected) setLandmarkCache((previousCache) => ({ ...previousCache, [frameForTime(video.currentTime, fps)]: selected }));
          const visible = (selected ?? []).map((landmark) => landmark.visibility ?? 0).filter((value) => value > 0);
          setConfidence(visible.length ? visible.reduce((sum, value) => sum + value, 0) / visible.length : null);
        }
      } else if (poseRef.current) {
        poseRef.current.send({ image: video }).catch(() => setPoseStatus('error'));
      }
    } finally {
      poseBusyRef.current = false;
    }
  }, [fps]);

  const initializePose = useCallback(() => {
    if (poseRef.current || multiPoseRef.current || poseLoadingRef.current || poseEngineLoadingRef.current) return;
    poseEngineLoadingRef.current = true;
    poseLoadingRef.current = true;
    setPoseStatus('loading');
    const setupFallback = () => {
      if (!window.Pose) {
        poseLoadingRef.current = false;
        poseEngineLoadingRef.current = false;
        setPoseStatus('error');
        return;
      }
      try {
        const pose = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: .55,
          minTrackingConfidence: .55,
        });
        pose.onResults(handlePoseResults);
        poseRef.current = pose;
        poseLoadingRef.current = false;
        poseEngineLoadingRef.current = false;
        setPoseStatus('ready');
        window.setTimeout(sendFrameToPose, 120);
      } catch {
        poseLoadingRef.current = false;
        poseEngineLoadingRef.current = false;
        setPoseStatus('error');
      }
    };
    const loadMultiPose = async () => {
      try {
        const moduleUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs';
        const vision = await import(/* @vite-ignore */ moduleUrl) as {
          FilesetResolver: { forVisionTasks: (url: string) => Promise<unknown> };
          PoseLandmarker: { createFromOptions: (fileset: unknown, options: Record<string, unknown>) => Promise<PoseLandmarkerInstance> };
        };
        const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
        const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 5,
          minPoseDetectionConfidence: .45,
          minPosePresenceConfidence: .45,
          minTrackingConfidence: .45,
        });
        multiPoseRef.current = landmarker;
        poseLoadingRef.current = false;
        poseEngineLoadingRef.current = false;
        setPoseStatus('ready');
        window.setTimeout(sendFrameToPose, 120);
      } catch {
        setTrackingWarning('La detecció multipersona no està disponible. S’activa MediaPipe Pose com a detecció real de reserva.');
        if (window.Pose) setupFallback();
        else {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
          script.async = true;
          script.addEventListener('load', setupFallback, { once: true });
          script.addEventListener('error', () => {
            poseLoadingRef.current = false;
            poseEngineLoadingRef.current = false;
            setPoseStatus('error');
            setTrackingWarning('MediaPipe no s’ha pogut carregar. Comprova la connexió i torna-ho a provar.');
          }, { once: true });
          document.head.appendChild(script);
        }
      }
    };
    void loadMultiPose();
  }, [handlePoseResults, sendFrameToPose]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    poseRef.current?.close?.();
    multiPoseRef.current?.close?.();
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, videoSrc]);

  useEffect(() => {
    if (!isPlaying || !videoSrc || poseStatus !== 'ready') return;
    const detectWhilePlaying = () => {
      sendFrameToPose();
      playbackLoopRef.current = window.requestAnimationFrame(detectWhilePlaying);
    };
    playbackLoopRef.current = window.requestAnimationFrame(detectWhilePlaying);
    return () => {
      if (playbackLoopRef.current !== null) window.cancelAnimationFrame(playbackLoopRef.current);
      playbackLoopRef.current = null;
    };
  }, [isPlaying, poseStatus, sendFrameToPose, videoSrc]);

  useEffect(() => {
    setManualPoints(frameCorrections[currentFrame] ?? {});
  }, [currentFrame, frameCorrections]);

  const onVideoLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setCurrentTime(0);
    initializePose();
    window.setTimeout(() => sendFrameToPose(true), 350);
  };

  const onVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (analysisStarted && activeClipMark.end && video.currentTime >= activeClipEnd) {
      video.pause();
      setIsPlaying(false);
      seekTo(activeClipEnd);
      return;
    }
    sendFrameToPose();
  };

  const uploadVideo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      showToast('Choose a video file to begin the bench.');
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setVideoSrc(objectUrl);
    setFileName(file.name);
    setLandmarks(null);
    setPoseCandidates([]);
    setSelectedPoseIndex(null);
    selectedPoseIndexRef.current = null;
    setAthleteLocked(false);
    athleteLockedRef.current = false;
    setAthleteSelectionMode(true);
    setTrackingWarning('Select the athlete to lock tracking before analysis');
    setFrameCorrections({});
    setLandmarkCache({});
    setFrameSlots(createEmptyFrameSlots());
    setAnalysisStarted(false);
    setAngleSelectionMode(false);
    setConfidence(null);
    setPoseStatus(multiPoseRef.current || poseRef.current ? 'ready' : 'idle');
    setProposals([]);
    showToast('Video loaded locally. Pose will run in your browser.');
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const nextTime = Math.min(duration, Math.max(0, time));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    window.setTimeout(() => sendFrameToPose(true), 60);
  };

  const stepFrame = (direction: number) => {
    videoRef.current?.pause();
    seekTo(currentTime + direction / fps);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !videoSrc) {
      showToast('Load a jump video before playback.');
      return;
    }
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => showToast('Playback is blocked by the browser.'));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const lockSelectedAthlete = (index: number) => {
    const candidate = poseCandidates[index];
    if (!candidate) {
      showToast('No detected person is available on this frame.');
      return;
    }
    setSelectedPoseIndex(index);
    selectedPoseIndexRef.current = index;
    trackedPoseRef.current = candidate;
    setAthleteLocked(true);
    athleteLockedRef.current = true;
    setAthleteSelectionMode(false);
    setTrackingWarning('');
    setLandmarks(candidate);
    setLandmarkCache((previous) => ({ ...previous, [currentFrame]: candidate }));
    showToast(`Person ${index + 1} locked as the analyzed athlete.`);
  };

  const changeAthlete = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
    setAthleteLocked(false);
    athleteLockedRef.current = false;
    setAthleteSelectionMode(true);
    setSelectedPoseIndex(null);
    selectedPoseIndexRef.current = null;
    setTrackingWarning('Select the correct person on this frame');
    sendFrameToPose();
  };

  const markPhase = (phase: PhaseKey, edge: 'start' | 'end') => {
    if (!videoSrc) {
      showToast('Load a video before marking frames.');
      return;
    }
    setPhases((previous) => ({
      ...previous,
      [phase]: { ...previous[phase], [edge]: String(currentFrame) },
    }));
    setActivePhase(phase);
  };

  const phaseBounds = (phase: PhaseKey) => {
    const mark = phases[phase];
    return mark.start && mark.end
      ? `${formatTime(Number(mark.start) / fps)} — ${formatTime(Number(mark.end) / fps)}`
      : mark.start
        ? `Inici: ${formatTime(Number(mark.start) / fps)}`
        : 'Encara no definit';
  };

  const startAnalysis = () => {
    const complete = (Object.values(phases) as PhaseMark[]).every((mark) => mark.start && mark.end);
    if (!complete) {
      showToast('Marca l’inici i el final dels tres salts abans d’analitzar.');
      return;
    }
    setFrameSlots(createEmptyFrameSlots());
    setActiveClipPhase('HOP');
    setActiveFrameSlot(0);
    setAnalysisStarted(true);
    seekTo(Number(phases.HOP.start) / fps);
    showToast(athleteLocked
      ? 'Clip HOP obert. Selecciona manualment el primer fotograma.'
      : 'Clip HOP obert. Revisa la detecció i selecciona manualment el primer fotograma.');
  };

  const clearPhase = (phase: PhaseKey) => {
    setPhases((previous) => ({ ...previous, [phase]: { start: '', end: '' } }));
    setFrameSlots((previous) => ({ ...previous, [phase]: createEmptyFrameSlots()[phase] }));
    if (activeClipPhase === phase) setAnalysisStarted(false);
    showToast(`${phase}: selecció esborrada. Torna a marcar l’inici i el final.`);
  };

  const selectFrameSlot = (phase: PhaseKey, slot: number) => {
    setActiveClipPhase(phase);
    setActiveFrameSlot(slot);
    setAngleSelectionMode(false);
    const frame = frameSlots[phase][slot].frame;
    if (frame !== null) {
      setLandmarks(null);
      setConfidence(null);
      seekTo(frame / fps);
    }
  };

  const updateActiveFrameSlot = (update: Partial<FrameSlot>) => {
    setFrameSlots((previous) => ({
      ...previous,
      [activeClipPhase]: previous[activeClipPhase].map((slot, index) => index === activeFrameSlot ? { ...slot, ...update } : slot),
    }));
  };

  const selectCurrentFrameForSlot = () => {
    if (!analysisStarted || !videoSrc) return;
    if (currentTime < activeClipStart || currentTime > activeClipEnd) {
      showToast(`Mou-te dins del fragment ${activeClipPhase} abans de seleccionar el fotograma.`);
      return;
    }
    updateActiveFrameSlot({ frame: currentFrame, points: [], label: activeSlot.label, referenceId: activeSlot.referenceId });
    setLandmarkCache((previous) => landmarks ? { ...previous, [currentFrame]: landmarks } : previous);
    const nextSlot = frameSlots[activeClipPhase].findIndex((slot, index) => index > activeFrameSlot && slot.frame === null);
    if (nextSlot >= 0) {
      window.setTimeout(() => selectFrameSlot(activeClipPhase, nextSlot), 0);
    }
    showToast(`${activeClipPhase} — Fotograma ${activeFrameSlot + 1} seleccionat: F ${currentFrame}.`);
  };

  const clearActiveFrameSlot = () => {
    updateActiveFrameSlot({ frame: null, points: [], label: '', referenceId: '' });
    setAngleSelectionMode(false);
    showToast(`${activeClipPhase} — Fotograma ${activeFrameSlot + 1} esborrat.`);
  };

  const proposeCurrentFrame = () => {
    if (!videoSrc || !landmarks) {
      showToast('Run pose on a visible frame before proposing an important frame.');
      return;
    }
    if (proposals.some((proposal) => proposal.frame === currentFrame)) {
      showToast('That frame is already in the review queue.');
      return;
    }
    const score = Math.round((confidence ?? 0) * 100);
    setProposals((previous) => [
      ...previous,
      { frame: currentFrame, time: currentTime, score, reason: 'Pose visibility at current frame' },
    ].sort((a, b) => a.frame - b.frame));
    showToast(`Frame ${currentFrame} added for coach review.`);
  };

  const setGuide = (guide: GuideKey) => {
    setGuides((previous) => ({ ...previous, [guide]: !previous[guide] }));
  };

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (suppressCanvasClickRef.current) return;
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage || !video) return;
    const stageBounds = stage.getBoundingClientRect();
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const videoWidth = video.videoWidth || 16;
    const videoHeight = video.videoHeight || 9;
    const scale = Math.min(width / videoWidth, height / videoHeight);
    const offsetX = (width - videoWidth * scale) / 2;
    const offsetY = (height - videoHeight * scale) / 2;
    const transformedX = (event.clientX - stageBounds.left) * (width / stageBounds.width);
    const transformedY = (event.clientY - stageBounds.top) * (height / stageBounds.height);
    const clickX = width / 2 + (transformedX - width / 2 - panX) / zoom;
    const clickY = height / 2 + (transformedY - height / 2 - panY) / zoom;
    const rawX = (clickX - offsetX) / (videoWidth * scale);
    const rawY = (clickY - offsetY) / (videoHeight * scale);
    if (rawX < 0 || rawX > 1 || rawY < 0 || rawY > 1) {
      showToast('Selecciona un punt dins de la imatge del vídeo.');
      return;
    }
    const x = Math.min(1, Math.max(0, rawX));
    const y = Math.min(1, Math.max(0, rawY));
    const toStage = (landmark: Landmark) => ({
      x: offsetX + landmark.x * videoWidth * scale,
      y: offsetY + landmark.y * videoHeight * scale,
    });
    if (athleteSelectionMode && poseCandidates.length) {
      const candidateDistance = (candidate: Landmark[]) => Math.min(...candidate
        .filter((landmark) => (landmark.visibility ?? 1) >= .35)
        .map((landmark) => {
          const displayed = toStage(landmark);
          return Math.hypot(displayed.x - clickX, displayed.y - clickY);
        }));
      const distances = poseCandidates.map(candidateDistance);
      const candidateIndex = distances.reduce((best, distance, index) => distance < distances[best] ? index : best, 0);
      if (!Number.isFinite(distances[candidateIndex]) || distances[candidateIndex] > 70) {
        showToast('Fes clic directament sobre l’esquelet de la persona que vols analitzar.');
        return;
      }
      lockSelectedAthlete(candidateIndex);
      return;
    }
    if (angleSelectionMode) {
      if (activeSlot.frame !== currentFrame) {
        showToast('Torna al fotograma seleccionat abans de definir l’angle.');
        return;
      }
      if (activeSlot.points.length >= requiredAnglePointCount) {
        showToast(`Ja hi ha ${requiredAnglePointCount} punts. Arrossega’ls, elimina’n un o prem Repetir.`);
        return;
      }
      const nearest = (landmarks ?? []).reduce((best, landmark, index) => {
        if ((landmark.visibility ?? 1) < .35) return best;
        const distance = Math.hypot(toStage(landmark).x - clickX, toStage(landmark).y - clickY);
        return distance < best.distance ? { index, distance } : best;
      }, { index: -1, distance: Number.POSITIVE_INFINITY });
      const landmarkCorrectionKeys: Partial<Record<number, PointKey>> = { 23: 'hip', 25: 'knee', 27: 'ankle' };
      const correctionKey = nearest.index >= 0 ? landmarkCorrectionKeys[nearest.index] : undefined;
      const landmarkCorrection = correctionKey ? manualPoints[correctionKey] : undefined;
      const nextPoint: AnglePoint = nearest.index >= 0 && nearest.distance <= 26
        ? {
          id: makePointId(),
          x: landmarkCorrection?.x ?? landmarks![nearest.index].x,
          y: landmarkCorrection?.y ?? landmarks![nearest.index].y,
          source: 'landmark',
          landmarkIndex: nearest.index,
          corrected: Boolean(landmarkCorrection),
        }
        : { id: makePointId(), x, y, source: 'manual' };
      const nextPoints = [...activeSlot.points, nextPoint];
      updateActiveFrameSlot({ points: nextPoints });
      if (nextPoints.length === requiredAnglePointCount) {
        setAngleSelectionMode(false);
        showToast('Punts seleccionats. L’angle s’ha calculat amb les coordenades reals.');
      } else {
        showToast(nextPoint.source === 'landmark'
          ? `Punt ${nextPoints.length}: ${LANDMARK_NAMES[nextPoint.landmarkIndex ?? -1] ?? 'landmark MediaPipe'}.`
          : `Punt ${nextPoints.length}: punt manual de la imatge.`);
      }
      return;
    }
    if (!manualPointMode) return;
    setManualPoints((previous) => ({
      ...previous,
      [selectedPoint]: {
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
      },
    }));
    setFrameCorrections((previous) => ({
      ...previous,
      [currentFrame]: {
        ...(previous[currentFrame] ?? {}),
        [selectedPoint]: { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) },
      },
    }));
    const correctionIndex: Record<PointKey, number> = { hip: 23, knee: 25, ankle: 27 };
    if (activeSlot.frame === currentFrame) {
      updateActiveFrameSlot({
        points: activeSlot.points.map((point) => point.source === 'landmark' && point.landmarkIndex === correctionIndex[selectedPoint]
          ? { ...point, x, y, corrected: true }
          : point),
      });
    }
    showToast(`Punt ${selectedPoint} corregit al fotograma actual.`);
  };

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage || !video) return null;
    const stageBounds = stage.getBoundingClientRect();
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const videoWidth = video.videoWidth || 16;
    const videoHeight = video.videoHeight || 9;
    const scale = Math.min(width / videoWidth, height / videoHeight);
    const offsetX = (width - videoWidth * scale) / 2;
    const offsetY = (height - videoHeight * scale) / 2;
    const transformedX = (event.clientX - stageBounds.left) * (width / stageBounds.width);
    const transformedY = (event.clientY - stageBounds.top) * (height / stageBounds.height);
    const clickX = width / 2 + (transformedX - width / 2 - panX) / zoom;
    const clickY = height / 2 + (transformedY - height / 2 - panY) / zoom;
    const x = (clickX - offsetX) / (videoWidth * scale);
    const y = (clickY - offsetY) / (videoHeight * scale);
    return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y, stageX: clickX, stageY: clickY, scale, videoWidth, videoHeight };
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activeSlot.frame !== currentFrame || !activeSlot.points.length) return;
    const click = getCanvasPoint(event);
    if (!click) return;
    const nearest = activeSlot.points.reduce((best, point, index) => {
      const pointX = (stageRef.current!.clientWidth - click.videoWidth * click.scale) / 2 + point.x * click.videoWidth * click.scale;
      const pointY = (stageRef.current!.clientHeight - click.videoHeight * click.scale) / 2 + point.y * click.videoHeight * click.scale;
      const distance = Math.hypot(pointX - click.stageX, pointY - click.stageY);
      return distance < best.distance ? { index, distance } : best;
    }, { index: -1, distance: Number.POSITIVE_INFINITY });
    if (nearest.index < 0 || nearest.distance > 14) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingAnglePointId(activeSlot.points[nearest.index].id);
    event.preventDefault();
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!draggingAnglePointId) return;
    const click = getCanvasPoint(event);
    if (!click) return;
    suppressCanvasClickRef.current = true;
    updateActiveFrameSlot({
      points: activeSlot.points.map((point) => point.id === draggingAnglePointId
        ? { ...point, x: click.x, y: click.y, corrected: true }
        : point),
    });
  };

  const handleCanvasPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!draggingAnglePointId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDraggingAnglePointId(null);
    window.setTimeout(() => { suppressCanvasClickRef.current = false; }, 0);
  };

  const resetView = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    showToast('Viewport reset.');
  };

  const liveAngle = useMemo(() => {
    if (!landmarks || landmarks.length < 29) return null;
    const manual = manualPoints.hip && manualPoints.knee && manualPoints.ankle
      ? { hip: manualPoints.hip, knee: manualPoints.knee, ankle: manualPoints.ankle }
      : {
        hip: landmarks[23],
        knee: landmarks[25],
        ankle: landmarks[27],
      };
    if (!manual.hip || !manual.knee || !manual.ankle) return null;
    if (angleDefinition === 'internal') return calculateAngle(manual.hip, manual.knee, manual.ankle);
    const pointA = angleDefinition === 'trajectory-horizontal' ? manual.hip : manual.knee;
    const pointB = angleDefinition === 'trajectory-horizontal' ? manual.knee : manual.ankle;
    return Math.abs(Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x) * (180 / Math.PI));
  }, [angleDefinition, landmarks, manualPoints]);

  const activeComputedAngle = useMemo(() => {
    if (activeSlot.frame === null || activeSlot.points.length !== requiredAnglePointCount) return null;
    if (activeSlot.angleMode === 'segments') {
      const [firstStart, firstEnd, secondStart, secondEnd] = activeSlot.points;
      return calculateSegmentAngle(firstStart, firstEnd, secondStart, secondEnd);
    }
    const [first, vertex, last] = activeSlot.points;
    return calculateAngle(first, vertex, last);
  }, [activeSlot, requiredAnglePointCount]);

  const referenceTextForSlot = (phase: PhaseKey, slot: FrameSlot) => {
    const reference = REFERENCE_ROWS.find((row) => row.phase === phase)!;
    return slot.referenceId ? reference[slot.referenceId] : 'Sense referència assignada';
  };

  const resultRows = useMemo(() => (
    (['HOP', 'STEP', 'JUMP'] as PhaseKey[]).flatMap((phase) => frameSlots[phase].map((slot, index) => {
      const value = slot.angleMode === 'segments'
        ? slot.points.length === 4 ? calculateSegmentAngle(slot.points[0], slot.points[1], slot.points[2], slot.points[3]) : null
        : slot.points.length === 3 ? calculateAngle(slot.points[0], slot.points[1], slot.points[2]) : null;
      return { phase, slot, index, value };
    }))
  ), [frameSlots]);

  const updateMeasurement = (phase: PhaseKey, key: keyof Measurement, value: string) => {
    setMeasurements((previous) => ({
      ...previous,
      [phase]: { ...previous[phase], [key]: value },
    }));
  };

  const addAthlete = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newAthlete.trim();
    if (!trimmed) return;
    if (!athletes.includes(trimmed)) setAthletes((previous) => [...previous, trimmed]);
    setAthlete(trimmed);
    setNewAthlete('');
    setCreateAthleteOpen(false);
    showToast(`${trimmed} is ready for a new local session.`);
  };

  const downloadReport = () => {
    if (!videoSrc) {
      showToast('Add a video before exporting an analysis report.');
      return;
    }
    const lines = [
      'TRIPLE SALT / LOCAL BIOMECHANICS REPORT',
      `Athlete: ${athlete}`,
      `Source: ${fileName}`,
      `Frame rate: ${fps} fps`,
      '',
      ...REFERENCE_ROWS.map((reference) => {
        const measurement = measurements[reference.phase];
        return `${reference.phase}: measured ${measurement.primary || '—'} / ${measurement.secondary || '—'} / ${measurement.internal || '—'} / ${measurement.trajectory || '—'} | reference ${reference.lead}, ${reference.trail}, ${reference.internal}, ${reference.trajectory}`;
      }),
      '',
      'Disclosure: analytical coaching aid; not medical precision.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${athlete.replace(/\s+/g, '-').toLowerCase()}-triple-salt-report.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Report exported with measured fields left traceable.');
  };

  const poseLabel = poseStatus === 'ready'
    ? 'POSE PREPARADA'
    : poseStatus === 'loading'
      ? 'CARREGANT POSE'
      : poseStatus === 'error'
        ? 'POSE NO DISPONIBLE'
        : 'POSE EN ESPERA';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">TS<br />01</div>
          <div>
            <div className="font-display" style={{ fontSize: '1.1rem', lineHeight: 1 }}>Triple Salt</div>
            <div className="sidebar-label" style={{ padding: '.35rem 0 0', color: 'hsl(215 14% 67%)' }}>Anàlisi biomecànica</div>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Seccions d’anàlisi">
          <div className="sidebar-label">Sessió</div>
          <button className="nav-item active" data-testid="button-nav-analysis" onClick={() => document.getElementById('analysis')?.scrollIntoView({ behavior: 'smooth' })}>
            <Activity size={16} /><span>Panell d’anàlisi</span>
          </button>
          <button className="nav-item" data-testid="button-nav-report" onClick={() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' })}>
            <Layers3 size={16} /><span>Informe comparatiu</span>
          </button>
          <button className="nav-item" data-testid="button-nav-settings" onClick={() => showToast('La selecció d’angles es configura al panell de revisió.')}>
            <Settings2 size={16} /><span>Configuració</span>
          </button>
        </nav>
        <div className="sidebar-meta">
          <div className="eyebrow" style={{ color: 'hsl(38 89% 61%)' }}>Sessió local</div>
          <div style={{ marginTop: '.45rem', fontSize: '.7rem', lineHeight: 1.5 }}>El vídeo es manté en aquest navegador. No es puja enlloc.</div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <span className="live-dot" />
            <span className="eyebrow" style={{ color: 'hsl(216 13% 43%)' }}>Sessió 07 / triple salt</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span className="status-badge pending" data-testid="status-analysis-mode"><Gauge size={12} /> {videoSrc ? 'Vídeo local carregat' : 'Sense vídeo carregat'}</span>
            <button className="button-outline" data-testid="button-export-report" onClick={downloadReport}><ArrowDownToLine size={14} /><span>Exportar informe</span></button>
          </div>
        </header>

        <div className="content">
          <section className="page-heading" id="analysis">
            <div>
              <div className="eyebrow" style={{ color: 'hsl(24 76% 48%)' }}>Revisable per disseny</div>
              <h1>De la cursa a<br /><span style={{ color: 'hsl(24 76% 48%)' }}>l’evidència traçable.</span></h1>
              <p>Una eina centrada per a entrenadors i estudiants de ciències de l’esport. Marca els tres salts, revisa els fotogrames i corregeix el model quan la teva mirada tingui més context.</p>
            </div>
            <div style={{ display: 'grid', gap: '.5rem', minWidth: '13rem' }}>
              <label className="field-label" htmlFor="athlete-select">Atleta</label>
              <div className="selector-row">
                <select id="athlete-select" className="select-field" data-testid="select-athlete" value={athlete} onChange={(event) => setAthlete(event.target.value)}>
                  {athletes.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <button className="button-primary" style={{ paddingInline: '.65rem' }} data-testid="button-create-athlete" onClick={() => setCreateAthleteOpen(true)} aria-label="Create athlete"><Plus size={16} /></button>
              </div>
            </div>
          </section>

          <section className="workspace">
            <div className="stack">
              <div className="panel video-panel">
                <div className="panel-header">
                  <div className="panel-title"><Video size={17} /> Revisió del vídeo</div>
                  <div className="eyebrow" style={{ color: 'hsl(216 13% 43%)' }}>{fileName || 'Sense vídeo'}</div>
                </div>
                <div
                  className="video-stage"
                  ref={stageRef}
                  data-testid="video-stage"
                  onWheel={(event) => {
                    if (!videoSrc) return;
                    event.preventDefault();
                    setZoom((value) => Math.min(2.4, Math.max(.7, value - event.deltaY * .001)));
                  }}
                >
                  {videoSrc ? (
                    <>
                      <video
                        ref={videoRef}
                        src={videoSrc}
                        style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}
                        onLoadedMetadata={onVideoLoaded}
                        onTimeUpdate={onVideoTimeUpdate}
                        onSeeked={() => {
                          const video = videoRef.current;
                          if (!video) return;
                          setCurrentTime(video.currentTime);
                          sendFrameToPose(true);
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        playsInline
                        muted
                        data-testid="video-source"
                      />
                      <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        onPointerDown={handleCanvasPointerDown}
                        onPointerMove={handleCanvasPointerMove}
                        onPointerUp={handleCanvasPointerUp}
                        onPointerCancel={handleCanvasPointerUp}
                        style={{
                          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                           pointerEvents: athleteSelectionMode || manualPointMode || angleSelectionMode || (activeSlot.frame === currentFrame && activeSlot.points.length > 0) ? 'auto' : 'none',
                           cursor: draggingAnglePointId ? 'grabbing' : athleteSelectionMode || manualPointMode || angleSelectionMode ? 'crosshair' : activeSlot.points.length ? 'grab' : 'default',
                        }}
                        data-testid="canvas-pose-overlay"
                      />
                      <div className="video-overlay-chip"><span className="status-dot live-dot" />{athleteSelectionMode ? 'SELECCIONA UNA PERSONA' : athleteLocked ? 'ATLETA BLOQUEJAT' : poseLabel}{poseCandidates.length > 1 && !athleteSelectionMode ? ` · ${poseCandidates.length} PERSONES` : ''}</div>
                    </>
                  ) : (
                    <div className="video-empty">
                      <FileVideo size={34} />
                      <h2>Carrega un vídeo per començar</h2>
                      <p>MP4, WebM o qualsevol gravació compatible amb el navegador. La reproducció i la detecció de pose es fan en aquest dispositiu.</p>
                      <label className="button-primary" htmlFor="video-upload" data-testid="label-upload-video"><ArrowDownToLine size={15} /> Tria el vídeo</label>
                      <input id="video-upload" className="file-input" type="file" accept="video/*" onChange={(event) => uploadVideo(event.target.files?.[0])} data-testid="input-video-upload" />
                    </div>
                  )}
                </div>
                <div className="video-controls">
                  <div className="timeline">
                    <input
                      type="range"
                      min={0}
                      max={duration || 1}
                      step={1 / fps}
                      value={Math.min(currentTime, duration || 1)}
                      onChange={(event) => seekTo(Number(event.target.value))}
                      disabled={!videoSrc}
                       aria-label="Línia de temps del vídeo"
                      data-testid="input-video-timeline"
                    />
                    {Object.values(phases).flatMap((mark) => mark.start ? [mark.start] : []).map((frame) => (
                      <span key={frame} className="timeline-marker" style={{ left: `${duration ? (Number(frame) / (duration * fps)) * 100 : 0}%` }} />
                    ))}
                    {(['HOP', 'STEP', 'JUMP'] as PhaseKey[]).map((phase) => {
                      const mark = phases[phase];
                      if (!mark.start || !mark.end || !duration) return null;
                      return <span key={`segment-${phase}`} className={`timeline-segment timeline-segment-${phase.toLowerCase()}`} style={{ left: `${(Number(mark.start) / (duration * fps)) * 100}%`, width: `${((Number(mark.end) - Number(mark.start)) / (duration * fps)) * 100}%` }} title={`${phase}: ${phaseBounds(phase)}`} />;
                    })}
                  </div>
                  <div className="control-row">
                    <div className="control-group">
                      <button className="control-icon" onClick={() => stepFrame(-1)} disabled={!videoSrc} data-testid="button-step-back" aria-label="Fotograma anterior"><SkipBack size={15} /></button>
                      <button className="control-icon" onClick={togglePlay} disabled={!videoSrc} data-testid="button-play-pause" aria-label={isPlaying ? 'Pausa' : 'Reproducció'}>{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
                      <button className="control-icon" onClick={() => stepFrame(1)} disabled={!videoSrc} data-testid="button-step-forward" aria-label="Fotograma següent"><SkipForward size={15} /></button>
                      <span className="time-readout" data-testid="text-timecode">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'hsl(215 14% 72%)', fontFamily: 'var(--app-font-mono)', fontSize: '.62rem' }}>
                       FPS
                      <select className="select-field" style={{ width: '4.6rem', padding: '.35rem', background: 'hsl(216 27% 20%)', color: 'hsl(36 33% 94%)', borderColor: 'hsl(36 33% 94% / .2)' }} value={fps} onChange={(event) => setFps(Number(event.target.value))} data-testid="select-fps">
                        <option value={24}>24</option><option value={30}>30</option><option value={60}>60</option>
                      </select>
                    </label>
                     <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'hsl(215 14% 72%)', fontFamily: 'var(--app-font-mono)', fontSize: '.62rem' }}>
                        VELOCITAT
                        <select className="select-field" style={{ width: '5.6rem', padding: '.35rem', background: 'hsl(216 27% 20%)', color: 'hsl(36 33% 94%)', borderColor: 'hsl(36 33% 94% / .2)' }} value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))} disabled={!videoSrc} data-testid="select-playback-speed" aria-label="Velocitat de reproducció">
                         {[.25, .5, .75, 1, 1.25, 1.5, 1.75, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
                       </select>
                     </label>
                  </div>
                  <div className="tool-strip">
                    <button className={`tool-toggle ${guides.horizontal ? 'active' : ''}`} onClick={() => setGuide('horizontal')} data-testid="button-guide-horizontal"><Minus size={13} /> Horitzontal</button>
                    <button className={`tool-toggle ${guides.vertical ? 'active' : ''}`} onClick={() => setGuide('vertical')} data-testid="button-guide-vertical"><Minus size={13} style={{ transform: 'rotate(90deg)' }} /> Vertical</button>
                    <button className={`tool-toggle ${guides.grid ? 'active' : ''}`} onClick={() => setGuide('grid')} data-testid="button-guide-grid"><Grid3X3 size={13} /> Quadrícula</button>
                    <button className={`tool-toggle ${manualPointMode ? 'active' : ''}`} onClick={() => { setAngleSelectionMode(false); setManualPointMode((value) => !value); }} data-testid="button-manual-point-mode"><Crosshair size={13} /> Corregir punts</button>
                    <select className="select-field" style={{ width: '8rem', padding: '.35rem', background: 'hsl(216 27% 20%)', color: 'hsl(36 33% 94%)', borderColor: 'hsl(36 33% 94% / .2)' }} value={selectedPoint} onChange={(event) => setSelectedPoint(event.target.value as PointKey)} disabled={!manualPointMode} data-testid="select-manual-point">
                      <option value="hip">Maluc</option><option value="knee">Genoll</option><option value="ankle">Turmell</option>
                    </select>
                     <button className="control-icon" onClick={() => setZoom((value) => Math.max(.7, value - .1))} disabled={!videoSrc} data-testid="button-zoom-out" aria-label="Allunyar"><ZoomOut size={14} /></button>
                     <button className="control-icon" onClick={() => setZoom((value) => Math.min(2.4, value + .1))} disabled={!videoSrc} data-testid="button-zoom-in" aria-label="Apropar"><ZoomIn size={14} /></button>
                     <button className="control-icon" onClick={resetView} data-testid="button-reset-view" aria-label="Restablir la vista"><RotateCcw size={14} /></button>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><Target size={17} /> Selecció dels salts</div>
                  <span className="status-badge pending" data-testid="status-frame-number">Fotograma {currentFrame}</span>
                </div>
                <div className="panel-body">
                  <div className="section-caption">
                    <div><h2>Marca els moments directament al vídeo</h2><div className="small-note">Reprodueix, pausa i prem el botó del moment corresponent. No cal escriure temps.</div></div>
                    <button className="button-primary" onClick={startAnalysis} disabled={!videoSrc} data-testid="button-start-analysis"><Activity size={14} /> Analitzar els tres salts</button>
                  </div>
                  <div className="phase-list">
                    {(['HOP', 'STEP', 'JUMP'] as PhaseKey[]).map((phase) => (
                      <div className={`phase-row ${activePhase === phase ? 'active' : ''}`} key={phase}>
                        <button className="phase-chip" onClick={() => setActivePhase(phase)} data-testid={`button-phase-${phase.toLowerCase()}`}>{phase}</button>
                        <div className="phase-time phase-time-readout" data-testid={`readout-${phase.toLowerCase()}-range`}>{phaseBounds(phase)}</div>
                        <button className="phase-action" onClick={() => markPhase(phase, phases[phase].start ? 'end' : 'start')} data-testid={`button-mark-${phase.toLowerCase()}`} disabled={!videoSrc}>
                          {phases[phase].start ? `Final ${phase}` : `Inici ${phase}`} <ChevronDown size={12} style={{ transform: 'rotate(-90deg)', verticalAlign: 'middle' }} />
                        </button>
                          {(phases[phase].start || phases[phase].end) && <button className="phase-action phase-clear" onClick={() => clearPhase(phase)} data-testid={`button-clear-${phase.toLowerCase()}`}>Esborrar {phase}</button>}
                      </div>
                    ))}
                  </div>
                    {analysisStarted && (
                      <div className="clip-workspace" data-testid="analysis-clips">
                        <div className="section-caption">
                          <div><h2>Unitats d’anàlisi</h2><div className="small-note">Cada salt és un clip independent. Els tres fotogrames només els selecciona manualment l’usuari.</div></div>
                          {!athleteLocked && <span className="status-badge pending">Revisar detecció</span>}
                        </div>
                        <div className="clip-tabs">
                          {(['HOP', 'STEP', 'JUMP'] as PhaseKey[]).map((phase) => <button key={phase} className={`phase-chip ${activeClipPhase === phase ? 'active' : ''}`} onClick={() => selectFrameSlot(phase, 0)}>{phase}</button>)}
                        </div>
                        <div className="frame-slots">
                          {frameSlots[activeClipPhase].map((slot, index) => (
                            <div key={`${activeClipPhase}-${index}`} className={`frame-slot ${activeFrameSlot === index ? 'active' : ''}`}>
                              <button className="frame-slot-select" onClick={() => selectFrameSlot(activeClipPhase, index)} data-testid={`button-${activeClipPhase.toLowerCase()}-frame-${index + 1}`}>
                                <strong>Fotograma {index + 1}</strong>
                                <span>{slot.frame === null ? 'Pendent de selecció' : `F ${slot.frame} · ${formatTime(slot.frame / fps)}`}</span>
                                <small>{slot.points.length}/3 punts</small>
                              </button>
                              {slot.frame !== null && <button className="frame-slot-clear" onClick={() => { selectFrameSlot(activeClipPhase, index); window.setTimeout(clearActiveFrameSlot, 0); }} data-testid={`button-clear-${activeClipPhase.toLowerCase()}-frame-${index + 1}`}>Esborrar</button>}
                            </div>
                          ))}
                        </div>
                        <div className="clip-picker">
                          <div>
                            <div className="eyebrow">Clip {activeClipPhase}</div>
                            <strong>{formatTime(activeClipStart)} — {formatTime(activeClipEnd)} · Fotograma actual: F {currentFrame}</strong>
                            <span>MediaPipe ha de detectar l’esquelet abans de permetre la selecció.</span>
                          </div>
                          <button className="button-primary" onClick={selectCurrentFrameForSlot} disabled={!landmarks || currentTime < activeClipStart || currentTime > activeClipEnd} data-testid="button-select-analysis-frame"><Check size={14} /> Seleccionar fotograma</button>
                        </div>
                        {allFramesSelected ? (
                          <div className="angle-editor">
                            <div>
                              <div className="eyebrow">Fotograma actiu</div>
                              <strong>{`F ${activeSlot.frame} · ${formatTime((activeSlot.frame ?? 0) / fps)}`}</strong>
                            </div>
                            <select className="select-field" value={activeSlot.angleMode} onChange={(event) => {
                              const angleMode = event.target.value as AngleMode;
                              updateActiveFrameSlot({ angleMode, points: [] });
                              setAngleSelectionMode(true);
                            }} data-testid="select-angle-mode">
                              <option value="vertex">3 punts · angle amb vèrtex</option>
                              <option value="segments">4 punts · entre dos segments</option>
                            </select>
                            <button className={`button-outline ${angleSelectionMode ? 'active-button' : ''}`} onClick={() => { setManualPointMode(false); setAngleSelectionMode((value) => !value); }} disabled={activeSlot.frame !== currentFrame || activeSlot.points.length >= requiredAnglePointCount} data-testid="button-select-angle">
                              <Crosshair size={14} /> {angleSelectionMode ? 'Cancel·lar selecció' : 'Seleccionar angle'}
                            </button>
                            <button className="button-outline" onClick={() => { updateActiveFrameSlot({ points: [] }); setAngleSelectionMode(true); }} disabled={!activeSlot.points.length} data-testid="button-reset-angle-points"><RotateCcw size={14} /> Repetir</button>
                            <input className="text-field" value={activeSlot.label} onChange={(event) => updateActiveFrameSlot({ label: event.target.value })} placeholder="Nom de l’angle (opcional)" data-testid="input-angle-label" />
                            <select className="select-field" value={activeSlot.referenceId} onChange={(event) => updateActiveFrameSlot({ referenceId: event.target.value as FrameSlot['referenceId'] })} data-testid="select-angle-reference">
                              <option value="">Sense referència assignada</option>
                              <option value="lead">Referència 1: {REFERENCE_ROWS.find((row) => row.phase === activeClipPhase)!.lead}</option>
                              <option value="trail">Referència 2: {REFERENCE_ROWS.find((row) => row.phase === activeClipPhase)!.trail}</option>
                              <option value="internal">Referència 3: {REFERENCE_ROWS.find((row) => row.phase === activeClipPhase)!.internal}</option>
                              <option value="trajectory">Referència 4: {REFERENCE_ROWS.find((row) => row.phase === activeClipPhase)!.trajectory}</option>
                            </select>
                            <div className="angle-result">
                              <span>Angle calculat</span>
                              <strong data-testid="text-active-angle">{activeComputedAngle === null ? '—' : `${activeComputedAngle.toFixed(1)}°`}</strong>
                              <small>{activeSlot.points.length === requiredAnglePointCount
                                ? 'Calculat matemàticament amb les coordenades seleccionades.'
                                : activeSlot.angleMode === 'segments'
                                  ? 'Clica A i B per al primer segment; C i D per a la línia o el segon segment.'
                                  : 'Clica el punt 1, el vèrtex (punt 2) i el punt 3. Pots clicar qualsevol punt del fotograma.'}</small>
                            </div>
                            <div className="angle-point-list" aria-label="Punts seleccionats per a l’angle">
                              {activeSlot.points.map((point, index) => (
                                <div className="angle-point-row" key={point.id}>
                                  <span className={`angle-point-kind ${point.source}`}>{point.source === 'landmark' ? 'MediaPipe' : 'Manual'}</span>
                                  <span>Punt {index + 1}{point.source === 'landmark' ? ` · ${LANDMARK_NAMES[point.landmarkIndex ?? -1] ?? 'Landmark'}` : ` · X ${point.x.toFixed(3)}, Y ${point.y.toFixed(3)}`}</span>
                                  <button onClick={() => updateActiveFrameSlot({ points: activeSlot.points.filter((currentPoint) => currentPoint.id !== point.id) })} aria-label={`Eliminar punt ${index + 1}`} data-testid={`button-remove-angle-point-${index + 1}`}>Eliminar</button>
                                </div>
                              ))}
                            </div>
                            <button className="button-primary" onClick={() => showToast('Angle confirmat. El resultat s’ha actualitzat a la taula comparativa.')} disabled={activeComputedAngle === null} data-testid="button-confirm-angle"><Check size={14} /> Confirmar angle</button>
                          </div>
                        ) : <div className="empty-inline" data-testid="analysis-waiting-frames">Selecciona manualment els 3 fotogrames de HOP, STEP i JUMP abans de començar l’anàlisi d’angles.</div>}
                      </div>
                    )}
                </div>
              </div>
            </div>

            <div className="stack">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><UserRound size={17} /> Atleta analitzat</div>
                  <span className="eyebrow">Selecció manual</span>
                </div>
                <div className="panel-body athlete-card">
                  <div className="athlete-ident">
                    <div className="athlete-avatar" data-testid="text-athlete-initials">{initials(athlete)}</div>
                    <div><div className="athlete-name" data-testid="text-athlete-name">{athlete}</div><div className="athlete-meta">TRIPLE SALT / BATUDA DRETA</div></div>
                  </div>
                   <div className="small-note">La selecció té prioritat sobre el tracking automàtic. Només els seus landmarks s’utilitzen per calcular els angles.</div>
                   <div className="athlete-lock-row">
                     <span className={`status-badge ${athleteLocked ? '' : 'pending'}`}>{athleteLocked ? 'ATLETA BLOQUEJAT' : 'CAL SELECCIONAR'}</span>
                     <button className="button-outline" style={{ minHeight: '1.9rem', padding: '.35rem .55rem' }} onClick={changeAthlete} disabled={!videoSrc} data-testid="button-change-athlete">{athleteLocked ? 'Canviar atleta' : 'Seleccionar atleta'}</button>
                   </div>
                   {trackingWarning && <div className="tracking-warning" role="alert" data-testid="status-tracking-warning">{trackingWarning}</div>}
                   {poseCandidates.length > 1 && !athleteSelectionMode && <div className="small-note" style={{ marginTop: '.65rem' }}>{poseCandidates.length} persones visibles. Només l’atleta bloquejat alimenta els càlculs biomecànics.</div>}
                   {athleteSelectionMode && <div className="selection-callout">Fes clic sobre la persona que vols analitzar. Les figures no seleccionades quedaran diferenciades.</div>}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><Sparkles size={17} /> Fotogrames importants</div>
                  <button className="button-outline" style={{ minHeight: '1.9rem', padding: '.35rem .55rem' }} onClick={proposeCurrentFrame} data-testid="button-propose-frame" disabled={!videoSrc}><Sparkles size={13} /> Proposar l’actual</button>
                </div>
                <div className="panel-body">
                  <div className="small-note" style={{ marginBottom: '.7rem' }}>Les propostes provenen d’un fotograma analitzat real i es poden revisar.</div>
                  {proposals.length ? (
                    <div className="proposal-list">
                      {proposals.map((proposal) => (
                        <div className="proposal-row" key={proposal.frame}>
                        <div className="proposal-frame">F {proposal.frame}</div>
                        <div><div className="proposal-reason">Visibilitat de pose: {proposal.score}%</div><div className="athlete-meta">{formatTime(proposal.time)}</div></div>
                          <span className="status-badge"><Check size={11} /> {proposal.score}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-inline" data-testid="empty-proposals">Encara no hi ha propostes. Analitza un fotograma i afegeix-lo a la revisió.</div>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><ScanLine size={17} /> Revisió de confiança</div>
                  <span className={`status-badge ${confidence === null ? 'pending' : ''}`} data-testid="status-confidence">{confidence === null ? 'Esperant fotograma' : confidence >= .7 ? 'Alta confiança' : 'Revisar'}</span>
                </div>
                <div className="panel-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="small-note">Confiança dels landmarks visibles</span>
                    <strong className="confidence-value" data-testid="text-confidence-value">{confidence === null ? '—' : `${Math.round(confidence * 100)}%`}</strong>
                  </div>
                  <div className="confidence-line"><div className="confidence-meter"><span style={{ width: `${confidence === null ? 0 : Math.min(100, confidence * 100)}%` }} /></div></div>
                  <div className="small-note" style={{ marginTop: '.7rem' }}>{poseStatus === 'error' ? 'MediaPipe no s’ha pogut carregar. Comprova la connexió i torna a carregar la pàgina.' : 'La visibilitat baixa demana correcció manual; mai se substitueix per dades inventades.'}</div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><Settings2 size={17} /> Referència biomecànica</div>
                  <span className="eyebrow">Jonathan Edwards</span>
                </div>
                <div className="panel-body">
                  <img src={referenceImage} alt="Imatge de referència biomecànica de Jonathan Edwards" className="reference-image" />
                  <div className="small-note" style={{ marginBottom: '.8rem' }}>La metodologia interna és configurable i no s’assumeixen nous criteris fins que es defineixin.</div>
                  <div className="reference-strip" aria-label="Jonathan Edwards reference values">
                    {REFERENCE_ROWS.map((row) => <div className="reference-cell" key={row.phase}><strong>{row.phase}</strong><span>{row.lead} · {row.trail}</span><span>{row.internal} · {row.trajectory}</span></div>)}
                  </div>
                  <div className="small-note" style={{ marginTop: '.8rem' }}>Angle calculat del fotograma actual: <strong data-testid="text-live-angle">{liveAngle === null ? '—' : `${liveAngle.toFixed(1)}°`}</strong> <span style={{ color: 'hsl(216 13% 43%)' }}>({angleDefinition === 'internal' ? 'angle intern' : angleDefinition === 'segment-horizontal' ? 'segment respecte a l’horitzontal' : 'trajectòria respecte a l’horitzontal'})</span></div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel report-section" id="report">
            <div className="panel-header">
                  <div className="panel-title"><Layers3 size={17} /> Resultats i comparació</div>
              <div className="eyebrow">Valors editables</div>
            </div>
            <div className="panel-body">
              <div className="section-caption">
                <div><h2>Comparació per fotograma</h2><div className="small-note">Els resultats provenen dels tres landmarks seleccionats. La referència només s’aplica quan tu l’assignes a l’angle.</div></div>
                <button className="button-quiet" onClick={() => setFrameSlots(createEmptyFrameSlots())} data-testid="button-clear-measurements"><X size={14} /> Restablir anàlisi</button>
              </div>
              <div className="comparison-strip">
                <figure>
                  <img src={referenceImage} alt="Referència de Jonathan Edwards" />
                  <figcaption>REFERÈNCIA · JONATHAN EDWARDS</figcaption>
                </figure>
                <div className="comparison-athlete">
                  <span className="eyebrow">ATLETA · {activeClipPhase} · FOTOGRAMA {activeFrameSlot + 1}</span>
                  <strong>{activeSlot.label || 'Angle sense nom'}</strong>
                  <span>{activeComputedAngle === null ? 'Selecciona tres punts per veure el valor.' : `${activeComputedAngle.toFixed(1)}° · ${referenceTextForSlot(activeClipPhase, activeSlot)}`}</span>
                  <small>{activeSlot.points.length === requiredAnglePointCount ? activeSlot.points.map((point) => point.source === 'landmark' ? LANDMARK_NAMES[point.landmarkIndex ?? -1] ?? 'Landmark' : 'Punt manual').join(' · ') : 'Els punts i les línies es mostren sobre el vídeo de l’atleta.'}</small>
                </div>
              </div>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead><tr><th>Salt</th><th>Fotograma</th><th>Angle</th><th>Jonathan Edwards</th><th>Atleta</th><th>Diferència</th><th>Estat</th></tr></thead>
                  <tbody>
                    {resultRows.map((row) => {
                      const referenceText = referenceTextForSlot(row.phase, row.slot);
                      const referenceRange = row.slot.referenceId ? parseReferenceRange(referenceText) : null;
                      const difference = row.value !== null && referenceRange ? row.value - referenceRange.target : null;
                      const status = difference === null || !referenceRange
                        ? 'Pendent de configuració'
                        : Math.abs(difference) <= referenceRange.tolerance
                          ? 'DINS DEL RANG'
                          : Math.abs(difference) <= referenceRange.tolerance + 2
                            ? 'REVISAR'
                            : 'FORA DEL RANG';
                      return (
                        <tr key={`${row.phase}-${row.index}`}>
                          <td>{row.phase}</td>
                          <td>{row.slot.frame === null ? '—' : `F ${row.slot.frame}`}</td>
                          <td>{row.slot.label || 'Angle sense nom'}</td>
                          <td>{referenceText}</td>
                          <td>{row.value === null ? '—' : `${row.value.toFixed(1)}°`}</td>
                          <td>{difference === null ? '—' : `${difference >= 0 ? '+' : ''}${difference.toFixed(1)}°`}</td>
                          <td><span className={`status-badge ${status === 'DINS DEL RANG' ? '' : 'pending'}`}>{status === 'DINS DEL RANG' && <Check size={11} />}{status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="disclosure"><Info size={15} /><span>Eina d’anàlisi esportiva, no de precisió mèdica. La confiança dels landmarks, l’angle de càmera, la velocitat de fotogrames i les correccions manuals afecten la interpretació.</span></div>
            </div>
          </section>
        </div>
      </main>

      {createAthleteOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCreateAthleteOpen(false); }}>
          <form className="modal" onSubmit={addAthlete}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div><h2>Crear atleta</h2><p>Mantén la sessió traçable sense enviar dades de l’atleta.</p></div>
              <button type="button" className="button-quiet" style={{ minHeight: '2rem', padding: '.35rem' }} onClick={() => setCreateAthleteOpen(false)} data-testid="button-close-athlete-modal" aria-label="Close"><X size={15} /></button>
            </div>
            <div className="modal-form">
              <label className="field-label" htmlFor="new-athlete-name">Nom de l’atleta</label>
              <input id="new-athlete-name" className="text-field" autoFocus value={newAthlete} onChange={(event) => setNewAthlete(event.target.value)} placeholder="e.g. Jordan Lee" data-testid="input-new-athlete" />
              <div className="modal-actions"><button type="button" className="button-outline" onClick={() => setCreateAthleteOpen(false)} data-testid="button-cancel-athlete">Cancel·lar</button><button type="submit" className="button-primary" data-testid="button-save-athlete"><Check size={14} /> Afegir atleta</button></div>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}
    </div>
  );
}

export default App;