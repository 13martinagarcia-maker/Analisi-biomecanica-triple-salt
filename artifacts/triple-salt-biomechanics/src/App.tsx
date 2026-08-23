import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
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

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type PoseResult = {
  poseLandmarks?: Landmark[];
};

type PoseInstance = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: PoseResult) => void) => void;
  send: (payload: { image: HTMLVideoElement }) => Promise<void>;
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

const initials = (name: string) =>
  name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<PoseInstance | null>(null);
  const poseLoadingRef = useRef(false);
  const poseBusyRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);
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
  const [angleDefinition, setAngleDefinition] = useState<'internal' | 'segment-horizontal' | 'trajectory-horizontal'>('internal');
  const [measurements, setMeasurements] = useState<Record<PhaseKey, Measurement>>(INITIAL_MEASUREMENTS);

  const currentFrame = frameForTime(currentTime, fps);
  const activeReference = REFERENCE_ROWS.find((row) => row.phase === activePhase)!;
  const activeMeasurement = measurements[activePhase];

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  const drawOverlay = useCallback((poseLandmarks: Landmark[] | null) => {
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

    if (poseLandmarks && poseLandmarks.length > 32) {
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

      context.strokeStyle = 'rgba(255, 211, 101, .76)';
      context.lineWidth = 2;
      CONNECTIONS.forEach(([start, end]) => {
        const first = poseLandmarks[start];
        const last = poseLandmarks[end];
        if (!first || !last) return;
        const firstPoint = point(first);
        const lastPoint = point(last);
        context.beginPath();
        context.moveTo(firstPoint.x, firstPoint.y);
        context.lineTo(lastPoint.x, lastPoint.y);
        context.stroke();
      });
      poseLandmarks.forEach((landmark, index) => {
        if ((landmark.visibility ?? 1) < .35) return;
        const position = point(landmark);
        context.fillStyle = index === 25 || index === 26 ? '#df5b31' : '#ffd365';
        context.beginPath();
        context.arc(position.x, position.y, index === 25 || index === 26 ? 4.4 : 2.6, 0, Math.PI * 2);
        context.fill();
      });
    }

    Object.entries(manualPoints).forEach(([key, position]) => {
      if (!position) return;
      context.fillStyle = '#df5b31';
      context.strokeStyle = '#f9f0dd';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(position.x * width, position.y * height, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#f9f0dd';
      context.font = '600 10px "DM Mono", monospace';
      context.fillText(key.toUpperCase(), position.x * width + 9, position.y * height + 3);
    });
  }, [guides, manualPoints]);

  useEffect(() => {
    drawOverlay(landmarks);
    const onResize = () => drawOverlay(landmarks);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawOverlay, landmarks]);

  const handlePoseResults = useCallback((results: PoseResult) => {
    const nextLandmarks = results.poseLandmarks ?? null;
    setLandmarks(nextLandmarks);
    if (nextLandmarks?.length) {
      const visible = nextLandmarks
        .map((landmark) => landmark.visibility ?? 0)
        .filter((value) => value > 0);
      setConfidence(visible.length ? visible.reduce((sum, value) => sum + value, 0) / visible.length : null);
    } else {
      setConfidence(null);
    }
  }, []);

  const sendFrameToPose = useCallback(() => {
    const video = videoRef.current;
    if (!poseRef.current || !video || video.readyState < 2 || poseBusyRef.current) return;
    poseBusyRef.current = true;
    poseRef.current.send({ image: video }).catch(() => {
      setPoseStatus('error');
    }).finally(() => {
      poseBusyRef.current = false;
    });
  }, []);

  const initializePose = useCallback(() => {
    if (poseRef.current || poseLoadingRef.current) return;
    poseLoadingRef.current = true;
    setPoseStatus('loading');
    const setup = () => {
      if (!window.Pose) {
        poseLoadingRef.current = false;
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
        setPoseStatus('ready');
        window.setTimeout(sendFrameToPose, 120);
      } catch {
        poseLoadingRef.current = false;
        setPoseStatus('error');
      }
    };
    if (window.Pose) {
      setup();
      return;
    }
    const existingScript = document.querySelector('script[data-mediapipe-pose]');
    if (existingScript) {
      existingScript.addEventListener('load', setup, { once: true });
      existingScript.addEventListener('error', () => {
        poseLoadingRef.current = false;
        setPoseStatus('error');
      }, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
    script.async = true;
    script.dataset.mediapipePose = 'true';
    script.addEventListener('load', setup, { once: true });
    script.addEventListener('error', () => {
      poseLoadingRef.current = false;
      setPoseStatus('error');
    }, { once: true });
    document.head.appendChild(script);
  }, [handlePoseResults, sendFrameToPose]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    poseRef.current?.close?.();
  }, []);

  const onVideoLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setCurrentTime(0);
    initializePose();
    window.setTimeout(sendFrameToPose, 350);
  };

  const onVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
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
    setConfidence(null);
    setPoseStatus('idle');
    setProposals([]);
    showToast('Video loaded locally. Pose will run in your browser.');
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const nextTime = Math.min(duration, Math.max(0, time));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    window.setTimeout(sendFrameToPose, 60);
  };

  const stepFrame = (direction: number) => {
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
    if (!manualPointMode) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setManualPoints((previous) => ({
      ...previous,
      [selectedPoint]: {
        x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
        y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
      },
    }));
    showToast(`${selectedPoint} point corrected on the current frame.`);
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
    ? 'POSE READY'
    : poseStatus === 'loading'
      ? 'LOADING POSE'
      : poseStatus === 'error'
        ? 'POSE UNAVAILABLE'
        : 'POSE STANDBY';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">TS<br />01</div>
          <div>
            <div className="font-display" style={{ fontSize: '1.1rem', lineHeight: 1 }}>Triple Salt</div>
            <div className="sidebar-label" style={{ padding: '.35rem 0 0', color: 'hsl(215 14% 67%)' }}>Biomechanics bench</div>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Analysis sections">
          <div className="sidebar-label">Session</div>
          <button className="nav-item active" data-testid="button-nav-analysis" onClick={() => document.getElementById('analysis')?.scrollIntoView({ behavior: 'smooth' })}>
            <Activity size={16} /><span>Analysis bench</span>
          </button>
          <button className="nav-item" data-testid="button-nav-report" onClick={() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' })}>
            <Layers3 size={16} /><span>Comparison report</span>
          </button>
          <button className="nav-item" data-testid="button-nav-settings" onClick={() => showToast('Angle definitions are configured in the review panel.')}>
            <Settings2 size={16} /><span>Definitions</span>
          </button>
        </nav>
        <div className="sidebar-meta">
          <div className="eyebrow" style={{ color: 'hsl(38 89% 61%)' }}>Local-first session</div>
          <div style={{ marginTop: '.45rem', fontSize: '.7rem', lineHeight: 1.5 }}>Video stays in this browser. Nothing is uploaded.</div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <span className="live-dot" />
            <span className="eyebrow" style={{ color: 'hsl(216 13% 43%)' }}>Session 07 / triple jump</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span className="status-badge pending" data-testid="status-analysis-mode"><Gauge size={12} /> {videoSrc ? 'Local video loaded' : 'No source loaded'}</span>
            <button className="button-outline" data-testid="button-export-report" onClick={downloadReport}><ArrowDownToLine size={14} /><span>Export report</span></button>
          </div>
        </header>

        <div className="content">
          <section className="page-heading" id="analysis">
            <div>
              <div className="eyebrow" style={{ color: 'hsl(24 76% 48%)' }}>Reviewable by design</div>
              <h1>From runway to<br /><span style={{ color: 'hsl(24 76% 48%)' }}>traceable evidence.</span></h1>
              <p>A focused analysis bench for coaches and sports-science students. Mark the three phases, inspect meaningful frames, then correct the model where your eye has more context.</p>
            </div>
            <div style={{ display: 'grid', gap: '.5rem', minWidth: '13rem' }}>
              <label className="field-label" htmlFor="athlete-select">Athlete</label>
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
                  <div className="panel-title"><Video size={17} /> Frame review</div>
                  <div className="eyebrow" style={{ color: 'hsl(216 13% 43%)' }}>{fileName || 'No video source'}</div>
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
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        playsInline
                        muted
                        data-testid="video-source"
                      />
                      <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        style={{
                          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                          pointerEvents: manualPointMode ? 'auto' : 'none',
                          cursor: manualPointMode ? 'crosshair' : 'default',
                        }}
                        data-testid="canvas-pose-overlay"
                      />
                      <div className="video-overlay-chip"><span className="status-dot live-dot" />{poseLabel}</div>
                    </>
                  ) : (
                    <div className="video-empty">
                      <FileVideo size={34} />
                      <h2>Load a jump video to start the trace</h2>
                      <p>MP4, WebM, or a browser-readable recording. Playback, frame stepping, and pose inference stay local to this device.</p>
                      <label className="button-primary" htmlFor="video-upload" data-testid="label-upload-video"><ArrowDownToLine size={15} /> Choose video</label>
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
                      aria-label="Video timeline"
                      data-testid="input-video-timeline"
                    />
                    {Object.values(phases).flatMap((mark) => mark.start ? [mark.start] : []).map((frame) => (
                      <span key={frame} className="timeline-marker" style={{ left: `${duration ? (Number(frame) / (duration * fps)) * 100 : 0}%` }} />
                    ))}
                  </div>
                  <div className="control-row">
                    <div className="control-group">
                      <button className="control-icon" onClick={() => stepFrame(-1)} disabled={!videoSrc} data-testid="button-step-back" aria-label="Previous frame"><SkipBack size={15} /></button>
                      <button className="control-icon" onClick={togglePlay} disabled={!videoSrc} data-testid="button-play-pause" aria-label="Play or pause">{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
                      <button className="control-icon" onClick={() => stepFrame(1)} disabled={!videoSrc} data-testid="button-step-forward" aria-label="Next frame"><SkipForward size={15} /></button>
                      <span className="time-readout" data-testid="text-timecode">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'hsl(215 14% 72%)', fontFamily: 'var(--app-font-mono)', fontSize: '.62rem' }}>
                      FPS
                      <select className="select-field" style={{ width: '4.6rem', padding: '.35rem', background: 'hsl(216 27% 20%)', color: 'hsl(36 33% 94%)', borderColor: 'hsl(36 33% 94% / .2)' }} value={fps} onChange={(event) => setFps(Number(event.target.value))} data-testid="select-fps">
                        <option value={24}>24</option><option value={30}>30</option><option value={60}>60</option>
                      </select>
                    </label>
                  </div>
                  <div className="tool-strip">
                    <button className={`tool-toggle ${guides.horizontal ? 'active' : ''}`} onClick={() => setGuide('horizontal')} data-testid="button-guide-horizontal"><Minus size={13} /> Horizontal</button>
                    <button className={`tool-toggle ${guides.vertical ? 'active' : ''}`} onClick={() => setGuide('vertical')} data-testid="button-guide-vertical"><Minus size={13} style={{ transform: 'rotate(90deg)' }} /> Vertical</button>
                    <button className={`tool-toggle ${guides.grid ? 'active' : ''}`} onClick={() => setGuide('grid')} data-testid="button-guide-grid"><Grid3X3 size={13} /> Grid</button>
                    <button className={`tool-toggle ${manualPointMode ? 'active' : ''}`} onClick={() => setManualPointMode((value) => !value)} data-testid="button-manual-point-mode"><Crosshair size={13} /> Correct points</button>
                    <select className="select-field" style={{ width: '8rem', padding: '.35rem', background: 'hsl(216 27% 20%)', color: 'hsl(36 33% 94%)', borderColor: 'hsl(36 33% 94% / .2)' }} value={selectedPoint} onChange={(event) => setSelectedPoint(event.target.value as PointKey)} disabled={!manualPointMode} data-testid="select-manual-point">
                      <option value="hip">Hip point</option><option value="knee">Knee point</option><option value="ankle">Ankle point</option>
                    </select>
                    <button className="control-icon" onClick={() => setZoom((value) => Math.max(.7, value - .1))} disabled={!videoSrc} data-testid="button-zoom-out" aria-label="Zoom out"><ZoomOut size={14} /></button>
                    <button className="control-icon" onClick={() => setZoom((value) => Math.min(2.4, value + .1))} disabled={!videoSrc} data-testid="button-zoom-in" aria-label="Zoom in"><ZoomIn size={14} /></button>
                    <button className="control-icon" onClick={resetView} data-testid="button-reset-view" aria-label="Reset view"><RotateCcw size={14} /></button>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><Target size={17} /> Phase landmarks</div>
                  <span className="status-badge pending" data-testid="status-frame-number">Frame {currentFrame}</span>
                </div>
                <div className="panel-body">
                  <div className="section-caption">
                    <div><h2>Mark the rhythm before measuring</h2><div className="small-note">Use the current frame as a traceable start or end. Empty is honest.</div></div>
                    <span className="eyebrow">3 phases</span>
                  </div>
                  <div className="phase-list">
                    {(['HOP', 'STEP', 'JUMP'] as PhaseKey[]).map((phase) => (
                      <div className={`phase-row ${activePhase === phase ? 'active' : ''}`} key={phase}>
                        <button className="phase-chip" onClick={() => setActivePhase(phase)} data-testid={`button-phase-${phase.toLowerCase()}`}>{phase}</button>
                        <div className="phase-time">
                          <input className="number-field" inputMode="numeric" value={phases[phase].start} placeholder="start" onChange={(event) => setPhases((previous) => ({ ...previous, [phase]: { ...previous[phase], start: event.target.value.replace(/\D/g, '') } }))} data-testid={`input-${phase.toLowerCase()}-start`} />
                          <input className="number-field" inputMode="numeric" value={phases[phase].end} placeholder="end" onChange={(event) => setPhases((previous) => ({ ...previous, [phase]: { ...previous[phase], end: event.target.value.replace(/\D/g, '') } }))} data-testid={`input-${phase.toLowerCase()}-end`} />
                        </div>
                        <button className="phase-action" onClick={() => markPhase(phase, phases[phase].start ? 'end' : 'start')} data-testid={`button-mark-${phase.toLowerCase()}`} disabled={!videoSrc}>
                          {phases[phase].start ? 'Mark end' : 'Mark start'} <ChevronDown size={12} style={{ transform: 'rotate(-90deg)', verticalAlign: 'middle' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="stack">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><UserRound size={17} /> Athlete context</div>
                  <span className="eyebrow">Local record</span>
                </div>
                <div className="panel-body athlete-card">
                  <div className="athlete-ident">
                    <div className="athlete-avatar" data-testid="text-athlete-initials">{initials(athlete)}</div>
                    <div><div className="athlete-name" data-testid="text-athlete-name">{athlete}</div><div className="athlete-meta">TRIPLE JUMP / RIGHT TAKE-OFF</div></div>
                  </div>
                  <div className="small-note">A session is saved in the current browser only. Athlete names are labels for the report, not an identity service.</div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><Sparkles size={17} /> Important frames</div>
                  <button className="button-outline" style={{ minHeight: '1.9rem', padding: '.35rem .55rem' }} onClick={proposeCurrentFrame} data-testid="button-propose-frame" disabled={!videoSrc}><Sparkles size={13} /> Propose current</button>
                </div>
                <div className="panel-body">
                  <div className="small-note" style={{ marginBottom: '.7rem' }}>Proposals are created from an actual analyzed frame and remain coach-reviewable.</div>
                  {proposals.length ? (
                    <div className="proposal-list">
                      {proposals.map((proposal) => (
                        <div className="proposal-row" key={proposal.frame}>
                          <div className="proposal-frame">F {proposal.frame}</div>
                          <div><div className="proposal-reason">{proposal.reason}</div><div className="athlete-meta">{formatTime(proposal.time)}</div></div>
                          <span className="status-badge"><Check size={11} /> {proposal.score}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-inline" data-testid="empty-proposals">No proposals yet. Analyze a frame, then add it for review.</div>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><ScanLine size={17} /> Confidence review</div>
                  <span className={`status-badge ${confidence === null ? 'pending' : ''}`} data-testid="status-confidence">{confidence === null ? 'Awaiting frame' : confidence >= .7 ? 'Good visibility' : 'Review needed'}</span>
                </div>
                <div className="panel-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="small-note">Visible landmark confidence, current frame</span>
                    <strong className="confidence-value" data-testid="text-confidence-value">{confidence === null ? '—' : `${Math.round(confidence * 100)}%`}</strong>
                  </div>
                  <div className="confidence-line"><div className="confidence-meter"><span style={{ width: `${confidence === null ? 0 : Math.min(100, confidence * 100)}%` }} /></div></div>
                  <div className="small-note" style={{ marginTop: '.7rem' }}>{poseStatus === 'error' ? 'MediaPipe could not load. Check the browser connection, then reload to retry.' : 'Low visibility is a prompt for manual correction, not a hidden substitution.'}</div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><Settings2 size={17} /> Angle definitions</div>
                  <span className="eyebrow">Configurable</span>
                </div>
                <div className="panel-body">
                  <div className="definition-grid">
                    <div className="definition-row">
                      <div className="definition-label">Three-point internal<span>vertex at knee · hip / knee / ankle</span></div>
                      <select className="select-field" style={{ width: '8.5rem' }} value={angleDefinition === 'internal' ? 'active' : 'inactive'} onChange={() => setAngleDefinition('internal')} data-testid="select-internal-definition"><option value="active">Active</option><option value="inactive">Inactive</option></select>
                    </div>
                    <div className="definition-row">
                      <div className="definition-label">Segment to horizontal<span>limb segment, not an internal angle</span></div>
                      <select className="select-field" style={{ width: '8.5rem' }} value={angleDefinition === 'segment-horizontal' ? 'active' : 'inactive'} onChange={() => setAngleDefinition('segment-horizontal')} data-testid="select-segment-definition"><option value="active">Active</option><option value="inactive">Inactive</option></select>
                    </div>
                    <div className="definition-row">
                      <div className="definition-label">Trajectory to horizontal<span>flight path direction from two points</span></div>
                      <select className="select-field" style={{ width: '8.5rem' }} value={angleDefinition === 'trajectory-horizontal' ? 'active' : 'inactive'} onChange={() => setAngleDefinition('trajectory-horizontal')} data-testid="select-trajectory-definition"><option value="active">Active</option><option value="inactive">Inactive</option></select>
                    </div>
                  </div>
                  <div className="reference-strip" aria-label="Jonathan Edwards reference values">
                    {REFERENCE_ROWS.map((row) => <div className="reference-cell" key={row.phase}><strong>{row.phase}</strong><span>{row.lead} · {row.trail}</span><span>{row.internal} · {row.trajectory}</span></div>)}
                  </div>
                  <div className="small-note" style={{ marginTop: '.8rem' }}>Current-frame calculated value: <strong data-testid="text-live-angle">{liveAngle === null ? '—' : `${liveAngle.toFixed(1)}°`}</strong> <span style={{ color: 'hsl(216 13% 43%)' }}>({angleDefinition})</span></div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel report-section" id="report">
            <div className="panel-header">
              <div className="panel-title"><Layers3 size={17} /> Comparison report</div>
              <div className="eyebrow">Measured fields are editable</div>
            </div>
            <div className="panel-body">
              <div className="section-caption">
                <div><h2>Three phases, one accountable read</h2><div className="small-note">Enter or correct values only after reviewing the marked frame. The reference column preserves the Jonathan Edwards moments.</div></div>
                <button className="button-quiet" onClick={() => setMeasurements(INITIAL_MEASUREMENTS)} data-testid="button-clear-measurements"><X size={14} /> Clear measured values</button>
              </div>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead><tr><th>Phase</th><th>Lead / horizontal</th><th>Trail / horizontal</th><th>Internal angle</th><th>Trajectory / horizontal</th><th>Reference frame</th><th>State</th></tr></thead>
                  <tbody>
                    {REFERENCE_ROWS.map((row) => {
                      const measured = measurements[row.phase];
                      const complete = Object.values(measured).every(Boolean);
                      return (
                        <tr key={row.phase}>
                          <td>{row.phase}</td>
                          <td><input className="table-input" placeholder="—" value={measured.primary} onChange={(event) => updateMeasurement(row.phase, 'primary', event.target.value)} data-testid={`input-${row.phase.toLowerCase()}-primary-angle`} /></td>
                          <td><input className="table-input" placeholder="—" value={measured.secondary} onChange={(event) => updateMeasurement(row.phase, 'secondary', event.target.value)} data-testid={`input-${row.phase.toLowerCase()}-secondary-angle`} /></td>
                          <td><input className="table-input" placeholder="—" value={measured.internal} onChange={(event) => updateMeasurement(row.phase, 'internal', event.target.value)} data-testid={`input-${row.phase.toLowerCase()}-internal-angle`} /></td>
                          <td><input className="table-input" placeholder="—" value={measured.trajectory} onChange={(event) => updateMeasurement(row.phase, 'trajectory', event.target.value)} data-testid={`input-${row.phase.toLowerCase()}-trajectory-angle`} /></td>
                          <td>{row.lead} · {row.trail} · {row.internal} · {row.trajectory}</td>
                          <td><span className={`status-badge ${complete ? '' : 'pending'}`}>{complete ? <><Check size={11} /> reviewed</> : 'awaiting input'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="disclosure"><Info size={15} /><span>Analytical coaching aid, not medical precision. MediaPipe landmark confidence, camera angle, frame rate, and manual corrections all affect interpretation. Keep the source video beside this report.</span></div>
            </div>
          </section>
        </div>
      </main>

      {createAthleteOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCreateAthleteOpen(false); }}>
          <form className="modal" onSubmit={addAthlete}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div><h2>Create athlete label</h2><p>Keep the session traceable without sending athlete data anywhere.</p></div>
              <button type="button" className="button-quiet" style={{ minHeight: '2rem', padding: '.35rem' }} onClick={() => setCreateAthleteOpen(false)} data-testid="button-close-athlete-modal" aria-label="Close"><X size={15} /></button>
            </div>
            <div className="modal-form">
              <label className="field-label" htmlFor="new-athlete-name">Athlete name</label>
              <input id="new-athlete-name" className="text-field" autoFocus value={newAthlete} onChange={(event) => setNewAthlete(event.target.value)} placeholder="e.g. Jordan Lee" data-testid="input-new-athlete" />
              <div className="modal-actions"><button type="button" className="button-outline" onClick={() => setCreateAthleteOpen(false)} data-testid="button-cancel-athlete">Cancel</button><button type="submit" className="button-primary" data-testid="button-save-athlete"><Check size={14} /> Add athlete</button></div>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}
    </div>
  );
}

export default App;