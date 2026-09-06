import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarPlus,
  Check,
  ChevronRight,
  CircleGauge,
  ClipboardList,
  Dumbbell,
  Flag,
  Home,
  LogOut,
  MapPin,
  Plus,
  Pencil,
  Save,
  Target,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type Page = "inici" | "historial" | "competició" | "detall-competició" | "pista" | "casa" | "tècnica" | "escalfament";
type User = { id: string; firstName: string; lastName: string; email: string };
type Athlete = { id: string; firstName: string; lastName: string; goals: string | null; technicalNotes: string | null };
type Competition = {
  id: string;
  athleteId: string | null;
  location: string;
  eventDate: string;
  objective: string;
  personalBest: string | null;
  seasonGoal: string | null;
  achieved: boolean | null;
  resultNote: string | null;
  jumps: Array<{ id?: string; jumpNumber: number; mark: string | null; isFoul: boolean }>;
};
type TrackEvaluation = {
  id: string;
  athleteId: string | null;
  competitionId: string | null;
  approachScore: string;
  rhythmScore: string;
  landingScore: string;
  createdAt: string;
};
type AssessmentOption = { label: string; band: string; value: number; tone: "high" | "mid" | "low" };
type AssessmentGroup = { key: string; title: string; subtitle: string; question: string; hint?: string; options: AssessmentOption[] };

type Props = { analysisWorkspace: ReactNode };

const navItems: Array<{ id: Page; label: string; icon: typeof Home }> = [
  { id: "inici", label: "Inici", icon: Home },
  { id: "historial", label: "Historial", icon: BarChart3 },
  { id: "competició", label: "Nova competició", icon: CalendarPlus },
  { id: "pista", label: "Estic a pista", icon: Activity },
  { id: "casa", label: "Estic a casa", icon: CircleGauge },
  { id: "tècnica", label: "Tècnica", icon: BookOpen },
  { id: "escalfament", label: "Escalfament", icon: Dumbbell },
];

const assessmentGroups: AssessmentGroup[] = [
  {
    key: "approach",
    title: "La Cursa i l’Entrada",
    subtitle: "Velocitat",
    question: "Com has entrat a la taula?",
    options: [
      { label: "Amb molta velocitat, controlat i clavant la taula.", band: "8,5–10", value: 9.25, tone: "high" },
      { label: "He hagut de frenar els últims passos per no fer nul (he entrat «clavat»).", band: "6–8,5", value: 7.25, tone: "mid" },
      { label: "He arribat cansat/sense forces al final de la cursa.", band: "0–6", value: 3, tone: "low" },
    ],
  },
  {
    key: "rhythm",
    title: "El Ritme del Salt",
    subtitle: "L’acústica i la inèrcia",
    question: "Com has sentit el ritme del salt global?",
    hint: "Ritme característic: «ta-ta---ta».",
    options: [
      { label: "Fluid. He anat rebotant i avançant cap endavant fàcilment.", band: "8,5–10", value: 9.25, tone: "high" },
      { label: "Tallat. El primer salt ha anat molt bé, però de cop m’he quedat clavat a terra.", band: "6–8,5", value: 7.25, tone: "mid" },
      { label: "Precipitat. He anat molt ràpid però descontrolat, com si en lloc de saltar estigués corrent.", band: "0–6", value: 3, tone: "low" },
    ],
  },
  {
    key: "landing",
    title: "La Caiguda i el Resultat",
    subtitle: "Eficiència",
    question: "Com has arribat a la sorra?",
    options: [
      { label: "Amb energia, llançant els peus endavant i caient bé.", band: "8,5–10", value: 9.25, tone: "high" },
      { label: "Mort/Sense velocitat. He caigut gairebé en vertical de seguida que he entrat a la sorra.", band: "6–8,5", value: 7.25, tone: "mid" },
      { label: "Desequilibrat/Cap a un costat.", band: "0–6", value: 3, tone: "low" },
    ],
  },
];

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.message === "string" ? body.message : "No s’ha pogut completar l’acció.");
  return body as T;
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="hub-empty"><ClipboardList size={24} /><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function BackButton({ onClick, label = "Enrere" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="hub-back-button" onClick={onClick}><ArrowLeft size={15} /> {label}</button>;
}

const formatJumpMark = (jump: Competition["jumps"][number]) => {
  if (jump.isFoul) return "Nul";
  if (jump.mark !== null && jump.mark !== "") return `${jump.mark.replace(".", ",")} m`;
  return "Sense marca";
};

function CompetitionFields({ athletes, competition, defaultAthleteId }: { athletes: Athlete[]; competition?: Competition; defaultAthleteId: string }) {
  const jumps = Array.from({ length: 6 }, (_, index) => competition?.jumps.find((jump) => jump.jumpNumber === index + 1));
  return <>
    <section className="hub-form-card">
      <div className="section-card-heading"><div><span className="eyebrow">01 / Dades generals</span><h2>Informació de la jornada</h2></div></div>
      <div className="form-grid">
        <label>Atleta<select name="athleteId" required defaultValue={competition?.athleteId ?? defaultAthleteId}>{athletes.map((athlete) => <option value={athlete.id} key={athlete.id}>{athlete.firstName} {athlete.lastName}</option>)}</select></label>
        <label>Lloc<input name="location" required defaultValue={competition?.location ?? ""} placeholder="Lloc de la competició" /></label>
        <label>Data<input name="eventDate" type="date" required defaultValue={competition?.eventDate ?? ""} /></label>
        <label>Objectiu de la competició<input name="objective" required defaultValue={competition?.objective ?? ""} placeholder="Objectiu definit abans de competir" /></label>
        <label>Millor marca personal<input name="personalBest" inputMode="decimal" defaultValue={competition?.personalBest ?? ""} placeholder="m (opcional)" /></label>
        <label>Objectiu final de temporada<input name="seasonGoal" inputMode="decimal" defaultValue={competition?.seasonGoal ?? ""} placeholder="m (opcional)" /></label>
      </div>
    </section>
    <section className="hub-form-card">
      <div className="section-card-heading"><div><span className="eyebrow">02 / Els sis salts</span><h2>Marques de la competició</h2><p>La marca es conserva tal com la introdueixes. Si marques Nul, es mostrarà Nul.</p></div></div>
      <div className="jump-entry-grid">{jumps.map((jump, index) => <div className={`jump-entry ${jump?.isFoul ? "is-foul" : jump?.mark ? "has-mark" : ""}`} key={index}><span>SALT {index + 1}</span><input name={`jump-${index + 1}`} inputMode="decimal" defaultValue={jump?.mark ?? ""} placeholder="Marca (m)" aria-label={`Marca del salt ${index + 1}`} /><label className="foul-toggle"><input name={`foul-${index + 1}`} type="checkbox" defaultChecked={jump?.isFoul ?? false} /> Nul</label></div>)}</div>
    </section>
    <section className="hub-form-card objective-result-card">
      <div className="section-card-heading"><div><span className="eyebrow">03 / Resultat</span><h2>Has aconseguit l’objectiu?</h2><p>Deixa el resultat registrat dins la mateixa competició.</p></div></div>
      <div className="objective-choice-grid">
        <label className="objective-choice"><input type="radio" name="achieved" value="yes" required defaultChecked={competition?.achieved === true} /><span><Check size={18} /><strong>Sí, objectiu assolit</strong></span></label>
        <label className="objective-choice"><input type="radio" name="achieved" value="no" required defaultChecked={competition?.achieved === false} /><span><X size={18} /><strong>No, encara no</strong></span></label>
      </div>
      <label className="result-note-label">Notes del resultat<textarea name="resultNote" defaultValue={competition?.resultNote ?? ""} placeholder="Opcional: sensacions, context o correccions del dia" /></label>
    </section>
  </>;
}

function ProductHub({ analysisWorkspace }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [page, setPage] = useState<Page>("inici");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [evaluations, setEvaluations] = useState<TrackEvaluation[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [athleteFormOpen, setAthleteFormOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>({});
  const [assessmentSaved, setAssessmentSaved] = useState(false);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");

  const selectedAthlete = athletes.find((athlete) => athlete.id === selectedAthleteId);
  const selectedCompetition = competitions.find((competition) => competition.id === selectedCompetitionId);

  const loadData = async () => {
    const [athleteData, competitionData, evaluationData] = await Promise.all([
      api<{ athletes: Athlete[] }>("/athletes"),
      api<{ competitions: Competition[] }>("/competitions"),
      api<{ evaluations: TrackEvaluation[] }>("/track-evaluations"),
    ]);
    setAthletes(athleteData.athletes);
    setCompetitions(competitionData.competitions);
    setEvaluations(evaluationData.evaluations);
    setSelectedAthleteId((previous) => previous || athleteData.athletes[0]?.id || "");
  };

  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then((result) => {
        setUser(result.user);
        if (result.user) void loadData();
      })
      .catch(() => setUser(null))
      .finally(() => setLoadingSession(false));
  }, []);

  const notify = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3000);
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setAuthError("");
    try {
      const payload = authMode === "register"
        ? { firstName: values.get("firstName"), lastName: values.get("lastName"), email: values.get("email"), password: values.get("password") }
        : { email: values.get("email"), password: values.get("password") };
      const result = await api<{ user: User }>(authMode === "register" ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(result.user);
      await loadData();
      setPage("inici");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No s’ha pogut accedir al compte.");
    }
  };

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    setAthletes([]);
    setCompetitions([]);
    setEvaluations([]);
    setSelectedAthleteId("");
    setPage("inici");
  };

  const addAthlete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<{ athlete: Athlete }>("/athletes", {
        method: "POST",
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          goals: data.get("goals"),
          technicalNotes: data.get("technicalNotes"),
        }),
      });
      setAthletes((previous) => [...previous, result.athlete].sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)));
      setSelectedAthleteId(result.athlete.id);
      setAthleteFormOpen(false);
      notify("Atleta afegit a l’historial.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut crear l’atleta.");
    }
  };

  const saveCompetition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const jumps = Array.from({ length: 6 }, (_, index) => ({
      mark: data.get(`jump-${index + 1}`),
      isFoul: data.get(`foul-${index + 1}`) === "on",
    }));
    try {
      const result = await api<{ competition: Competition }>("/competitions", {
        method: "POST",
        body: JSON.stringify({
          athleteId: data.get("athleteId"),
          location: data.get("location"),
          eventDate: data.get("eventDate"),
          objective: data.get("objective"),
          personalBest: data.get("personalBest"),
          seasonGoal: data.get("seasonGoal"),
          achieved: data.get("achieved") === "yes",
          resultNote: data.get("resultNote"),
          jumps,
        }),
      });
      setCompetitions((previous) => [result.competition, ...previous]);
      if (result.competition.athleteId) setSelectedAthleteId(result.competition.athleteId);
      notify("Competició i resultat guardats a l’historial.");
      form.reset();
      setPage("historial");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut guardar la competició.");
    }
  };

  const updateCompetition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompetition) return;
    const data = new FormData(event.currentTarget);
    const jumps = Array.from({ length: 6 }, (_, index) => ({
      mark: data.get(`jump-${index + 1}`),
      isFoul: data.get(`foul-${index + 1}`) === "on",
    }));
    try {
      const result = await api<{ competition: Competition }>(`/competitions/${selectedCompetition.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          athleteId: data.get("athleteId"),
          location: data.get("location"),
          eventDate: data.get("eventDate"),
          objective: data.get("objective"),
          personalBest: data.get("personalBest"),
          seasonGoal: data.get("seasonGoal"),
          achieved: data.get("achieved") === "yes",
          resultNote: data.get("resultNote"),
          jumps,
        }),
      });
      setCompetitions((previous) => previous.map((competition) => competition.id === result.competition.id ? result.competition : competition));
      if (result.competition.athleteId) setSelectedAthleteId(result.competition.athleteId);
      notify("Competició actualitzada correctament.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut actualitzar la competició.");
    }
  };

  const openCompetition = (competition: Competition) => {
    setSelectedCompetitionId(competition.id);
    setPage("detall-competició");
  };

  const selectedAssessment = assessmentGroups.map((group) => group.options[assessmentAnswers[group.key] ?? -1]);
  const assessmentComplete = selectedAssessment.every(Boolean);
  const assessmentAverage = assessmentComplete
    ? selectedAssessment.reduce((sum, option) => sum + option.value, 0) / selectedAssessment.length
    : null;

  const saveAssessment = async () => {
    if (!assessmentComplete) return;
    try {
      const result = await api<{ evaluation: TrackEvaluation }>("/track-evaluations", {
        method: "POST",
        body: JSON.stringify({
          athleteId: selectedAthleteId || null,
          approachAnswer: selectedAssessment[0].label,
          rhythmAnswer: selectedAssessment[1].label,
          landingAnswer: selectedAssessment[2].label,
          approachScore: selectedAssessment[0].value,
          rhythmScore: selectedAssessment[1].value,
          landingScore: selectedAssessment[2].value,
        }),
      });
      setEvaluations((previous) => [result.evaluation, ...previous]);
      setAssessmentSaved(true);
      notify("Valoració de pista guardada.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut guardar la valoració.");
    }
  };

  const athleteCompetitions = useMemo(
    () => selectedAthleteId ? competitions.filter((competition) => competition.athleteId === selectedAthleteId) : [],
    [competitions, selectedAthleteId],
  );
  const athleteEvaluations = useMemo(
    () => selectedAthleteId ? evaluations.filter((evaluation) => evaluation.athleteId === selectedAthleteId) : [],
    [evaluations, selectedAthleteId],
  );
  const athleteRecordedBest = useMemo(() => {
    const marks = athleteCompetitions.flatMap((competition) => competition.jumps)
      .filter((jump) => !jump.isFoul && jump.mark !== null)
      .map((jump) => Number(jump.mark))
      .filter((mark) => Number.isFinite(mark));
    return marks.length ? Math.max(...marks) : null;
  }, [athleteCompetitions]);
  const selectedAthleteIndex = athletes.findIndex((athlete) => athlete.id === selectedAthleteId);
  const moveAthlete = (direction: -1 | 1) => {
    if (athletes.length < 2) return;
    const nextIndex = (selectedAthleteIndex + direction + athletes.length) % athletes.length;
    setSelectedAthleteId(athletes[nextIndex].id);
  };

  if (loadingSession) return <div className="hub-loading">Carregant l’espai esportiu…</div>;

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-intro">
          <div className="brand-lockup"><span className="brand-mark">TS<br />01</span><span>Triple Salt</span></div>
          <div><span className="eyebrow">Seguiment esportiu</span><h1>El teu salt, temporada rere temporada.</h1><p>Un espai personal per registrar competicions, seguir l’evolució i conservar l’anàlisi de casa.</p></div>
          <div className="auth-feature-list"><span><Activity size={16} /> Seguiment de la temporada</span><span><Target size={16} /> Objectius visibles</span><span><CircleGauge size={16} /> Anàlisi disponible des de casa</span></div>
        </section>
        <section className="auth-card">
          <div className="auth-tabs"><button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Iniciar sessió</button><button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Crear compte</button></div>
          <h2>{authMode === "login" ? "Torna a la pista" : "Crea el teu espai"}</h2>
          <p>{authMode === "login" ? "Accedeix a les teves dades i registres." : "Les teves dades quedaran disponibles en futurs accessos."}</p>
          <form className="hub-form" onSubmit={submitAuth}>
            {authMode === "register" && <div className="auth-name-grid"><label>Nom<input name="firstName" required autoComplete="given-name" /></label><label>Cognom<input name="lastName" required autoComplete="family-name" /></label></div>}
            <label>Correu electrònic<input type="email" name="email" required autoComplete="email" /></label>
            <label>Contrasenya<input type="password" name="password" minLength={8} required autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label>
            {authError && <div className="form-error" role="alert">{authError}</div>}
            <button className="button-primary auth-submit" type="submit">{authMode === "login" ? "Entrar" : "Crear compte"} <ArrowRight size={15} /></button>
          </form>
        </section>
      </main>
    );
  }

  const renderPage = () => {
    if (page === "casa") return <div className="analysis-embed">{analysisWorkspace}</div>;
    if (page === "inici") return (
      <section className="hub-page">
        <div className="hub-hero"><div><span className="eyebrow">Espai de temporada</span><h1>Hola, {user.firstName}.</h1><p>Registra el que passa a pista i torna a l’anàlisi de casa quan ho necessitis.</p></div><button className="button-primary" onClick={() => setPage("competició")}><CalendarPlus size={16} /> Nova competició</button></div>
        <div className="hub-action-grid">
          {[
            { icon: BarChart3, title: "Historial", text: "Consulta atletes, competicions i evolució quan hi hagi registres.", page: "historial" as Page },
            { icon: Activity, title: "Estic a pista", text: "Fes una valoració ràpida després de saltar.", page: "pista" as Page },
            { icon: CircleGauge, title: "Estic a casa", text: "Accedeix al flux actual de vídeo i anàlisi biomecànica.", page: "casa" as Page },
            { icon: BookOpen, title: "Tècnica", text: "Organitza els continguts i les correccions de cada fase del salt.", page: "tècnica" as Page },
            { icon: Dumbbell, title: "Escalfament", text: "Prepara exercicis, temps i repeticions abans de competir.", page: "escalfament" as Page },
          ].map((card) => <button className="hub-action-card" key={card.page} onClick={() => setPage(card.page)}><card.icon size={21} /><span><strong>{card.title}</strong><small>{card.text}</small></span><ChevronRight size={17} /></button>)}
        </div>
        <div className="hub-summary-grid">
          <article><Users size={18} /><span>Atletes</span><strong>{athletes.length || "—"}</strong><small>{athletes.length ? "Disponibles al teu historial" : "Encara no n’hi ha cap"}</small></article>
          <article><Trophy size={18} /><span>Competicions</span><strong>{competitions.length || "—"}</strong><small>{competitions.length ? "Registres de la temporada" : "Cap competició registrada"}</small></article>
          <article><Flag size={18} /><span>Proper pas</span><strong>{athletes.length ? "Pista" : "Atleta"}</strong><small>{athletes.length ? "Registra una competició o una valoració" : "Afegeix el primer atleta"}</small></article>
        </div>
      </section>
    );
    if (page === "historial") return (
      <section className="hub-page">
        <BackButton onClick={() => setPage("inici")} />
        <div className="hub-title-row"><div><span className="eyebrow">Seguiment de temporada</span><h1>Historial</h1><p>Entra a qualsevol competició per revisar i corregir totes les dades de la jornada.</p></div><button className="button-primary" onClick={() => setAthleteFormOpen(true)}><UserPlus size={16} /> Afegir atleta</button></div>
        {!athletes.length ? <EmptyState title="Encara no hi ha atletes registrats." description="Crea la primera fitxa per començar a relacionar competicions, salts i valoracions." action={<button className="button-primary" onClick={() => setAthleteFormOpen(true)}><Plus size={15} /> Crear atleta</button>} /> : <>
          <div className="athlete-switcher"><button type="button" onClick={() => moveAthlete(-1)} disabled={athletes.length < 2} aria-label="Atleta anterior"><ArrowLeft size={17} /></button><select value={selectedAthleteId} onChange={(event) => setSelectedAthleteId(event.target.value)} aria-label="Canviar d’atleta">{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.firstName} {athlete.lastName}</option>)}</select><button type="button" onClick={() => moveAthlete(1)} disabled={athletes.length < 2} aria-label="Atleta següent"><ArrowRight size={17} /></button></div>
          {selectedAthlete && <div className="athlete-history-grid"><article className="athlete-profile-card"><div className="profile-heading"><span className="athlete-avatar large">{`${selectedAthlete.firstName[0]}${selectedAthlete.lastName[0]}`}</span><div><span className="eyebrow">Fitxa d’atleta</span><h2>{selectedAthlete.firstName} {selectedAthlete.lastName}</h2></div></div><div className="profile-fields"><div><span>Millor marca registrada</span><strong>{athleteRecordedBest === null ? "Encara no disponible" : `${athleteRecordedBest.toFixed(2).replace(".", ",")} m`}</strong></div><div><span>Objectius</span><strong>{selectedAthlete.goals || "Encara no definits"}</strong></div><div><span>Informació tècnica</span><strong>{selectedAthlete.technicalNotes || "Preparada per afegir-hi contingut"}</strong></div><div><span>Valoracions de pista</span><strong>{athleteEvaluations.length ? `${athleteEvaluations.length} registrada${athleteEvaluations.length > 1 ? "s" : ""}` : "Encara no disponibles"}</strong></div></div></article><article className="history-competitions"><div className="section-card-heading"><div><span className="eyebrow">Competicions</span><h2>Últims registres</h2></div><button className="button-outline" onClick={() => setPage("competició")}>Nova</button></div>{athleteCompetitions.length ? athleteCompetitions.map((competition) => <button type="button" className="competition-history-row" key={competition.id} onClick={() => openCompetition(competition)}><div><strong>{competition.location}</strong><span>{competition.eventDate} · Objectiu: {competition.objective}</span><div className="competition-marks">{competition.jumps.map((jump) => <span key={jump.jumpNumber}>S{jump.jumpNumber}: {formatJumpMark(jump)}</span>)}</div></div><div className="competition-result-control"><span>{competition.achieved === null ? "Resultat pendent" : competition.achieved ? "Objectiu assolit" : "Objectiu no assolit"}</span><strong>Veure i editar <ChevronRight size={14} /></strong></div></button>) : <EmptyState title="Encara no hi ha competicions registrades." description="Quan en guardis una, es mostrarà en aquesta fitxa." />}{athleteEvaluations.length > 0 && <div className="track-history"><span className="eyebrow">Valoracions de pista</span>{athleteEvaluations.map((evaluation) => <div key={evaluation.id}><span>{new Date(evaluation.createdAt).toLocaleDateString("ca-ES")}</span><strong>{((Number(evaluation.approachScore) + Number(evaluation.rhythmScore) + Number(evaluation.landingScore)) / 3).toFixed(1).replace(".", ",")} / 10</strong></div>)}</div>}</article></div>}
        </>}
      </section>
    );
    if (page === "competició") return (
      <section className="hub-page">
        <BackButton onClick={() => setPage("inici")} />
        <div className="hub-title-row"><div><span className="eyebrow">Registre de competició</span><h1>Nova competició</h1><p>Les dades que introdueixis quedaran vinculades a l’atleta escollit.</p></div></div>
        {!athletes.length ? <EmptyState title="Primer crea un atleta." description="La competició necessita una fitxa d’atleta per quedar ben organitzada a l’historial." action={<button className="button-primary" onClick={() => setAthleteFormOpen(true)}><UserPlus size={15} /> Crear atleta</button>} /> :
          <form className="competition-form" onSubmit={saveCompetition}>
            <CompetitionFields athletes={athletes} defaultAthleteId={selectedAthleteId} />
            <button className="button-primary save-competition" type="submit"><Save size={16} /> Guardar competició</button>
          </form>}
      </section>
    );
    if (page === "detall-competició") return (
      <section className="hub-page">
        <BackButton onClick={() => setPage("historial")} label="Enrere a l’historial" />
        {!selectedCompetition ? <EmptyState title="No s’ha trobat la competició." description="Torna a l’historial i selecciona un registre disponible." action={<button className="button-primary" type="button" onClick={() => setPage("historial")}>Obrir l’historial</button>} /> :
          <>
            <div className="hub-title-row competition-detail-heading"><div><span className="eyebrow">Edició persistent</span><h1>{selectedCompetition.location}</h1><p>Revisa i modifica totes les dades, salts i resultat d’aquesta competició.</p></div><span className="detail-date"><Pencil size={15} /> {selectedCompetition.eventDate}</span></div>
            <form className="competition-form" onSubmit={updateCompetition}>
              <CompetitionFields athletes={athletes} competition={selectedCompetition} defaultAthleteId={selectedAthleteId} />
              <button className="button-primary save-competition" type="submit"><Save size={16} /> Guardar canvis</button>
            </form>
          </>}
      </section>
    );
    if (page === "pista") return (
      <section className="hub-page">
        <BackButton onClick={() => setPage("inici")} />
        <div className="hub-title-row"><div><span className="eyebrow">Valoració posterior al salt</span><h1>Estic a pista</h1><p>Una autoavaluació general. No substitueix l’anàlisi biomecànica de vídeo.</p></div>{athletes.length > 0 && <label className="compact-select">Atleta<select value={selectedAthleteId} onChange={(event) => setSelectedAthleteId(event.target.value)}>{athletes.map((athlete) => <option value={athlete.id} key={athlete.id}>{athlete.firstName} {athlete.lastName}</option>)}</select></label>}</div>
        <div className="assessment-stack">{assessmentGroups.map((group, groupIndex) => <article className="assessment-card" key={group.key}><div className="assessment-heading"><span>0{groupIndex + 1}</span><div><h2>{group.title}</h2><p>{group.subtitle}</p></div></div>{group.hint && <div className="assessment-hint">{group.hint}</div>}<h3>{group.question}</h3><div className="assessment-options">{group.options.map((option, index) => <button type="button" className={`${assessmentAnswers[group.key] === index ? "selected" : ""} ${option.tone}`} onClick={() => { setAssessmentAnswers((previous) => ({ ...previous, [group.key]: index })); setAssessmentSaved(false); }} key={option.label}><span>{option.label}</span><strong>{option.band}</strong></button>)}</div></article>)}</div>
        {assessmentComplete && <section className="assessment-result"><div><span className="eyebrow">Valoració general</span><h2>{assessmentAverage?.toFixed(1).replace(".", ",")} / 10</h2><p>Resultat calculat a partir de les tres opcions escollides. És una orientació general, no una anàlisi biomecànica.</p></div><button className="button-primary" onClick={saveAssessment} disabled={assessmentSaved}><Check size={16} /> {assessmentSaved ? "Valoració guardada" : "Guardar valoració"}</button></section>}
      </section>
    );
    if (page === "tècnica" || page === "escalfament") {
      const isTechnique = page === "tècnica";
      const title = isTechnique ? "Tècnica" : "Escalfament";
      const blocks = isTechnique ? ["Cursa d’aproximació", "Entrada a la taula", "Hop", "Step", "Jump", "Caiguda", "Errors habituals", "Correccions"] : ["01 — Exercici", "02 — Exercici", "03 — Exercici"];
      return <section className="hub-page"><BackButton onClick={() => setPage("inici")} /><div className="hub-title-row"><div><span className="eyebrow">Espai de contingut</span><h1>{title}</h1><p>{isTechnique ? "Prepara explicacions, vídeos, imatges i exercicis per a cada fase del triple salt." : "Prepara l’ordre, vídeos, instruccions, temps i repeticions de l’escalfament previ."}</p></div></div><div className="content-placeholder-grid">{blocks.map((block) => <article key={block} className="content-placeholder"><span className="placeholder-icon">{isTechnique ? <BookOpen size={19} /> : <Dumbbell size={19} />}</span><h2>{block}</h2><p>Aquí apareixerà el contingut quan l’afegeixis.</p><div><span>Text</span><span>Vídeo</span><span>{isTechnique ? "Imatges" : "Temps / repeticions"}</span></div></article>)}</div></section>;
    }
    return null;
  };

  return (
    <div className="hub-shell">
      {page !== "casa" && <aside className="hub-sidebar"><div className="sidebar-brand"><div className="brand-mark">TS<br />01</div><div><div className="font-display" style={{ fontSize: "1.1rem", lineHeight: 1 }}>Triple Salt</div><div className="sidebar-label" style={{ padding: ".35rem 0 0", color: "hsl(215 14% 67%)" }}>Temporada i anàlisi</div></div></div><nav className="sidebar-nav" aria-label="Navegació principal"><div className="sidebar-label">El teu espai</div>{navItems.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}><item.icon size={16} /><span>{item.label}</span></button>)}</nav><div className="hub-user-block"><span className="athlete-avatar">{`${user.firstName[0]}${user.lastName[0]}`}</span><div><strong>{user.firstName} {user.lastName}</strong><button onClick={logout}><LogOut size={12} /> Tancar sessió</button></div></div></aside>}
      <main className={page === "casa" ? "hub-analysis-main" : "hub-main"}>
        {page === "casa" && <div className="analysis-hub-bar"><button className="button-outline" onClick={() => setPage("inici")}><ArrowLeft size={14} /> Tornar a l’espai de temporada</button><div><span className="athlete-avatar">{`${user.firstName[0]}${user.lastName[0]}`}</span><strong>{user.firstName} {user.lastName}</strong><button className="button-quiet" onClick={logout}><LogOut size={14} /><span>Tancar sessió</span></button></div></div>}
        {page !== "casa" && <header className="hub-topbar"><div><span className="live-dot" /><span className="eyebrow">Espai personal / Triple salt</span></div><button className="button-outline" onClick={() => setPage("casa")}><CircleGauge size={14} /> Estic a casa</button></header>}
        {renderPage()}
      </main>
      {athleteFormOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAthleteFormOpen(false); }}><form className="modal hub-athlete-modal" onSubmit={addAthlete}><div className="modal-title-row"><div><span className="eyebrow">Nou atleta</span><h2>Crea una fitxa</h2></div><button type="button" className="button-quiet" onClick={() => setAthleteFormOpen(false)} aria-label="Tancar"><X size={15} /></button></div><div className="auth-name-grid"><label>Nom<input name="firstName" required autoFocus /></label><label>Cognom<input name="lastName" required /></label></div><label>Objectius<input name="goals" placeholder="Opcional" /></label><label>Informació tècnica<textarea name="technicalNotes" placeholder="Opcional" /></label><div className="modal-actions"><button type="button" className="button-outline" onClick={() => setAthleteFormOpen(false)}>Cancel·lar</button><button className="button-primary" type="submit"><Save size={14} /> Guardar atleta</button></div></form></div>}
      {feedback && <div className="toast" role="status">{feedback}</div>}
    </div>
  );
}

export default ProductHub;