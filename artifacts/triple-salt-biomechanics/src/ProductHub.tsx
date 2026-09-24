import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  ClipboardList,
  Dumbbell,
  Eye,
  EyeOff,
  Flag,
  Home,
  LogOut,
  MapPin,
  Plus,
  Pencil,
  Play,
  Save,
  Target,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
type CompetitionProgressPoint = {
  id: string;
  location: string;
  fullDate: string;
  shortDate: string;
  chartLabel: string;
  bestMark: number | null;
  bestLabel: string;
  jumpsDone: number;
  objective: string;
  achieved: boolean | null;
};
type TrackEvaluation = {
  id: string;
  athleteId: string | null;
  competitionId: string | null;
  approachScore: string;
  rhythmScore: string;
  landingScore: string;
  finalScore: string | null;
  location: string | null;
  evaluationDate: string | null;
  createdAt: string;
  criteria?: Array<{ key: string; question: string; level: AssessmentOption["level"]; criterion: string; score: number; principalError?: string; associatedErrors?: string[]; consequence?: string; improvement?: string }>;
  assessmentData?: {
    schemaVersion?: number;
    criteria?: Array<{ key: string; question: string; level: AssessmentOption["level"]; criterion: string; score: number; principalError?: string; associatedErrors?: string[]; consequence?: string; improvement?: string }>;
  };
};
export type HomeAnalysisPayload = {
  athleteId: string;
  location: string;
  analysisDate: string;
  mediaIds?: string[];
  sourceVideoFile?: File;
  analysisData: {
    phases: Array<{
      phase: "HOP" | "STEP" | "JUMP";
      angles: Array<{ label: string; athleteValue: number; referenceValue: number; difference: number }>;
      significantDeviationCount: number;
    }>;
    snapshot?: Record<string, unknown>;
  };
};
type HomeAnalysis = HomeAnalysisPayload & { id: string; createdAt: string };
type AssessmentDiagnosis = {
  principalError: string;
  associatedErrors: string[];
  consequence: string;
  improvement: string;
};
type AssessmentOption = {
  level: "Excel·lent" | "Notable" | "Satisfactori" | "Suspès";
  description: string;
  value: 10 | 8.5 | 7 | 0;
  tone: "excellent" | "notable" | "satisfactory" | "failed";
  diagnosis?: AssessmentDiagnosis;
};
type AssessmentGroup = {
  key: string;
  title: string;
  subtitle: string;
  question: string;
  hint?: string;
  options: AssessmentOption[];
};
type WarmupItem = { title?: string; description: string; note?: string };
type WarmupSubsection = { title: string; intro?: string; items: WarmupItem[] };
type WarmupSection = { number: string; title: string; intro?: string; videoSrc?: string; posterSrc?: string; imageSrc?: string; imageAlt?: string; subsections?: WarmupSubsection[]; items?: WarmupItem[] };

type Props = {
  analysisWorkspace: (options: {
    athletes: Athlete[];
    selectedAthleteId: string;
    onAthleteChange: (athleteId: string) => void;
    onSave: (payload: HomeAnalysisPayload) => Promise<void>;
    initialSnapshot?: Record<string, unknown> | null;
    analysisId?: string | null;
  }) => ReactNode;
};

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
    title: "Cursa d’aproximació",
    subtitle: "Velocitat, progressió i control fins a la taula",
    question: "Com executa l’atleta la cursa d’aproximació fins a la taula de batuda?",
    options: [
      { level: "Excel·lent", description: "Realitza una cursa ràpida, progressiva i controlada, amb trajectòria rectilínia, coordinació adequada i arribada a la taula sense desviar la mirada.", value: 10, tone: "excellent" },
      {
        level: "Notable", description: "Realitza una cursa adequada i ràpida, però amb alguna irregularitat lleu en el ritme, la coordinació o els darrers passos.", value: 8.5, tone: "notable",
        diagnosis: {
          principalError: "Lleugera irregularitat en la cursa d’aproximació.",
          associatedErrors: ["Lleugera reducció de la velocitat abans de la batuda.", "Petita alteració del ritme en els darrers passos.", "Lleugera tensió del tronc superior.", "Coordinació de braços i cames no gaire eficient."],
          consequence: "Pot produir una lleugera pèrdua de velocitat en arribar a la batuda i reduir l’eficàcia del hop, l’step i el jump.",
          improvement: "Realitzar curses d’aproximació progressives mantenint la velocitat fins a la batuda. Fer repeticions amb ritme constant i coordinació de braços i cames.",
        },
      },
      {
        level: "Satisfactori", description: "Arriba a la taula amb una velocitat moderada, una acceleració poc progressiva o modificacions del ritme en els darrers passos.", value: 7, tone: "satisfactory",
        diagnosis: {
          principalError: "Cursa d’aproximació poc eficient.",
          associatedErrors: ["Arribar massa lluny de la taula.", "Córrer amb el cos excessivament endavant.", "Córrer amb el cos excessivament enrere.", "Córrer amb una postura baixa o assentada.", "Arribar amb una velocitat insuficient.", "Tècnica de carrera rígida o descoordinada."],
          consequence: "Batuda forçada o poc eficient, menor força d’enlairament, recepció descoordinada i pèrdua progressiva de velocitat en el hop, l’step i el jump.",
          improvement: "Fer curses progressives adoptant una posició més vertical quan ja s’ha aconseguit velocitat. Treballar curses curtes amb els malucs alts, el tronc equilibrat i una velocitat progressiva.",
        },
      },
      {
        level: "Suspès", description: "Presenta una cursa poc adequada, amb una pèrdua considerable de velocitat, una frenada evident o poca coordinació.", value: 0, tone: "failed",
        diagnosis: {
          principalError: "Interrupció de la cursa.",
          associatedErrors: ["Frenada evident abans de la batuda.", "Arribar gairebé aturat.", "Mirar la taula durant els darrers passos.", "Cursa excessivament inclinada.", "Arribar massa ràpid i perdre el control de la batuda.", "Desviació lateral de la trajectòria."],
          consequence: "La batuda queda fortament afectada i es redueixen la velocitat i la força disponibles per al hop. Això condiciona també l’step i el jump.",
          improvement: "Reduir temporalment la cursa, treballar curses curtes i progressives, utilitzar una marca per automatitzar els darrers passos i practicar sobre una línia recta abans de tornar a la cursa completa.",
        },
      },
    ],
  },
  {
    key: "rhythm",
    title: "Ritme i continuïtat de les tres fases",
    subtitle: "Connexió entre hop, step i jump",
    question: "Com manté l’atleta la continuïtat entre salts?",
    options: [
      { level: "Excel·lent", description: "Enllaça les tres fases de manera fluida, contínua i coordinada, mantenint la velocitat horitzontal i sense enfonsar-se entre salts.", value: 10, tone: "excellent" },
      {
        level: "Notable", description: "Manté una bona continuïtat, però presenta una lleu alteració del ritme o una petita pèrdua de velocitat en alguna transició.", value: 8.5, tone: "notable",
        diagnosis: {
          principalError: "Lleugera pèrdua de continuïtat.",
          associatedErrors: ["Petita pèrdua de velocitat després d’un contacte.", "Lleugera descoordinació en una transició.", "Temps de contacte amb el terra lleugerament excessiu."],
          consequence: "Disminució moderada de la velocitat disponible per a la fase següent.",
          improvement: "Realitzar seqüències curtes de hop-step i step-jump mantenint la velocitat després de cada contacte. Fer multisalts en moviment per reduir el temps de contacte.",
        },
      },
      {
        level: "Satisfactori", description: "Completa les tres fases, però presenta una disminució apreciable de velocitat o una transició poc fluida entre una o més fases.", value: 7, tone: "satisfactory",
        diagnosis: {
          principalError: "Pèrdua apreciable de continuïtat entre fases.",
          associatedErrors: ["Recepció pesada.", "Contacte amb el terra poc actiu.", "Enfonsament durant la recepció.", "Manca de coordinació en la transició.", "Pèrdua progressiva de velocitat."],
          consequence: "El salt següent disposa de menys velocitat i capacitat d’impuls, amb una reducció de potència i distància final.",
          improvement: "Practicar el hop, l’step i el jump amb recepcions actives. Fer recepcions sobre una cama amb el maluc elevat i integrar progressivament tota la seqüència.",
        },
      },
      {
        level: "Suspès", description: "Perd considerablement la continuïtat, presenta pauses o frenades importants o no completa adequadament la seqüència.", value: 0, tone: "failed",
        diagnosis: {
          principalError: "Interrupció clara de la seqüència.",
          associatedErrors: ["Pèrdua important de velocitat entre salts.", "Recepció molt pesada.", "Enfonsament excessiu.", "Incapacitat per generar una nova batuda amb potència.", "Arribar gairebé aturat al jump."],
          consequence: "Els salts posteriors es fan amb molta menys velocitat i força, reduint considerablement la distància final.",
          improvement: "Descompondre el triple salt en hop-step i step-jump, treballar cada transició a baixa intensitat i augmentar progressivament la velocitat fins a completar la seqüència sense interrupcions.",
        },
      },
    ],
  },
  {
    key: "stability",
    title: "Estabilitat i control corporal",
    subtitle: "Control postural durant les tres fases",
    question: "Com manté l’atleta el control postural durant l’execució del triple salt?",
    options: [
      { level: "Excel·lent", description: "Manté una posició corporal estable i equilibrada, amb bona coordinació entre braços, tronc, malucs i cames i sense desviacions laterals significatives.", value: 10, tone: "excellent" },
      {
        level: "Notable", description: "Manté un bon control corporal, tot i presentar petites compensacions del tronc o dels braços que no afecten significativament la continuïtat.", value: 8.5, tone: "notable",
        diagnosis: {
          principalError: "Petites descompensacions posturals.",
          associatedErrors: ["Lleugera inclinació del tronc.", "Petita descoordinació dels braços.", "Lleugera desviació de l’eix corporal."],
          consequence: "Disminució lleu de l’estabilitat i de l’eficiència de les transicions.",
          improvement: "Realitzar hop i step a baixa velocitat mirant un punt fix o amb gravació en vídeo, mantenint el tronc estable i coordinant braços i cames.",
        },
      },
      {
        level: "Satisfactori", description: "Manté l’equilibri general, però presenta inclinacions o moviments compensatoris visibles que redueixen l’eficàcia.", value: 7, tone: "satisfactory",
        diagnosis: {
          principalError: "Pèrdua apreciable del control corporal.",
          associatedErrors: ["Manca de verticalitat del tronc.", "Desplaçament del pes respecte de la cama de suport.", "Braços descompassats.", "Trajectòria lleugerament desviada.", "Tensió excessiva del tronc superior."],
          consequence: "L’atleta s’enlaira descompensat i disminueixen el control, la coordinació i la capacitat de generar força.",
          improvement: "Fer segons de triple mantenint la mirada a l’horitzó i centrant-se a conservar el tronc vertical.",
        },
      },
      {
        level: "Suspès", description: "Presenta una pèrdua significativa d’estabilitat, inclinacions excessives, desequilibris importants o coordinació deficient.", value: 0, tone: "failed",
        diagnosis: {
          principalError: "Pèrdua greu de l’eix corporal.",
          associatedErrors: ["Desviació lateral important.", "Pèrdua del control del centre de gravetat.", "Salt completament descompensat.", "Caiguda lateral.", "Desequilibri greu durant una de les fases."],
          consequence: "La força es dispersa lateralment en lloc de dirigir-se endavant, disminuint la distància i augmentant el risc d’una execució incorrecta.",
          improvement: "Realitzar segons de triple sense enfonsar-se i mantenint una posició corporal recta. Treballar el control per fases abans d’integrar-ho tot.",
        },
      },
    ],
  },
  {
    key: "landing",
    title: "Caiguda al fossat",
    subtitle: "Projecció final i contacte amb la sorra",
    question: "Com executa l’atleta la fase final i la caiguda al fossat de sorra?",
    options: [
      { level: "Excel·lent", description: "Projecta les dues cames endavant, fa contactar primer els talons i coordina braços i tronc per maximitzar la distància.", value: 10, tone: "excellent" },
      {
        level: "Notable", description: "Fa una caiguda tècnicament correcta, però amb una petita pèrdua d’extensió de cames o de coordinació.", value: 8.5, tone: "notable",
        diagnosis: {
          principalError: "Petita ineficiència en la projecció final.",
          associatedErrors: ["No projectar completament les cames.", "Lleugera falta de coordinació entre braços i cames.", "Separació poc òptima de les cames."],
          consequence: "Petita pèrdua de distància final.",
          improvement: "Fer caigudes des de salts curts portant les dues cames endavant, repetint el gest progressivament i coordinant els braços amb la projecció de les cames.",
        },
      },
      {
        level: "Satisfactori", description: "Fa una caiguda funcional, però la projecció de les cames o l’acció de braços i tronc és poc eficient.", value: 7, tone: "satisfactory",
        diagnosis: {
          principalError: "Tècnica de caiguda poc eficient.",
          associatedErrors: ["Caiguda prematura.", "No portar suficientment les cames endavant.", "No portar el cos endavant després del contacte.", "Separar excessivament les cames.", "Caure amb els peus massa junts."],
          consequence: "Pèrdua directa de centímetres en la marca final.",
          improvement: "Practicar caigudes des de salts curts o una petita alçada, treballant la projecció de les cames i el moviment del cos després del contacte.",
        },
      },
      {
        level: "Suspès", description: "Fa una caiguda deficient, amb projecció insuficient de les cames o el tronc excessivament enrere.", value: 0, tone: "failed",
        diagnosis: {
          principalError: "Caiguda incorrecta.",
          associatedErrors: ["Caure cap enrere.", "Recolzar les mans darrere del cos.", "Caure assegut.", "Caure lateralment.", "Contactar amb una part posterior del cos abans que amb els peus."],
          consequence: "Pèrdua significativa de distància final i, en alguns casos, una caiguda descontrolada.",
          improvement: "Començar des de poca alçada i sense velocitat, practicant la projecció de les cames i el control del tronc. Progressar evitant mans, caigudes enrere o laterals.",
        },
      },
    ],
  },
  {
    key: "board-validity",
    title: "Batuda i validesa del salt",
    subtitle: "Contacte amb la taula i aprofitament de la distància",
    question: "On ha fet el primer salt respecte a la taula?",
    options: [
      { level: "Excel·lent", description: "Ha trepitjat la fusta de la taula de ple, sense fer nul.", value: 10, tone: "excellent" },
      {
        level: "Notable", description: "Salt vàlid, però ha perdut aproximadament un pam de distància.", value: 8.5, tone: "notable",
        diagnosis: {
          principalError: "Petit desajust en la batuda.",
          associatedErrors: ["Contacte lleugerament allunyat de la posició òptima.", "Petita alteració del ritme abans de la batuda.", "Impuls lleugerament poc eficient."],
          consequence: "Petita reducció de la força o de la velocitat disponible per al hop.",
          improvement: "Realitzar curses curtes amb una marca de batuda, repetint el contacte a velocitat progressiva i automatitzant el ritme dels darrers passos.",
        },
      },
      {
        level: "Satisfactori", description: "Salt vàlid, però no ha trepitjat la taula de batuda.", value: 7, tone: "satisfactory",
        diagnosis: {
          principalError: "Batuda poc eficient.",
          associatedErrors: ["Batuda massa baixa.", "Batuda massa alta i vertical.", "Contacte amb l’avantpeu.", "Arribar lluny de la taula.", "Batuda precipitada o forçada."],
          consequence: "Pèrdua de velocitat horitzontal, menor impuls i una execució menys eficient del hop.",
          improvement: "Fer petits salts amb una trajectòria intermèdia i reduir temporalment la cursa per evitar una batuda precipitada, ajustant progressivament la distància d’arribada.",
        },
      },
      {
        level: "Suspès", description: "Salt nul: ha trepitjat la línia vermella o plastilina, o ha saltat clarament per davant.", value: 0, tone: "failed",
        diagnosis: {
          principalError: "Batuda greument incorrecta o nul·la.",
          associatedErrors: ["Salt nul.", "Batuda excessivament vertical.", "Contacte incorrecte amb la taula.", "Arribar gairebé aturat.", "Pèrdua total del control de la batuda."],
          consequence: "El primer salt queda fortament reduït o no es pot executar correctament i això condiciona necessàriament l’step i el jump.",
          improvement: "Treballar cursa i batuda de manera aïllada a baixa velocitat, començar amb una cursa curta, utilitzar referències visuals i augmentar la distància quan el contacte sigui vàlid i controlat.",
        },
      },
    ],
  },
];

const warmupSections: WarmupSection[] = [
  {
    number: "1",
    title: "ESCALFAMENT GENERAL",
    videoSrc: `${import.meta.env.BASE_URL}videos/escalfament-general.mp4`,
    posterSrc: `${import.meta.env.BASE_URL}videos/escalfament-general-poster.jpg`,
    subsections: [
      {
        title: "1.1 Cursa contínua",
        items: [{
          title: "Cursa contínua",
          description: "Trotar durant uns 5–10 minuts a un ritme suau i regeneratiu per activar el sistema cardiovascular i augmentar la temperatura corporal de manera progressiva.",
          note: "5–10 minuts · Ritme suau",
        }],
      },
      {
        title: "1.2 Tècnica de cursa",
        intro: "Realitzar els exercicis en una recta d’aproximadament 25 metres.",
        items: [
          { title: "Caminar de puntetes", description: "Avançar caminant sobre la part davantera dels peus, mantenint els talons separats del terra. El tronc es manté dret i el moviment ha de ser controlat." },
          { title: "Caminar de talons", description: "Avançar recolzant principalment els talons, amb les puntes dels peus elevades i dirigides cap amunt. Cal evitar inclinar excessivament el tronc enrere." },
          { title: "Skipping endavant", description: "Desplaçar-se endavant elevant alternativament els genolls fins a una alçada aproximada de la cintura. El tronc es manté dret, la mirada cap endavant i els braços acompanyen el moviment." },
          { title: "Talons al gluti", description: "Córrer suaument portant els talons cap als glutis de manera alterna. El tronc es manté dret i els braços segueixen el moviment natural de la cursa." },
          { title: "Desplaçaments laterals", description: "Amb els peus separats i els genolls lleugerament flexionats, desplaçar-se ràpidament cap a un costat, impulsant-se amb la cama contrària. Les cames no s’han de creuar." },
          { title: "Desplaçaments laterals amb encreuament de cames", description: "Desplaçar-se lateralment encreuant una cama per davant o per darrere de l’altra de manera alterna. El tronc es manté estable i els passos han de ser coordinats." },
          { title: "Cames rectes", description: "Desplaçar-se endavant mantenint les cames gairebé esteses i evitant flexionar els genolls. Els peus han de contactar activament amb el terra i els braços han d’acompanyar el moviment." },
          { title: "Una cama recta i l’altra en skipping", description: "Avançar combinant dos gestos: amb una cama es realitza el moviment de cames rectes i amb l’altra es fa skipping. Després s’intercanvien les funcions de les cames." },
          { title: "Heidi", description: "Impulsar-se verticalment amb una cama mentre l’altra s’eleva flexionant el maluc i el genoll. El braç contrari a la cama elevada acompanya el moviment. L’aterratge ha de ser estable abans de repetir amb l’altra cama." },
          { title: "Segons de triple", description: "Realitzar una seqüència de salts alternats cap endavant, canviant el peu de suport i mantenint un ritme fluid. Els contactes han de ser actius i ràpids, evitant aterrar de taló. Els braços ajuden a mantenir el ritme i l’avançament.", note: "Recta d’aproximadament 50 metres" },
          { title: "Progressions", description: "Fer un sprint començant a poc a poc i acabant amb el teu màxim.", note: "2 × 50 metres" },
        ],
      },
      {
        title: "1.3 Mobilitat articular",
        items: [
          { title: "Rotacions de braços", description: "Realitzar cercles amplis amb els braços, primer cap endavant i després cap enrere.", note: "10 rotacions en cada direcció" },
          { title: "Balancejos laterals de cama", description: "Dret davant d’una superfície estable, agafar-s’hi amb les dues mans i balancejar una cama cap a un costat i cap a l’altre com un pèndol.", note: "10 balancejos per cama" },
          { title: "Mobilitat de genolls", description: "Amb els peus junts i els genolls una mica flexionats, realitzar petites rotacions cap a la dreta i després cap a l’esquerra.", note: "15 segons en cada direcció" },
          { title: "Mobilitat de turmells", description: "Mantenir un peu pla a terra i, amb l’altre, flexionar la punta i realitzar rotacions de turmell en les dues direccions.", note: "30 segons per turmell · 15 segons en cada sentit" },
        ],
      },
      {
        title: "1.4 Estiraments actius",
        intro: "Realitzar els estiraments en una recta d’aproximadament 25 metres.",
        items: [
          { title: "Estocades caminant amb torsió", description: "Fer un pas llarg endavant, flexionar els genolls i baixar el maluc de manera controlada. Girar suaument el tronc cap al costat de la cama davantera i continuar avançant." },
          { title: "Llançaments de cama frontals", description: "Avançar caminant i elevar una cama cap endavant, mantenint-la gairebé estesa. L’alçada s’ha d’adaptar a la mobilitat individual i no s’ha de forçar." },
        ],
      },
    ],
  },
  {
    number: "2",
    title: "ESCALFAMENT ESPECÍFIC",
    videoSrc: `${import.meta.env.BASE_URL}videos/escalfament-especific.mp4`,
    posterSrc: `${import.meta.env.BASE_URL}videos/escalfament-especific-poster.jpg`,
    items: [
      { title: "Salts horitzontals", description: "Realitzar 5 salts, flexionant moderadament els genolls i els malucs, impulsant-se cap endavant amb l’ajuda dels braços i aterrant al fossat amb els dos peus. L’aterratge ha de ser controlat.", note: "5 salts" },
      { title: "Salts horitzontals a una cama (5 per cama)", description: "Realitzar un salt horitzontal impulsant-se amb una sola cama i aterrar amb els dos peus al fossat. Alternar les cames i mantenir el tronc estable.", note: "5 per cama" },
      { title: "10 impulsos endavant a peu junts", description: "Multisalts en moviment: impulsar-se amb els turmells i evitar doblegar els genolls.", note: "10 impulsos" },
      { title: "10 impulsos endavant a una cama", description: "Multisalts en moviment: impulsar-se amb els turmells i evitar doblegar els genolls.", note: "10 impulsos" },
      { title: "10 batudes curtes alternades en progressió cap endavant", description: "Multisalts en moviment amb batudes curtes alternant les cames i avançant de manera progressiva.", note: "10 batudes" },
      { title: "Transferències des de la taula de batuda (9 metres)", description: "Sortir amb els peus junts, realitzar quatre batudes coordinades i finalitzar amb una caiguda al fossat.", note: "3 repeticions" },
      { title: "Triple salt amb cursa reduïda (6 passes)", description: "Realitzar una cursa curta però controlada i acabar-la fent els tres salts de triple salt.", note: "6 passes" },
      { title: "Acceleracions", description: "Realitzar 1–2 rectes de 50 metres, a intensitat màxima.", note: "1–2 rectes de 50 metres" },
    ],
  },
  {
    number: "3",
    title: "AJUST DE TALONACIÓ I COMPETICIÓ",
    videoSrc: `${import.meta.env.BASE_URL}videos/ajust-talonacio-competicio.mp4`,
    posterSrc: `${import.meta.env.BASE_URL}videos/ajust-talonacio-competicio-poster.jpg`,
    items: [
      { title: "Mesura de la cursa (talonació)", description: "Talonar els peus establerts amb l’entrenador/a amb un tros de cinta o fita." },
      { title: "Cursa de prova sense batuda", description: "Córrer a una velocitat pròxima a la de competició, passant per sobre de la taula de batuda sense saltar i sense allargar les passes finals. Enregistrar un vídeo o rebre informació d’una altra persona per comprovar si s’ha trepitjat la taula, si s’ha quedat lluny o si l’ajust ha estat correcte." },
      { title: "Assaig de seqüència completa", description: "Fer curses completes amb execució del triple salt, mantenint el control en els darrers metres sense modificar la mida del pas i mantenint la mirada a l’horitzó.", note: "2 curses completes" },
    ],
  },
  {
    number: "4",
    title: "QUÈ FER ENTRE SALTS DURANT LA COMPETICIÓ?",
    videoSrc: `${import.meta.env.BASE_URL}videos/tornada-calma-actualitzat.mp4`,
    posterSrc: `${import.meta.env.BASE_URL}videos/tornada-calma-actualitzat-poster.jpg`,
    items: [
      { title: "Hidratació", description: "Fer petits glops d’aigua entre salts. En cas de calor, buscar una zona d’ombra, utilitzar crema solar i portar gorra si cal. També és important refrescar-se regularment." },
      { title: "Reactivació (5 persones abans de saltar)", description: "Mentre s’espera el torn, evitar quedar-se completament en repòs durant massa temps. Aproximadament 5 persones abans de saltar, es poden realitzar exercicis suaus de reactivació, com ara multisalts, skipping, progressions o batudes.", note: "Aproximadament 5 persones abans de saltar" },
      { title: "Enfocament mental", description: "Visualitzar la tècnica, recordar els objectius de la competició i mantenir la concentració en allò que es vol executar." },
    ],
  },
  {
    number: "5",
    title: "FINAL DE LA COMPETICIÓ - TORNADA A LA CALMA",
    videoSrc: `${import.meta.env.BASE_URL}videos/tornada-calma.mp4`,
    posterSrc: `${import.meta.env.BASE_URL}videos/tornada-calma-poster.jpg`,
    items: [
      { title: "Foam Roller", description: "Utilitzar el rodet lentament sobre quàdriceps, isquiotibials, glutis i bessons." },
      { title: "Estirament de torsió espinal", description: "Asseure’s amb les cames esteses, flexionar una cama i passar-la per sobre de l’altra. Girar suaument el tronc cap al costat de la cama flexionada." },
      { title: "Isquiotibials", description: "Estirat a terra amb una cama estirada cap endavant i l’altra flexionada. Inclinar el tronc lleugerament cap a la cama estirada fins a notar un estirament suau." },
      { title: "Quàdriceps", description: "Dret, agafar el peu i portar-lo cap al gluti amb la mà, mantenint el cos recte i els genolls pròxims." },
      { title: "Pilota de tenis", description: "Dret, col·locar una pilota de tenis sota la planta del peu i realitzar petits moviments circulars, des del taló fins a la zona dels dits." },
    ],
  },
  {
    number: "6",
    title: "RECORDATORIS",
    imageSrc: `${import.meta.env.BASE_URL}images/recordatoris-pista.jpeg`,
    imageAlt: "Vista de la pista d’atletisme des de la graderia",
    items: [
      { description: "L’escalfament és una preparació, no una reivindicació. Cal reservar energia pels intents oficials." },
      { description: "El triple no és una acció de força parada, sinó una seqüència de moviments en velocitat. Has de fer exercicis en constant moviment perquè el múscul no s’acostumi a una contracció molt lenta." },
      { description: "La velocitat és fonamental en el triple salt. Si no s’arriba a una velocitat elevada i controlable durant la cursa, serà més difícil aconseguir un bon salt. Cal buscar una velocitat alta, però sense perdre el control tècnic." },
      { description: "L’escalfament ha de ser coherent i lògic." },
      { description: "Recorda: “En un salt de triple hi ha 3 salts per poder fallar en alguna cosa i un petit fallo que puguis fer es multiplica per 3.” — Naiara Estanga." },
      { description: "Marca correctament el punt d’inici de la cursa amb una cinta, una fita o una marca visible." },
      { description: "La tècnica de cursa és imprescindible." },
      { description: "El salt no s’ha de preveure: la cursa s’ha de continuar de manera natural fins a la batuda." },
      { description: "Corre mirant cap endavant i evita mirar el terra durant els darrers passos." },
      { description: "Escalfa prou, però sense excedir-te. Un bon escalfament ha de preparar-te, no fatigar-te." },
      { description: "Estableix una motivació, un objectiu o un propòsit concret que t’ajudi a concentrar-te i confiar en les teves capacitats." },
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

function WarmupItemRow({ item }: { item: WarmupItem }) {
  return (
    <li className="warmup-exercise-row">
      <span className="warmup-exercise-marker" aria-hidden="true" />
      <div>
        {item.title && <h4>{item.title}</h4>}
        <p>{item.description}</p>
        {item.note && <span className="exercise-note">{item.note}</span>}
      </div>
    </li>
  );
}

function WarmupSectionCard({ section }: { section: WarmupSection }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStarted, setVideoStarted] = useState(false);

  const playVideo = async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
    } catch {
      videoRef.current.controls = true;
    }
  };

  return (
    <article className="warmup-section-card">
      <div className="warmup-section-heading">
        <span className="warmup-section-number">{section.number.padStart(2, "0")}</span>
        <div>
          <span className="eyebrow">Apartat {section.number}</span>
          <h2>{section.title}</h2>
          {section.intro && <p>{section.intro}</p>}
        </div>
      </div>
      <div className="warmup-card-layout">
        <div className="warmup-card-information">
          {section.subsections ? (
            <div className="warmup-subsections">
              {section.subsections.map((subsection) => (
                <section className="warmup-subsection" key={subsection.title}>
                  <div className="warmup-subsection-heading">
                    <h3>{subsection.title}</h3>
                    {subsection.intro && <p>{subsection.intro}</p>}
                  </div>
                  <ul className="warmup-exercise-list">
                    {subsection.items.map((item, index) => <WarmupItemRow item={item} key={`${subsection.title}-${index}`} />)}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="warmup-exercise-list">
              {section.items?.map((item, index) => <WarmupItemRow item={item} key={`${section.number}-${index}`} />)}
            </ul>
          )}
        </div>
        <div className="warmup-section-video">
          {section.imageSrc ? (
            <img src={section.imageSrc} alt={section.imageAlt ?? ""} className="warmup-section-image" />
          ) : section.videoSrc ? (
            <>
              <video
                ref={videoRef}
                poster={section.posterSrc}
                controls
                preload={section.number === "1" ? "auto" : "metadata"}
                playsInline
                className="exercise-video"
                onPlay={() => setVideoStarted(true)}
                onEnded={() => setVideoStarted(false)}
              >
                <source src={section.videoSrc} type="video/mp4" />
                El teu navegador no pot reproduir aquest vídeo.
              </video>
              {!videoStarted && (
                <button type="button" className="warmup-video-play" onClick={playVideo} aria-label={`Reproduir ${section.title.toLocaleLowerCase("ca-ES")}`}>
                  <Play size={24} fill="currentColor" />
                  <span>Reproduir vídeo</span>
                </button>
              )}
            </>
          ) : (
            <div className="exercise-video-pending">
              <div className="pending-icon-wrapper">
                <Video size={24} />
              </div>
              <strong>Vídeo de {section.title.toLocaleLowerCase("ca-ES")}</strong>
              <span>Pendent d’afegir</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

const formatJumpMark = (jump: Competition["jumps"][number]) => {
  if (jump.isFoul) return "Nul";
  if (jump.mark !== null && jump.mark !== "") return `${jump.mark.replace(".", ",")} m`;
  return "Sense marca";
};

const getCompetitionBest = (competition: Competition) => {
  const validMarks = competition.jumps
    .filter((jump) => !jump.isFoul && jump.mark !== null && jump.mark !== "")
    .map((jump) => Number(jump.mark))
    .filter((mark) => Number.isFinite(mark));
  return validMarks.length ? Math.max(...validMarks) : null;
};

function AthleteCard({ athlete, competitions, analyses, onSelect, onEdit }: { athlete: Athlete, competitions: Competition[], analyses: HomeAnalysis[], onSelect: () => void, onEdit: () => void }) {
  const validMarks = competitions.flatMap(c => c.jumps.filter(j => !j.isFoul && j.mark).map(j => Number(j.mark)).filter(m => Number.isFinite(m)));
  const bestMark = validMarks.length ? Math.max(...validMarks).toFixed(2).replace('.', ',') : "--";

  return (
    <article className="athlete-roster-card">
      <div className="ac-header">
        <div className="ac-avatar">{athlete.firstName[0]}{athlete.lastName[0]}</div>
        <button type="button" className="button-quiet ac-edit" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label="Editar atleta">
          <Pencil size={14} />
        </button>
      </div>
      <div className="ac-info" onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}>
        <h3>{athlete.firstName} {athlete.lastName}</h3>
        <p className="ac-goals">{athlete.goals || "Sense objectius definits"}</p>
      </div>
      <div className="ac-metrics">
        <div className="ac-metric"><strong>{bestMark}</strong><span>PB (m)</span></div>
        <div className="ac-metric"><strong>{competitions.length}</strong><span>Competicions</span></div>
        <div className="ac-metric"><strong>{analyses.length}</strong><span>Anàlisis</span></div>
      </div>
      <div className="ac-footer">
        <button type="button" className="button-primary w-full" onClick={onSelect}>Obrir perfil</button>
      </div>
    </article>
  );
}

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

const techniqueIntro = [
  "El triple salt és una disciplina atlètica que requereix una combinació perfecta de velocitat, força, coordinació i precisió tècnica, ja que l’atleta ha d’enllaçar tres salts consecutius, mantenint el màxim rendiment possible sense perdre la velocitat horitzontal.",
  "La prova es divideix en tres fases principals: el primer salt, conegut com a hop, el segon salt, anomenat step, i el tercer salt, que és el jump, que finalitza amb la caiguda al fossat de sorra. Els dos primers salts es realitzen amb la mateixa cama de batuda, mentre que el tercer es realitza amb la cama contrària.",
  "L’objectiu principal és aconseguir la màxima distància horitzontal possible, mantenint la velocitat i la coordinació durant les diferents fases."
];

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'figure'; src: string | string[]; caption: string };

type TechniqueSectionDef = {
  id: string;
  label: string;
  pdfTitle: string;
  accentColor: string;
  content: ContentBlock[];
};

const techniqueSections: TechniqueSectionDef[] = [
  {
    id: "cursa",
    label: "Cursa d'impuls",
    pdfTitle: "1. Cursa d'aproximació",
    accentColor: "hsl(var(--primary))",
    content: [
      { type: 'paragraph', text: "La cursa d’aproximació té com a objectiu principal aconseguir una velocitat elevada i controlada abans d’arribar a la taula de batuda, ja que és imprescindible per assolir una bona marca. Per aconseguir-ho, cal accelerar de manera progressiva, mantenint sempre la tècnica de carrera i la coordinació dels moviments. En començar, el cos es manté lleugerament inclinat cap endavant per facilitar l’acceleració inicial, i a mesura que es va guanyant velocitat i s’apropa a la taula de batuda, el tronc es va redreçant gradualment fins a una posició més vertical." },
      { type: 'figure', src: ["technique/approach-acceleration.png", "technique/approach-upright.png"], caption: "Imatge 2: L’atleta inicia la fase d’acceleració amb el tronc lleugerament inclinat cap endavant i a mesura que va agafant velocitat assoleix una posició més vertical. Font pròpia." },
      { type: 'paragraph', text: "Durant els últims passos de la cursa, l’atleta ha d’incrementar la freqüència de les gambades i l’elevació dels genolls, mantenint una trajectòria horitzontal i recta. A diferència del salt de llargada, on es pot modificar l’última gambada per abaixar el centre de gravetat i aconseguir un angle de sortida més elevat, en el triple salt és crucial mantenir una trajectòria de cursa alta i horitzontal, evitant generar una velocitat vertical excessiva que pugui perjudicar la continuïtat dels salts. Per aconseguir-ho, les cames han de descriure un moviment semicircular que afavoreixi la fluïdesa de la cursa i permeti arribar a la taula de batuda en la posició òptima." },
      { type: 'paragraph', text: "A més, el moviment dels braços juga un paper clau durant aquesta fase, ja que ajuda a generar velocitat i a mantenir la coordinació entre el tren superior i l’inferior. Els braços s’han de moure energèticament i han d’anar coordinats amb les cames, perquè una acció més ràpida dels braços incrementa la freqüència del moviment de les cames. Aquesta acció, a més, contribueix a impulsar els genolls amunt i endavant. Alhora, és important que l’atleta mantingui una actitud relaxada, perquè una tensió excessiva del tren superior pot afectar negativament la tècnica de carrera." },
      { type: 'paragraph', text: "Un altre aspecte fonamental és el talonament, que implica a establir prèviament la distància de la cursa, mesurada en peus, per assegurar que l’atleta arribi correctament a la taula de batuda. Aquest ajustament depèn de diversos factors, com la tècnica de carrera, el ritme i la distribució de l’esforç. Per aquest motiu, encara que l’atleta mantingui una cursa uniforme, pot ser necessari modificar el talonament en diferents intents si no aconsegueix ajustar correctament l’últim recolzament a la taula." },
      { type: 'figure', src: "technique/approach-checkmark.jpeg", caption: "Imatge 3: Procés de talonació. Font pròpia." },
      { type: 'paragraph', text: "Pel que fa a la posició del peu, és essencial que es romangui “armat” abans del contacte amb el terra, és a dir, amb la punta aixecada. Aquesta postura facilita un recolzament actiu i afavoreix la continuïtat del moviment, a més de contribuir a l’elevació del genoll i a mantenir una postura corporal correcta. En canvi, si el peu entra en contacte amb el terra amb la punta caiguda, pot dificultar l'acció d'impuls i provocar una acció de frenada. Per això, el recolzament ha de ser ràpid i dinàmic, minimitzant el temps de contacte amb el terra per evitar perdre velocitat i alteracions brusques de la postura corporal." },
      { type: 'figure', src: "technique/approach-foot.png", caption: "Imatge 4: L’atleta entra en contacte amb la pista amb el peu “armat”, cosa que permet una postura recta del cos. Font pròpia." },
      { type: 'paragraph', text: "Finalment, la transició entre la cursa d’aproximació i la batuda ha de ser fluida, sense anticipar el salt ni interrompre la continuïtat de la carrera. L’atleta ha de mantenir la mirada endavant i seguir una trajectòria horitzontal, evitant mirar cap a terra per buscar visualment la taula. D’aquesta manera, es pot iniciar la primera fase del triple salt amb la velocitat i la coordinació adequades." },
      { type: 'figure', src: "technique/approach-forward-look-frame-5.png", caption: "Imatge 5: L’atleta realitza una cursa ràpida i amb la mirada fixa cap endavant. Font pròpia." }
    ]
  },
  {
    id: "hop",
    label: "Hop",
    pdfTitle: "2. Primera fase: hop",
    accentColor: "var(--color-hop)",
    content: [
      { type: 'paragraph', text: "El hop és el primer dels tres salts del triple salt. Comença amb la batuda sobre la taula i consisteix a impulsar-se amb una cama per tornar a contactar amb el terra amb aquesta mateixa cama. L’objectiu principal d’aquesta fase no és aconseguir la màxima alçada, sinó avançar mantenint la màxima velocitat horitzontal possible de la cursa d’aproximació. Per això, la trajectòria del salt ha de ser relativament baixa i dirigida cap endavant. Així, es facilita la continuïtat dels moviments i es prepara l’atleta per a la segona fase, el step." },
      { type: 'paragraph', text: "Durant la batuda, el peu entra en contacte amb la taula i exerceix la força necessària per impulsar el cos cap endavant i lleugerament cap amunt. És important que el contacte sigui ràpid i actiu, per evitar una pèrdua excessiva de velocitat horitzontal. Aquesta batuda no ha de ser tan pronunciada com la del salt de llargada, ja que l’atleta haurà de tornar a recolzar-se sobre la mateixa cama i necessita conservar prou velocitat per continuar la seqüència de salts." },
      { type: 'paragraph', text: "Un cop el peu deixa la taula, comença la fase de vol. En aquest moment, la cama que ha realitzat la batuda es flexiona i fa un moviment circular sota el maluc, com si estigués pedalejant. Aquest gest ajuda a recuperar la cama i preparar-la pel pròxim contacte amb el terra. Al mateix temps, la cama lliure avança i eleva el genoll. El tronc s’ha de mantenir vertical i equilibrat, mentre que els braços es mouen de manera coordinada amb les cames per ajudar a mantenir l’estabilitat i facilitar la continuïtat del moviment. Els braços es poden moure de dues maneres durant els salts: realitzant un moviment altern de braços (estil polonès) o utilitzant la tècnica dels braços simultanis (estil rus)." },
      { type: 'paragraph', text: "La recepció del hop és un moment especialment exigent, ja que l’atleta torna a contactar amb el terra amb la mateixa cama que ha utilitzat per a la batuda. Per preparar aquest contacte, la cama s’estén gairebé del tot i el peu toca a terra de manera activa amb la planta (en unió amb el taló), procurant que el recolzament es produeixi a prop del centre de masses. Aquesta acció ajuda a minimitzar l’efecte de frenada i a conservar la velocitat horitzontal, alhora que permet enllaçar la recepció amb la batuda del step." },
      { type: 'figure', src: "technique/hop.webp", caption: "Imatge 6: Fase de vol del hop. L’atleta realitza un moviment circular de la cama de batuda sota el maluc (efecte de pedaleig), mentre la cama lliure avança amb el genoll elevat. Els braços acompanyen el moviment de manera coordinada per mantenir l'equilibri i la posició vertical del tronc. Font pròpia." }
    ]
  },
  {
    id: "step",
    label: "Step",
    pdfTitle: "3. Segona fase: step",
    accentColor: "var(--color-step)",
    content: [
      { type: 'paragraph', text: "El step és el segon salt del triple salt. Comença quan l’atleta torna a impulsar-se amb la mateixa cama amb què ha aterrat després del hop i acaba quan toca el terra amb la cama contrària. Aquesta fase és especialment exigent perquè l’atleta ha de mantenir l’equilibri i conservar tanta velocitat horitzontal com sigui possible. Per tant, és important enllaçar els moviments de manera contínua, sense perdre massa velocitat ni deixar que el cos s’enfonsi durant el salt." },
      { type: 'paragraph', text: "Durant la batuda del step, el peu entra en contacte amb el terra de manera activa i la cama de suport s’estén per impulsar el cos. Alhora, la cama lliure es mou amb força cap amunt i endavant, amb el genoll flexionat i elevat. Aquesta acció és clau per projectar el cos i mantenir una bona postura durant el vol. El tronc ha de romandre vertical i recte, evitant inclinacions excessives que poden afectar l’equilibri. També és fonamental que el contacte amb el terra sigui ràpid, per reduir la pèrdua de velocitat i facilitar la continuïtat cap al tercer salt." },
      { type: 'paragraph', text: "Durant la fase de vol del step, braços, espatlles i cames han de treballar en harmonia. El moviment de basculació implica coordinar l’acció del tren superior amb el moviment oposat dels malucs, ajudant a estabilitzar el cos i compensar les rotacions que poden aparèixer durant el salt. Aquesta coordinació és essencial per mantenir una posició equilibrada, preparar un contacte actiu amb el terra i evitar una pèrdua brusca de velocitat abans d’iniciar el jump." },
      { type: 'paragraph', text: "En la recepció del step, l’atleta toca a terra amb la cama contrària a la que ha utilitzat en la batuda. Aquest contacte ha de ser actiu, permetent que el moviment continuï sense interrupcions. És important evitar una recepció passiva, entrar amb la punta del peu o deixar que el cos s’enfonsi abans de la següent batuda. Una bona coordinació entre la cama de suport, la cama lliure i els braços facilita la preparació del tercer salt." },
      { type: 'figure', src: "technique/step.webp", caption: "Imatge 7: Fase de vol del step. Font pròpia." }
    ]
  },
  {
    id: "jump",
    label: "Jump",
    pdfTitle: "4. Tercera fase: jump",
    accentColor: "var(--color-jump)",
    content: [
      { type: 'paragraph', text: "El jump és el tercer i últim salt de la seqüència. Es realitza amb la cama contrària a les dues primeres batudes. En aquesta fase, l’atleta ha d’aprofitar la velocitat horitzontal i la força que encara conserva per aconseguir la màxima distància possible abans de caure al fossat de sorra. Com que durant els salts anteriors s’ha anat perdent velocitat, és important executar una batuda eficaç i mantenir una bona coordinació dels moviments." },
      { type: 'paragraph', text: "Durant l’enlairament del jump, la cama de batuda s’estén per impulsar el cos cap endavant i cap amunt. Al mateix temps, la cama lliure es dirigeix cap endavant amb el genoll elevat, mentre que el tronc es manté vertical i els braços acompanyen el moviment per potenciar l’impuls. A diferència dels dos salts anteriors, en aquesta fase es busca una trajectòria una mica més elevada, ja que és l’última oportunitat per guanyar distància abans de la caiguda." },
      { type: 'figure', src: "technique/jump-takeoff.webp", caption: "Imatge 8: Inici de la fase de vol del jump. L'atleta s'impulsa cercant una trajectòria una mica més elevada. Font pròpia." },
      { type: 'paragraph', text: "La fase de vol del jump es pot dividir en quatre moments: l’enlairament, que és quan l’atleta deixa el terra després de la batuda. La suspenció, durant la qual l’atleta flota a l’aire i prepara la posició del cos. L’adaptació, en què els braços i les cames es col·loquen cap endavant per preparar l’aterratge. Finalment, la caiguda, que és quan es produeix el contacte amb la sorra. Durant aquests moments, és clau mantenir l’equilibri i preparar bé les cames per aprofitar al màxim la distància del salt." },
      { type: 'figure', src: "technique/jump-adaptation.jpeg", caption: "Imatge 9: Canvi de la fase de suspensió a adaptació. Font pròpia." }
    ]
  },
  {
    id: "caiguda",
    label: "Caiguda",
    pdfTitle: "5. Vol i caiguda al fossat",
    accentColor: "hsl(var(--foreground))",
    content: [
      { type: 'paragraph', text: "La caiguda al fossat és l’última part del triple salt i és important perquè la manera d’aterrar pot fer guanyar o perdre distància en el resultat final. Durant el tram final del vol, l’atleta ha de flexionar els malucs i projectar les dues cames cap endavant, mantenint-les elevades fins al moment del contacte amb la sorra. Els braços també juguen un paper important per conservar aquesta posició i a mantenir l’equilibri del cos mentre es prepara l’aterratge." },
      { type: 'paragraph', text: "El primer contacte amb la sorra es fa amb els talons i les cames estirades cap endavant. Just després, l’atleta flexiona els genolls i inclina el tronc cap endavant, de manera que el cos passi per sobre de la marca dels peus. D’aquesta manera, s’evita caure cap enrere i deixar una marca més pròxima a la taula de batuda, cosa que reduiria la distància registrada." },
      { type: 'figure', src: "technique/landing.webp", caption: "Imatge 10: Caiguda del jump amb les cames i els braços projectats cap al davant. Font pròpia." }
    ]
  }
];

function ProductHub({ analysisWorkspace }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [page, setPage] = useState<Page>("inici");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [evaluations, setEvaluations] = useState<TrackEvaluation[]>([]);
  const [homeAnalyses, setHomeAnalyses] = useState<HomeAnalysis[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [athleteSelectionOpen, setAthleteSelectionOpen] = useState(true);
  const [athleteFormOpen, setAthleteFormOpen] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [athleteToDelete, setAthleteToDelete] = useState<Athlete | null>(null);
  const [feedback, setFeedback] = useState("");
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>({});
  const [assessmentSaved, setAssessmentSaved] = useState(false);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [selectedHomeAnalysisId, setSelectedHomeAnalysisId] = useState<string | null>(null);
  const [selectedHomeSnapshot, setSelectedHomeSnapshot] = useState<Record<string, unknown> | null>(null);
  const [competitionToDelete, setCompetitionToDelete] = useState<Competition | null>(null);
  const [evaluationToDelete, setEvaluationToDelete] = useState<TrackEvaluation | null>(null);
  const [homeAnalysisToDelete, setHomeAnalysisToDelete] = useState<HomeAnalysis | null>(null);
  const [trackLocation, setTrackLocation] = useState("");
  const [trackDate, setTrackDate] = useState(() => new Date().toLocaleDateString("en-CA"));

  const selectedAthlete = athletes.find((athlete) => athlete.id === selectedAthleteId);
  const selectedCompetition = competitions.find((competition) => competition.id === selectedCompetitionId);
  const evaluationCriteria = (evaluation: TrackEvaluation) => evaluation.assessmentData?.criteria ?? evaluation.criteria ?? [];

  const loadData = async () => {
    const [athleteData, competitionData, evaluationData, homeAnalysisData] = await Promise.all([
      api<{ athletes: Athlete[] }>("/athletes"),
      api<{ competitions: Competition[] }>("/competitions"),
      api<{ evaluations: TrackEvaluation[] }>("/track-evaluations"),
      api<{ analyses: HomeAnalysis[] }>("/home-analyses"),
    ]);
    setAthletes(athleteData.athletes);
    setCompetitions(competitionData.competitions);
    setEvaluations(evaluationData.evaluations);
    setHomeAnalyses(homeAnalysisData.analyses);
  };

  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then(async (result) => {
        setUser(result.user);
        if (result.user) await loadData();
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
      setSelectedAthleteId("");
      setAthleteSelectionOpen(true);
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
    setHomeAnalyses([]);
    setSelectedAthleteId("");
    setAthleteSelectionOpen(true);
    setPage("inici");
  };

  const resetAthleteContext = (newId: string) => {
    if (page === "casa") {
      if (!window.confirm("Canviar d'atleta reiniciarà l'anàlisi de vídeo actual. Vols continuar?")) return;
    }
    setSelectedEvaluationId(null);
    setSelectedHomeAnalysisId(null);
    setSelectedHomeSnapshot(null);
    setSelectedCompetitionId("");
    setCompetitionToDelete(null);
    setEvaluationToDelete(null);
    setHomeAnalysisToDelete(null);
    setAssessmentAnswers({});
    setAssessmentSaved(false);
    setTrackLocation("");
    setTrackDate(new Date().toLocaleDateString("en-CA"));
    setSelectedAthleteId(newId);
    setPage("inici");
    setAthleteSelectionOpen(false);
  };

  const handleAthleteChange = (newId: string) => {
    if (!newId || newId === selectedAthleteId) return;
    resetAthleteContext(newId);
  };

  const openAthleteSelection = () => {
    if (page === "casa" && !window.confirm("Sortir del perfil reiniciarà l'anàlisi de vídeo actual. Vols continuar?")) return;
    setAthleteSelectionOpen(true);
  };

  const addOrEditAthlete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      firstName: data.get("firstName") as string,
      lastName: data.get("lastName") as string,
      goals: (data.get("goals") as string) || null,
      technicalNotes: (data.get("technicalNotes") as string) || null,
    };
    try {
      if (editingAthlete) {
        const updated = await api<Athlete>(`/athletes/${editingAthlete.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setAthletes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)).sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)));
        notify("Atleta actualitzat correctament.");
      } else {
        const result = await api<{ athlete: Athlete }>("/athletes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setAthletes((prev) => [...prev, result.athlete].sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)));
        notify("Atleta afegit a l'historial.");
      }
      setAthleteFormOpen(false);
      setEditingAthlete(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Error desant l'atleta.");
    }
  };

  const deleteAthlete = async () => {
    if (!athleteToDelete) return;
    try {
      await api(`/athletes/${athleteToDelete.id}`, { method: "DELETE" });
      setAthletes((prev) => prev.filter((a) => a.id !== athleteToDelete.id));
      if (selectedAthleteId === athleteToDelete.id) {
        setSelectedAthleteId("");
        setAthleteSelectionOpen(true);
        setPage("inici");
      }
      notify("Atleta esborrat correctament.");
      setAthleteToDelete(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s'ha pogut esborrar l'atleta.");
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
          athleteId: selectedAthleteId,
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
      await loadData();
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
    if (!selectedCompetition || selectedCompetition.athleteId !== selectedAthleteId) {
      notify("Aquesta competició no pertany a l’atleta seleccionat.");
      return;
    }
    const data = new FormData(event.currentTarget);
    const jumps = Array.from({ length: 6 }, (_, index) => ({
      mark: data.get(`jump-${index + 1}`),
      isFoul: data.get(`foul-${index + 1}`) === "on",
    }));
    try {
      const result = await api<{ competition: Competition }>(`/competitions/${selectedCompetition.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          athleteId: selectedAthleteId,
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
      await loadData();
      setSelectedCompetitionId(result.competition.id);
      if (result.competition.athleteId) setSelectedAthleteId(result.competition.athleteId);
      notify("Competició actualitzada correctament.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut actualitzar la competició.");
    }
  };

  const openCompetition = async (competition: Competition) => {
    if (competition.athleteId !== selectedAthleteId) {
      notify("Aquesta competició no pertany a l’atleta seleccionat.");
      return;
    }
    try {
      const result = await api<{ competition: Competition }>(`/competitions/${competition.id}`);
      if (result.competition.athleteId !== selectedAthleteId) throw new Error("Aquesta competició no pertany a l’atleta seleccionat.");
      setCompetitions((previous) => previous.map((item) => item.id === result.competition.id ? result.competition : item));
      setSelectedCompetitionId(result.competition.id);
      setPage("detall-competició");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut recuperar la competició.");
    }
  };

  const deleteCompetition = async () => {
    if (!competitionToDelete) return;
    try {
      await api(`/competitions/${competitionToDelete.id}`, { method: "DELETE" });
      setCompetitions((previous) => previous.filter((competition) => competition.id !== competitionToDelete.id));
      if (selectedCompetitionId === competitionToDelete.id) setSelectedCompetitionId("");
      setCompetitionToDelete(null);
      notify("Competició esborrada de l’historial.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut esborrar la competició.");
    }
  };

  const deleteEvaluation = async () => {
    if (!evaluationToDelete) return;
    try {
      await api(`/track-evaluations/${evaluationToDelete.id}`, { method: "DELETE" });
      setEvaluations((previous) => previous.filter((evaluation) => evaluation.id !== evaluationToDelete.id));
      if (selectedEvaluationId === evaluationToDelete.id) {
        setSelectedEvaluationId(null);
        setAssessmentAnswers({});
      }
      setEvaluationToDelete(null);
      notify("Valoració de pista esborrada de l’historial.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut esborrar la valoració.");
    }
  };

  const deleteHomeAnalysis = async () => {
    if (!homeAnalysisToDelete) return;
    try {
      await api(`/home-analyses/${homeAnalysisToDelete.id}`, { method: "DELETE" });
      setHomeAnalyses((previous) => previous.filter((analysis) => analysis.id !== homeAnalysisToDelete.id));
      if (selectedHomeAnalysisId === homeAnalysisToDelete.id) {
        setSelectedHomeAnalysisId(null);
        setSelectedHomeSnapshot(null);
      }
      setHomeAnalysisToDelete(null);
      notify("Anàlisi de casa esborrada de l’historial.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut esborrar l’anàlisi.");
    }
  };

  const selectedAssessment = assessmentGroups.map((group) => group.options[assessmentAnswers[group.key] ?? -1]);
  const assessmentComplete = selectedAssessment.every(Boolean);
  const assessmentAverage = assessmentComplete
    ? selectedAssessment.reduce((sum, option) => sum + option.value, 0) / selectedAssessment.length
    : null;
  const firstIssueIndex = assessmentComplete
    ? selectedAssessment.findIndex((option) => option.value < 10)
    : -1;
  const firstIssueGroup = firstIssueIndex >= 0 ? assessmentGroups[firstIssueIndex] : null;
  const firstIssueOption = firstIssueIndex >= 0 ? selectedAssessment[firstIssueIndex] : null;
  const selectedIssues = assessmentComplete
    ? assessmentGroups.flatMap((group, index) => {
      const option = selectedAssessment[index];
      return option?.diagnosis ? [{ group, option, diagnosis: option.diagnosis }] : [];
    })
    : [];
  const affectedLaterGroups = firstIssueIndex >= 0
    ? assessmentGroups.slice(firstIssueIndex + 1)
    : [];

  const saveAssessment = async () => {
    if (!assessmentComplete || !trackLocation.trim() || !trackDate) {
      notify("Indica el dia i el lloc abans de guardar la valoració.");
      return;
    }
    try {
      const editableEvaluation = selectedEvaluationId
        ? evaluations.find((evaluation) => evaluation.id === selectedEvaluationId && evaluation.athleteId === selectedAthleteId)
        : null;
      const criteria = assessmentGroups.map((group, index) => ({
        key: group.key,
        question: group.question,
        level: selectedAssessment[index].level,
        criterion: selectedAssessment[index].description,
        score: selectedAssessment[index].value,
        principalError: selectedAssessment[index].diagnosis?.principalError,
        associatedErrors: selectedAssessment[index].diagnosis?.associatedErrors,
        consequence: selectedAssessment[index].diagnosis?.consequence,
        improvement: selectedAssessment[index].diagnosis?.improvement,
      }));
      const result = await api<{ evaluation: TrackEvaluation }>(editableEvaluation ? `/track-evaluations/${editableEvaluation.id}` : "/track-evaluations", {
        method: editableEvaluation ? "PATCH" : "POST",
        body: JSON.stringify({
          athleteId: selectedAthleteId || null,
          location: trackLocation,
          evaluationDate: trackDate,
          criteria,
        }),
      });
      const savedEvaluation = { ...result.evaluation, criteria };
      setEvaluations((previous) => editableEvaluation
        ? previous.map((evaluation) => evaluation.id === savedEvaluation.id ? savedEvaluation : evaluation)
        : [savedEvaluation, ...previous]);
      setAssessmentSaved(true);
      setSelectedEvaluationId(savedEvaluation.id);
      notify("Valoració de pista guardada.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut guardar la valoració.");
    }
  };

  const saveHomeAnalysis = async (payload: HomeAnalysisPayload) => {
    if (payload.athleteId !== selectedAthleteId) throw new Error("L’anàlisi no pertany a l’atleta seleccionat.");
    const editableAnalysis = selectedHomeAnalysisId
      ? homeAnalyses.find((analysis) => analysis.id === selectedHomeAnalysisId && analysis.athleteId === selectedAthleteId)
      : null;
    const snapshot = payload.analysisData.snapshot ? { ...payload.analysisData.snapshot } : null;
    if (snapshot) {
      const images = snapshot.frameImages as Record<string, Array<string | null>> | undefined;
      const existingIds = Array.isArray(snapshot.mediaIds) ? snapshot.mediaIds.filter((id): id is string => typeof id === "string") : [];
      const mediaIds = [...existingIds];
      if (payload.sourceVideoFile) {
        const video = payload.sourceVideoFile;
        const target = await api<{ media: { id: string }; uploadURL: string }>("/athlete-media/uploads", {
          method: "POST",
          body: JSON.stringify({
            athleteId: payload.athleteId,
            fileName: video.name,
            contentType: video.type || "video/mp4",
            mediaKind: "video",
            size: video.size,
          }),
        });
        const uploadResponse = await fetch(target.uploadURL, {
          method: "PUT",
          body: video,
          headers: { "content-type": video.type || "video/mp4" },
        });
        if (!uploadResponse.ok) throw new Error("No s’ha pogut pujar el vídeo original.");
        mediaIds.push(target.media.id);
        snapshot.sourceVideoMediaId = target.media.id;
        snapshot.sourceVideoUrl = `/api/athlete-media/${target.media.id}`;
        snapshot.fileName = video.name;
      }
      if (images) {
        for (const [phase, phaseImages] of Object.entries(images)) {
          for (let index = 0; index < phaseImages.length; index += 1) {
            const image = phaseImages[index];
            if (!image || !image.startsWith("data:")) continue;
            const comma = image.indexOf(",");
            if (comma < 0) throw new Error("La imatge capturada no té un format vàlid.");
            const blob = await fetch(image).then((response) => response.blob());
            const target = await api<{ media: { id: string }; uploadURL: string }>("/athlete-media/uploads", {
              method: "POST",
              body: JSON.stringify({ athleteId: payload.athleteId, fileName: `frame-${phase.toLowerCase()}-${index + 1}.jpg`, contentType: blob.type || "image/jpeg", mediaKind: "frame", size: blob.size }),
            });
            const uploadResponse = await fetch(target.uploadURL, { method: "PUT", body: blob, headers: { "content-type": blob.type || "image/jpeg" } });
            if (!uploadResponse.ok) throw new Error("No s’ha pogut pujar un fotograma capturat.");
            mediaIds.push(target.media.id);
            phaseImages[index] = `/api/athlete-media/${target.media.id}`;
          }
        }
      }
      const persistedMediaIds = [...new Set(mediaIds)];
      snapshot.mediaIds = persistedMediaIds;
      payload = { ...payload, sourceVideoFile: undefined, mediaIds: persistedMediaIds, analysisData: { ...payload.analysisData, snapshot } };
    }
    const method = editableAnalysis ? "PATCH" : "POST";
    const path = editableAnalysis ? `/home-analyses/${editableAnalysis.id}` : "/home-analyses";
    const result = await api<{ analysis: HomeAnalysis }>(path, {
      method,
      body: JSON.stringify(payload),
    });
    setHomeAnalyses((previous) => editableAnalysis
      ? previous.map((analysis) => analysis.id === result.analysis.id ? result.analysis : analysis)
      : [result.analysis, ...previous]);
    setSelectedHomeAnalysisId(result.analysis.id);
    setSelectedHomeSnapshot(result.analysis.analysisData.snapshot ?? snapshot ?? null);
    notify(editableAnalysis ? "Anàlisi de casa actualitzada." : "Anàlisi de casa guardada a l’historial.");
  };

  const athleteCompetitions = useMemo(
    () => selectedAthleteId ? competitions.filter((competition) => competition.athleteId === selectedAthleteId) : [],
    [competitions, selectedAthleteId],
  );
  const athleteEvaluations = useMemo(
    () => selectedAthleteId ? evaluations.filter((evaluation) => evaluation.athleteId === selectedAthleteId) : [],
    [evaluations, selectedAthleteId],
  );
  const athleteHomeAnalyses = useMemo(
    () => selectedAthleteId ? homeAnalyses.filter((analysis) => analysis.athleteId === selectedAthleteId) : [],
    [homeAnalyses, selectedAthleteId],
  );
  const athleteRecordedBest = useMemo(() => {
    const marks = athleteCompetitions.flatMap((competition) => competition.jumps)
      .filter((jump) => !jump.isFoul && jump.mark !== null)
      .map((jump) => Number(jump.mark))
      .filter((mark) => Number.isFinite(mark));
    return marks.length ? Math.max(...marks) : null;
  }, [athleteCompetitions]);
  const competitionProgressData = useMemo<CompetitionProgressPoint[]>(() => (
    [...athleteCompetitions]
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.location.localeCompare(b.location))
      .map((competition) => {
        const bestMark = getCompetitionBest(competition);
        const competitionDate = new Date(`${competition.eventDate}T12:00:00`);
        return {
          id: competition.id,
          location: competition.location,
          fullDate: competitionDate.toLocaleDateString("ca-ES"),
          shortDate: competitionDate.toLocaleDateString("ca-ES", { day: "2-digit", month: "short" }),
          chartLabel: `${competition.location} · ${competitionDate.toLocaleDateString("ca-ES", { day: "2-digit", month: "short" })}`,
          bestMark,
          bestLabel: bestMark === null ? "" : `${bestMark.toFixed(2).replace(".", ",")} m`,
          jumpsDone: competition.jumps.filter((jump) => jump.isFoul || (jump.mark !== null && jump.mark !== "")).length,
          objective: competition.objective,
          achieved: competition.achieved,
        };
      })
  ), [athleteCompetitions]);
  const selectedAthleteIndex = athletes.findIndex((athlete) => athlete.id === selectedAthleteId);
  const moveAthlete = (direction: -1 | 1) => {
    if (athletes.length < 2) return;
    const nextIndex = (selectedAthleteIndex + direction + athletes.length) % athletes.length;
    handleAthleteChange(athletes[nextIndex].id);
  };

  if (loadingSession) return <div className="hub-loading">Carregant l’espai esportiu…</div>;

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-intro">
          <div className="brand-lockup"><span className="brand-mark">TS<br />01</span><span>A peu de salt</span></div>
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
            <label>Contrasenya
              <span className="password-input-wrap">
                <input type={showPassword ? "text" : "password"} name="password" minLength={8} required autoComplete={authMode === "login" ? "current-password" : "new-password"} />
                <button
                  type="button"
                  className="password-visibility"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar la contrasenya" : "Veure la contrasenya"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {authError && <div className="form-error" role="alert">{authError}</div>}
            <button className="button-primary auth-submit" type="submit">{authMode === "login" ? "Entrar" : "Crear compte"} <ArrowRight size={15} /></button>
          </form>
        </section>
      </main>
    );
  }

  if (athleteSelectionOpen || !selectedAthlete) {
    return (
      <main className="athlete-selection-page">
        <header className="athlete-selection-header">
          <div className="brand-lockup"><span className="brand-mark">TS<br />01</span><span>A peu de salt</span></div>
          <button className="button-quiet" onClick={logout}><LogOut size={14} /> Tancar sessió</button>
        </header>
        <section className="athlete-selection-content">
          <div className="athlete-selection-intro">
            <span className="eyebrow">Selecciona el perfil actiu</span>
            <h1>Amb quin atleta treballaràs?</h1>
            <p>Totes les competicions, marques, valoracions, vídeos i anàlisis quedaran associades exclusivament al perfil que triïs.</p>
          </div>
          <div className="athlete-selection-toolbar">
            <span>{athletes.length} atleta{athletes.length === 1 ? "" : "s"} al compte</span>
            <button className="button-primary" onClick={() => { setEditingAthlete(null); setAthleteFormOpen(true); }}><UserPlus size={15} /> Afegir atleta</button>
          </div>
          {athletes.length === 0 ? (
            <EmptyState title="Encara no hi ha cap atleta" description="Crea la primera fitxa abans d’entrar a l’app. Les dades que generis quedaran vinculades a aquest perfil." action={<button className="button-primary" onClick={() => { setEditingAthlete(null); setAthleteFormOpen(true); }}><Plus size={15} /> Crear atleta</button>} />
          ) : (
            <div className="athlete-selection-grid">
              {athletes.map((athlete) => {
                const initials = `${athlete.firstName[0] ?? ""}${athlete.lastName[0] ?? ""}`;
                const competitionCount = competitions.filter((competition) => competition.athleteId === athlete.id).length;
                const analysisCount = homeAnalyses.filter((analysis) => analysis.athleteId === athlete.id).length;
                return (
                  <article className="athlete-selection-card" key={athlete.id}>
                    <div className="athlete-selection-avatar">{initials}</div>
                    <div>
                      <span className="eyebrow">Perfil d’atleta</span>
                      <h2>{athlete.firstName} {athlete.lastName}</h2>
                      <p>{athlete.goals || "Sense objectius definits"}</p>
                    </div>
                    <div className="athlete-selection-stats"><span><strong>{competitionCount}</strong> competicions</span><span><strong>{analysisCount}</strong> anàlisis</span></div>
                    <div className="athlete-selection-actions">
                      <button className="button-outline" onClick={() => { setEditingAthlete(athlete); setAthleteFormOpen(true); }}><Pencil size={14} /> Editar</button>
                      <button className="button-primary" onClick={() => resetAthleteContext(athlete.id)}>Entrar al perfil <ArrowRight size={15} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        {athleteFormOpen && (
          <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAthleteFormOpen(false); }}>
            <form className="modal hub-athlete-modal" onSubmit={addOrEditAthlete}>
              <div className="modal-title-row"><div><span className="eyebrow">{editingAthlete ? "Editar atleta" : "Nou atleta"}</span><h2>{editingAthlete ? "Modifica la fitxa" : "Crea una fitxa"}</h2></div><button type="button" className="button-quiet" onClick={() => { setAthleteFormOpen(false); setEditingAthlete(null); }} aria-label="Tancar"><X size={15} /></button></div>
              <div className="form-grid"><label>Nom<input name="firstName" required defaultValue={editingAthlete?.firstName} /></label><label>Cognoms<input name="lastName" required defaultValue={editingAthlete?.lastName} /></label></div>
              <label>Objectius<textarea name="goals" defaultValue={editingAthlete?.goals ?? ""} /></label>
              <label>Notes tècniques<textarea name="technicalNotes" defaultValue={editingAthlete?.technicalNotes ?? ""} /></label>
              <div className="modal-actions"><button type="button" className="button-outline" onClick={() => setAthleteFormOpen(false)}>Cancel·lar</button><button className="button-primary" type="submit"><Save size={15} /> Guardar atleta</button></div>
            </form>
          </div>
        )}
        {feedback && <div className="toast">{feedback}</div>}
      </main>
    );
  }

  const renderPage = () => {
    if (page === "casa") return <div className="analysis-embed">{analysisWorkspace({
      athletes: selectedAthlete ? [selectedAthlete] : [],
      selectedAthleteId,
      onAthleteChange: handleAthleteChange,
      onSave: saveHomeAnalysis,
      analysisId: selectedHomeAnalysisId,
      initialSnapshot: selectedHomeAnalysisId ? selectedHomeSnapshot : null,
    })}</div>;
    if (page === "inici") return (
      <section className="hub-page">
        <div className="hub-hero">
          <div><span className="eyebrow">Perfil actiu</span><h1>{selectedAthlete.firstName} {selectedAthlete.lastName}</h1><p>{selectedAthlete.goals || "Registra competicions, valora la tècnica i analitza el rendiment d’aquest atleta."}</p></div>
          <button className="button-outline" onClick={openAthleteSelection}><Users size={15} /> Canviar atleta</button>
        </div>
        <div className="hub-action-grid">
          {[
            { icon: BarChart3, title: "Historial", text: "Consulta competicions, marques i anàlisis guardades.", page: "historial" as Page },
            { icon: CalendarPlus, title: "Nova competició", text: "Registra objectius, sis salts i resultat.", page: "competició" as Page },
            { icon: Activity, title: "Estic a pista", text: "Valora la tècnica del salt a peu de pista.", page: "pista" as Page },
            { icon: CircleGauge, title: "Estic a casa", text: "Analitza vídeos, fotogrames i angles.", page: "casa" as Page },
            { icon: BookOpen, title: "Tècnica", text: "Organitza els continguts i les correccions de cada fase del salt.", page: "tècnica" as Page },
            { icon: Dumbbell, title: "Escalfament", text: "Prepara exercicis, temps i repeticions abans de competir.", page: "escalfament" as Page },
          ].map((card) => <button className="hub-action-card" key={card.page} onClick={() => setPage(card.page)}><card.icon size={21} /><span><strong>{card.title}</strong><small>{card.text}</small></span><ChevronRight size={17} /></button>)}
        </div>
      </section>
    );
    if (page === "historial") return (
      <section className="hub-page">
        <BackButton onClick={() => setPage("inici")} label="Tornar a l’inici" />
        <div className="hub-title-row">
          <div>
            <span className="eyebrow">Perfil de l'atleta</span>
            <h1>{selectedAthlete?.firstName} {selectedAthlete?.lastName}</h1>
            <p>{selectedAthlete?.goals || "Sense objectius definits"}</p>
          </div>
          <div className="flex gap-2">
            <button className="button-outline" onClick={() => { setEditingAthlete(selectedAthlete || null); setAthleteFormOpen(true); }}><Pencil size={15} /> Editar</button>
            <button className="button-primary" onClick={() => setPage("competició")}><CalendarPlus size={15} /> Nova competició</button>
          </div>
        </div>
        
        {!athletes.length ? <EmptyState title="Encara no hi ha atletes registrats." description="Crea la primera fitxa per començar a relacionar competicions, salts i valoracions." action={<button className="button-primary" onClick={() => { setEditingAthlete(null); setAthleteFormOpen(true); }}><Plus size={15} /> Crear atleta</button>} /> : <>
          {competitionProgressData.length > 0 && (
            <section className="competition-progress-card">
              <div className="competition-progress-heading">
                <div><span className="eyebrow">Evolució de marques</span><h2>Progrés per competició</h2><p>Millor marca vàlida aconseguida entre els salts registrats a cada competició.</p></div>
                <div className="progress-legend">
                  <span className="achieved" /><strong>Objectiu assolit</strong>
                  <span className="not-achieved" /><strong>Objectiu no assolit</strong>
                  <span className="pending" /><strong>Pendent</strong>
                </div>
              </div>
              <div className="competition-chart-scroll">
                <div style={{ width: `${Math.max(420, competitionProgressData.length * 105)}px` }}>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={competitionProgressData} margin={{ top: 32, right: 18, left: 0, bottom: 58 }} barCategoryGap="18%" accessibilityLayer>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                      <XAxis dataKey="chartLabel" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} dy={12} angle={-12} textAnchor="end" interval={0} height={62} />
                      <YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(value) => `${String(value).replace(".", ",")} m`} />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--primary) / .05)" }}
                        content={({ active, payload }) => {
                          const point = payload?.[0]?.payload as CompetitionProgressPoint | undefined;
                          if (!active || !point) return null;
                          return <div className="competition-chart-tooltip"><strong>{point.location}</strong><span>{point.fullDate}</span><b>{point.bestMark === null ? "Sense marca vàlida" : `${point.bestMark.toFixed(2).replace(".", ",")} m`}</b><small>{point.jumpsDone} salt{point.jumpsDone === 1 ? "" : "s"} registrat{point.jumpsDone === 1 ? "" : "s"}</small></div>;
                        }}
                      />
                      <Bar dataKey="bestMark" maxBarSize={62} radius={[8, 8, 2, 2]}>
                        {competitionProgressData.map((point) => (
                          <Cell
                            key={point.id}
                            fill={point.achieved === true ? "hsl(207 78% 50%)" : point.achieved === false ? "hsl(28 90% 52%)" : "hsl(215 14% 58%)"}
                          />
                        ))}
                        <LabelList dataKey="bestLabel" position="top" fill="hsl(var(--foreground))" fontSize={12} fontWeight={700} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="competition-progress-table" role="table" aria-label="Resum de progrés per competició">
                <div className="competition-progress-table-head" role="row">
                  <span role="columnheader">Competició</span><span role="columnheader">Data</span><span role="columnheader">Salts</span><span role="columnheader">Millor marca</span><span role="columnheader">Objectiu</span>
                </div>
                {competitionProgressData.map((point) => (
                  <div className="competition-progress-table-row" role="row" key={point.id}>
                    <strong role="cell">{point.location}</strong>
                    <span role="cell">{point.fullDate}</span>
                    <span role="cell">{point.jumpsDone}</span>
                    <b role="cell">{point.bestMark === null ? "Sense marca" : `${point.bestMark.toFixed(2).replace(".", ",")} m`}</b>
                    <span role="cell" className={point.achieved === true ? "goal-achieved" : point.achieved === false ? "goal-pending" : ""}>{point.objective}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {selectedAthlete && <>
            <div className="athlete-history-grid">
              <article className="athlete-profile-card">
              <div className="profile-heading"><span className="athlete-avatar large">{`${selectedAthlete.firstName[0]}${selectedAthlete.lastName[0]}`}</span><div><span className="eyebrow">Fitxa d’atleta</span><h2>{selectedAthlete.firstName} {selectedAthlete.lastName}</h2></div></div>
              <div className="profile-fields"><div><span>Millor marca registrada</span><strong>{athleteRecordedBest === null ? "Encara no disponible" : `${athleteRecordedBest.toFixed(2).replace(".", ",")} m`}</strong></div><div><span>Objectius</span><strong>{selectedAthlete.goals || "Encara no definits"}</strong></div><div><span>Informació tècnica</span><strong>{selectedAthlete.technicalNotes || "Preparada per afegir-hi contingut"}</strong></div><div><span>Registres tècnics</span><strong>{athleteEvaluations.length + athleteHomeAnalyses.length || "Encara no disponibles"}</strong></div></div>
              </article>
              <article className="history-competitions history-data-section">
              <div className="section-card-heading"><div><span className="eyebrow">Nova competició</span><h2>Competicions</h2></div><button className="button-outline" onClick={() => setPage("competició")}>Nova</button></div>
              {athleteCompetitions.length ? athleteCompetitions.map((competition) => <div className="competition-history-item" key={competition.id}>
                <button type="button" className="competition-history-row" onClick={() => void openCompetition(competition)}>
                  <div>
                    <strong>{competition.location}</strong>
                    <span>{new Date(`${competition.eventDate}T12:00:00`).toLocaleDateString("ca-ES")} · Objectiu: {competition.objective}</span>
                    {competition.seasonGoal && <span>Objectiu final de temporada: {competition.seasonGoal.replace(".", ",")} m</span>}
                    {competition.resultNote && <span>Notes: {competition.resultNote}</span>}
                    <div className="competition-marks">{competition.jumps.map((jump) => <span key={jump.jumpNumber}>S{jump.jumpNumber}: {formatJumpMark(jump)}</span>)}</div>
                  </div>
                  <div className="competition-result-control"><b>{getCompetitionBest(competition) === null ? "Sense marca" : `Millor: ${getCompetitionBest(competition)?.toFixed(2).replace(".", ",")} m`}</b><span>{competition.achieved === null ? "Resultat pendent" : competition.achieved ? "Objectiu assolit" : "Objectiu no assolit"}</span><strong>Veure i editar <ChevronRight size={14} /></strong></div>
                </button>
                <button type="button" className="competition-delete-button" onClick={() => setCompetitionToDelete(competition)} aria-label={`Esborrar la competició de ${competition.location}`}><Trash2 size={16} /> Esborrar</button>
              </div>) : <EmptyState title="Encara no hi ha competicions registrades." description="Quan en guardis una, es mostrarà en aquesta fitxa." />}
              </article>
            </div>
            <div className="technical-history-grid">
              <section className="technical-history-section track">
                <div className="section-card-heading"><div><span className="eyebrow">Estic a pista</span><h2>Valoracions de pista</h2></div><button className="button-outline" onClick={() => { setSelectedEvaluationId(null); setAssessmentAnswers({}); setPage("pista"); }}>Nova</button></div>
                {athleteEvaluations.length ? athleteEvaluations.map((evaluation) => (
                  <article className="technical-history-item" key={evaluation.id}>
                    <div><MapPin size={15} /><strong>{evaluation.location || "Lloc no registrat"}</strong><span>{evaluation.evaluationDate ? new Date(`${evaluation.evaluationDate}T12:00:00`).toLocaleDateString("ca-ES") : new Date(evaluation.createdAt).toLocaleDateString("ca-ES")}</span></div>
                    <b>{Number(evaluation.finalScore ?? ((Number(evaluation.approachScore) + Number(evaluation.rhythmScore) + Number(evaluation.landingScore)) / 3)).toFixed(1).replace(".", ",")} / 10</b>
                    <small>Cursa {Number(evaluation.approachScore).toFixed(1).replace(".", ",")} · Ritme {Number(evaluation.rhythmScore).toFixed(1).replace(".", ",")} · Caiguda {Number(evaluation.landingScore).toFixed(1).replace(".", ",")}</small>
                    <button type="button" className="button-outline" onClick={async () => {
                      const detail = await api<{ evaluation: TrackEvaluation }>(`/track-evaluations/${evaluation.id}`);
                      const fullEvaluation = detail.evaluation;
                      if (fullEvaluation.athleteId !== selectedAthleteId) {
                        notify("Aquesta valoració no pertany a l’atleta seleccionat.");
                        return;
                      }
                      setEvaluations((previous) => previous.map((item) => item.id === fullEvaluation.id ? fullEvaluation : item));
                      setSelectedEvaluationId(evaluation.id);
                      setTrackLocation(fullEvaluation.location ?? "");
                      setTrackDate(fullEvaluation.evaluationDate ?? new Date().toLocaleDateString("en-CA"));
                      const answers = Object.fromEntries(evaluationCriteria(fullEvaluation).map((criterion) => {
                        const group = assessmentGroups.find((item) => item.key === criterion.key);
                        return [criterion.key, group?.options.findIndex((option) => option.level === criterion.level) ?? -1];
                      }).filter(([, index]) => Number(index) >= 0));
                      setAssessmentAnswers(answers);
                      setAssessmentSaved(false);
                      setPage("pista");
                    }}>Veure i editar <ChevronRight size={14} /></button>
                    <button type="button" className="competition-delete-button" onClick={() => setEvaluationToDelete(evaluation)} aria-label={`Esborrar la valoració de ${evaluation.location || "pista"}`}><Trash2 size={15} /> Esborrar</button>
                  </article>
                )) : <EmptyState title="Encara no hi ha valoracions de pista." description="Quan guardis una valoració, apareixerà aquí amb el seu dia i lloc." />}
              </section>
              <section className="technical-history-section home">
                <div className="section-card-heading"><div><span className="eyebrow">Estic a casa</span><h2>Anàlisis biomecàniques</h2></div><button className="button-outline" onClick={() => { setSelectedHomeAnalysisId(null); setSelectedHomeSnapshot(null); setPage("casa"); }}>Nova</button></div>
                {athleteHomeAnalyses.length ? athleteHomeAnalyses.map((analysis) => (
                  <article className="technical-history-item home-analysis-history" key={analysis.id}>
                    <div><MapPin size={15} /><strong>{analysis.location}</strong><span>{new Date(`${analysis.analysisDate}T12:00:00`).toLocaleDateString("ca-ES")}</span></div>
                    <div className="home-analysis-phase-summary">
                      {analysis.analysisData.phases.map((phase) => <span key={phase.phase}><strong>{phase.phase}</strong>{phase.significantDeviationCount ? `${phase.significantDeviationCount} angle${phase.significantDeviationCount > 1 ? "s" : ""} a revisar` : "Dins diferència moderada"}</span>)}
                    </div>
                    <button type="button" className="button-outline" onClick={async () => {
                      const detail = await api<{ analysis: HomeAnalysis }>(`/home-analyses/${analysis.id}`);
                      if (detail.analysis.athleteId !== selectedAthleteId) {
                        notify("Aquesta anàlisi no pertany a l’atleta seleccionat.");
                        return;
                      }
                      setHomeAnalyses((previous) => previous.map((item) => item.id === detail.analysis.id ? detail.analysis : item));
                      setSelectedHomeAnalysisId(detail.analysis.id);
                      setSelectedHomeSnapshot(detail.analysis.analysisData.snapshot ?? null);
                      setPage("casa");
                    }}>Veure i editar <ChevronRight size={14} /></button>
                    <button type="button" className="competition-delete-button" onClick={() => setHomeAnalysisToDelete(analysis)} aria-label={`Esborrar l’anàlisi de ${analysis.location}`}><Trash2 size={15} /> Esborrar</button>
                  </article>
                )) : <EmptyState title="Encara no hi ha anàlisis de casa." description="Completa els angles de HOP, STEP i JUMP i guarda el resultat." />}
              </section>
            </div>
          </>}
        </>}
      </section>
    );
    if (page === "competició") return (
      <section className="hub-page">
        <BackButton onClick={() => setPage("inici")} />
        <div className="hub-title-row"><div><span className="eyebrow">Registre de competició</span><h1>Nova competició</h1><p>Les dades que introdueixis quedaran vinculades a l’atleta escollit.</p></div></div>
        {!athletes.length ? <EmptyState title="Primer crea un atleta." description="La competició necessita una fitxa d’atleta per quedar ben organitzada a l’historial." action={<button className="button-primary" onClick={() => setAthleteFormOpen(true)}><UserPlus size={15} /> Crear atleta</button>} /> :
          <form className="competition-form" onSubmit={saveCompetition}>
            <CompetitionFields athletes={selectedAthlete ? [selectedAthlete] : []} defaultAthleteId={selectedAthleteId} />
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
              <CompetitionFields athletes={selectedAthlete ? [selectedAthlete] : []} competition={selectedCompetition} defaultAthleteId={selectedAthleteId} />
              <button className="button-primary save-competition" type="submit"><Save size={16} /> Guardar canvis</button>
            </form>
          </>}
      </section>
    );
    if (page === "pista") return (
      <section className="hub-page track-assessment-page">
        <BackButton onClick={() => setPage("inici")} />
        <div className="hub-title-row"><div><span className="eyebrow">Anàlisi immediata del salt</span><h1>Estic a pista</h1><p>Valora cada aspecte observat i obtén una nota tècnica clara del salt.</p></div>{athletes.length > 0 && <label className="compact-select">Atleta<select value={selectedAthleteId} onChange={(event) => handleAthleteChange(event.target.value)}>{athletes.map((athlete) => <option value={athlete.id} key={athlete.id}>{athlete.firstName} {athlete.lastName}</option>)}</select></label>}</div>
        <section className="session-record-fields">
          <div><span className="eyebrow">Dades del registre</span><h2>Dia i lloc de la valoració</h2></div>
          <label>Dia<input type="date" required value={trackDate} onChange={(event) => { setTrackDate(event.target.value); setAssessmentSaved(false); }} /></label>
          <label>Lloc<input required value={trackLocation} onChange={(event) => { setTrackLocation(event.target.value); setAssessmentSaved(false); }} placeholder="Pista, estadi o instal·lació" /></label>
        </section>
        <div className="assessment-overview">
          <div>
            <span className="eyebrow">Escala de puntuació</span>
            <h2>Cada nivell té una nota fixa</h2>
            <p>No s’utilitzen punts intermedis: cada resposta aporta el valor màxim indicat.</p>
          </div>
          <div className="assessment-scale" aria-label="Escala de puntuació">
            <span className="excellent"><strong>10</strong> Excel·lent</span>
            <span className="notable"><strong>8,5</strong> Notable</span>
            <span className="satisfactory"><strong>7</strong> Satisfactori</span>
            <span className="failed"><strong>0</strong> Suspès</span>
          </div>
          <div className="assessment-progress">
            <div><span>Progrés</span><strong>{selectedAssessment.filter(Boolean).length} / {assessmentGroups.length}</strong></div>
            <div className="assessment-progress-track"><span style={{ width: `${(selectedAssessment.filter(Boolean).length / assessmentGroups.length) * 100}%` }} /></div>
          </div>
        </div>
        <div className="assessment-stack">
          {assessmentGroups.map((group, groupIndex) => (
            <article className="assessment-card" key={group.key}>
              <div className="assessment-heading"><span>{String(groupIndex + 1).padStart(2, "0")}</span><div><h2>{group.title}</h2><p>{group.subtitle}</p></div></div>
              {group.hint && <div className="assessment-hint">{group.hint}</div>}
              <h3>{group.question}</h3>
              <div className="assessment-options">
                {group.options.map((option, index) => (
                  <button type="button" className={`${assessmentAnswers[group.key] === index ? "selected" : ""} ${option.tone}`} onClick={() => { setAssessmentAnswers((previous) => ({ ...previous, [group.key]: index })); setAssessmentSaved(false); }} key={option.level}>
                    <span className="assessment-option-copy"><strong>{option.level}</strong><span>{option.description}</span></span>
                    <span className="assessment-option-score">{String(option.value).replace(".", ",")}</span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
        {assessmentComplete && <>
          <section className="assessment-result"><div><span className="eyebrow">Nota final del salt</span><h2>{assessmentAverage?.toFixed(1).replace(".", ",")} / 10</h2><p>Mitjana de les {assessmentGroups.length} preguntes, inclosa la taula i validesa.</p></div><button className="button-primary" onClick={saveAssessment} disabled={assessmentSaved}><Check size={16} /> {assessmentSaved ? "Valoració guardada" : "Guardar anàlisi"}</button></section>
          <section className={`assessment-diagnosis-report ${firstIssueGroup ? "has-issue" : "is-perfect"}`}>
            {firstIssueGroup && firstIssueOption?.diagnosis ? <>
              <header>
                <span className="eyebrow">Diagnòstic principal</span>
                <h2>Primer punt a corregir: {firstIssueGroup.title}</h2>
                <p><strong>{firstIssueOption.level}:</strong> {firstIssueOption.diagnosis.principalError} És el primer error de la cadena i pot condicionar tot el que s’executa després.</p>
              </header>
              <div className="assessment-diagnosis-grid">
                <article>
                  <span>Errors associats</span>
                  <ul>{firstIssueOption.diagnosis.associatedErrors.map((error) => <li key={error}>{error}</li>)}</ul>
                </article>
                <article>
                  <span>Conseqüència i efecte dominó</span>
                  <p>{firstIssueOption.diagnosis.consequence}</p>
                  {affectedLaterGroups.length > 0 && <p className="assessment-chain-note">Pot condicionar també: {affectedLaterGroups.map((group) => group.title).join(", ")}. Cal corregir primer l’origen abans d’interpretar aquestes parts com a problemes independents.</p>}
                </article>
                <article>
                  <span>Consell de millora</span>
                  <p>{firstIssueOption.diagnosis.improvement}</p>
                </article>
              </div>
              {selectedIssues.length > 1 && <div className="assessment-all-issues">
                <div className="assessment-all-issues-heading">
                  <span className="eyebrow">Altres errors seleccionats</span>
                  <p>Es mostren segons el nivell triat. Poden ser errors propis o conseqüències del primer error de la cadena.</p>
                </div>
                <div className="assessment-issue-list">
                  {selectedIssues.slice(1).map(({ group, option, diagnosis }) => (
                    <article key={group.key}>
                      <header><div><strong>{group.title}</strong><span>{option.level}</span></div><b>{String(option.value).replace(".", ",")} / 10</b></header>
                      <h3>{diagnosis.principalError}</h3>
                      <ul>{diagnosis.associatedErrors.map((error) => <li key={error}>{error}</li>)}</ul>
                      <p><strong>Conseqüència:</strong> {diagnosis.consequence}</p>
                      <p><strong>Millora:</strong> {diagnosis.improvement}</p>
                    </article>
                  ))}
                </div>
              </div>}
              <small>El resultat indica possibilitats tècniques, no confirma per si sol quin error s’ha produït. Contrasta’l amb l’observació del salt.</small>
            </> : <>
              <header>
                <span className="eyebrow">Execució tècnica completa</span>
                <h2>Totes les respostes han obtingut un 10</h2>
                <p>Enhorabona: segons aquesta valoració, la cursa, el ritme, l’estabilitat, la caiguda i la precisió a la taula han estat excel·lents.</p>
              </header>
            </>}
          </section>
        </>}
      </section>
    );
    if (page === "escalfament") return (
      <section className="hub-page warmup-page">
        <BackButton onClick={() => setPage("inici")} />
        <div className="hub-title-row">
          <div>
            <span className="eyebrow">Guia de preparació</span>
            <h1>Escalfament</h1>
            <p>El protocol complet de triple salt, agrupat en els sis apartats principals del document.</p>
          </div>
        </div>
        <div className="warmup-sections">
          {warmupSections.map((section) => <WarmupSectionCard section={section} key={section.number} />)}
        </div>
      </section>
    );
    if (page === "tècnica") {
      return (
        <section className="hub-page">
          <BackButton onClick={() => setPage("inici")} />
          <div className="hub-title-row">
            <div>
              <span className="eyebrow">Espai de contingut</span>
              <h1>Tècnica i Biomecànica</h1>
              <p>Coneix a fons les fases del triple salt i la biomecànica d'una execució perfecta.</p>
            </div>
          </div>

          <div className="technique-container">
            <div className="technique-intro">
              {techniqueIntro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}

              <figure className="technique-sequence animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                <img src={`${import.meta.env.BASE_URL}technique/sequence.png`} alt="Seqüència completa del triple salt" />
                <figcaption>Imatge 1: Seqüència completa del triple salt. Font pròpia.</figcaption>
              </figure>
            </div>

            <div className="technique-cards-wrapper">
              {techniqueSections.map((section, index) => (
                <article
                  key={section.id}
                  className="technique-card animate-in fade-in slide-in-from-bottom-8 duration-700"
                  style={{
                    '--card-accent': section.accentColor,
                    animationDelay: `${(index + 2) * 150}ms`
                  } as React.CSSProperties}
                >
                  <header className="technique-card-header">
                    <h2 className="technique-card-label">{section.label}</h2>
                    <div className="technique-card-subtitle">{section.pdfTitle}</div>
                  </header>
                  <div className="technique-content">
                    {section.content.map((block, bIndex) => {
                      if (block.type === 'paragraph') {
                        return <p key={bIndex} className="technique-text">{block.text}</p>;
                      } else {
                        return (
                          <figure key={bIndex} className="technique-figure">
                            <div className={`technique-figure-media ${Array.isArray(block.src) ? "is-gallery" : ""}`}>
                              {(Array.isArray(block.src) ? block.src : [block.src]).map((src) => (
                                <img src={`${import.meta.env.BASE_URL}${src}`} alt={block.caption} key={src} />
                              ))}
                            </div>
                            <figcaption>{block.caption}</figcaption>
                          </figure>
                        );
                      }
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      );
    }
    return null;
  };

  return (
    <div className="hub-shell">
         {page !== "casa" && <aside className="hub-sidebar"><div className="sidebar-brand"><div className="brand-mark">TS<br />01</div><div><div className="font-display" style={{ fontSize: "1.1rem", lineHeight: 1 }}>A peu de salt</div><div className="sidebar-label" style={{ padding: ".35rem 0 0", color: "hsl(215 14% 67%)" }}>{selectedAthlete.firstName} {selectedAthlete.lastName}</div></div></div><nav className="sidebar-nav" aria-label="Navegació principal"><div className="sidebar-label">El teu espai</div>{navItems.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}><item.icon size={16} /><span>{item.label}</span></button>)}</nav><div className="hub-user-block"><span className="athlete-avatar">{`${selectedAthlete.firstName[0]}${selectedAthlete.lastName[0]}`}</span><div><strong>{selectedAthlete.firstName} {selectedAthlete.lastName}</strong><button onClick={openAthleteSelection}><Users size={12} /> Canviar atleta</button><button onClick={logout}><LogOut size={12} /> Tancar sessió</button></div></div></aside>}
      <main className={page === "casa" ? "hub-analysis-main" : "hub-main"}>
         {page === "casa" && <div className="analysis-hub-bar"><button className="button-outline" onClick={() => setPage("inici")}><ArrowLeft size={14} /> Tornar a l’espai de temporada</button><div><span className="athlete-avatar">{`${selectedAthlete.firstName[0]}${selectedAthlete.lastName[0]}`}</span><strong>{selectedAthlete.firstName} {selectedAthlete.lastName}</strong><button className="button-quiet" onClick={openAthleteSelection}><Users size={14} /><span>Canviar atleta</span></button><button className="button-quiet" onClick={logout}><LogOut size={14} /><span>Tancar sessió</span></button></div></div>}
        {page !== "casa" && page !== "inici" && (
          <header className="hub-topbar">
            <div className="topbar-context">
               <span className="eyebrow">Atleta actual</span>
               <div className="athlete-switcher-wrap">
                   <strong>{selectedAthlete.firstName} {selectedAthlete.lastName}</strong>
               </div>
            </div>
            <div className="flex gap-2">
               <button className="button-outline" onClick={openAthleteSelection}><Users size={14} /> Canviar atleta</button>
              <button className="button-outline" onClick={() => setPage("pista")}><Activity size={14} /> Estic a pista</button>
              <button className="button-primary" onClick={() => setPage("casa")}><CircleGauge size={14} /> Estic a casa</button>
            </div>
          </header>
        )}
        {renderPage()}
      </main>
      {athleteFormOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAthleteFormOpen(false); }}>
          <form className="modal hub-athlete-modal" onSubmit={addOrEditAthlete}>
            <div className="modal-title-row">
              <div>
                <span className="eyebrow">{editingAthlete ? "Editar atleta" : "Nou atleta"}</span>
                <h2>{editingAthlete ? "Modifica la fitxa" : "Crea una fitxa"}</h2>
              </div>
              <button type="button" className="button-quiet" onClick={() => { setAthleteFormOpen(false); setEditingAthlete(null); }} aria-label="Tancar">
                <X size={15} />
              </button>
            </div>
            <div className="auth-name-grid">
              <label>Nom<input name="firstName" required autoFocus defaultValue={editingAthlete?.firstName || ""} /></label>
              <label>Cognom<input name="lastName" required defaultValue={editingAthlete?.lastName || ""} /></label>
            </div>
            <label>Objectius<input name="goals" placeholder="Opcional" defaultValue={editingAthlete?.goals || ""} /></label>
            <label>Informació tècnica<textarea name="technicalNotes" placeholder="Opcional" defaultValue={editingAthlete?.technicalNotes || ""} /></label>
            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              {editingAthlete ? (
                <button type="button" className="button-danger" onClick={() => { setAthleteToDelete(editingAthlete); setAthleteFormOpen(false); }}>
                  <Trash2 size={14} /> Esborrar
                </button>
              ) : <div />}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="button-outline" onClick={() => { setAthleteFormOpen(false); setEditingAthlete(null); }}>Cancel·lar</button>
                <button className="button-primary" type="submit"><Save size={14} /> Guardar</button>
              </div>
            </div>
          </form>
        </div>
      )}
      {athleteToDelete && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAthleteToDelete(null); }}>
          <section className="modal delete-modal" role="alertdialog">
            <span className="delete-warning-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'hsl(4 69% 47%)' }}><Trash2 size={24} /></span>
            <div>
              <span className="eyebrow">Confirmació necessària</span>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Vols esborrar a {athleteToDelete.firstName}?</h2>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>Aquesta acció esborrarà la fitxa de l'atleta. <strong>Atenció:</strong> les competicions, avaluacions i anàlisis existents no s'esborraran, però quedaran desvinculades a l'historial.</p>
            </div>
            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="button-outline" onClick={() => setAthleteToDelete(null)}>Cancel·lar</button>
              <button type="button" className="button-danger" onClick={deleteAthlete}><Trash2 size={15} /> Sí, esborrar</button>
            </div>
          </section>
        </div>
      )}
      {competitionToDelete && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompetitionToDelete(null); }}>
        <section className="modal competition-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-competition-title">
          <span className="delete-warning-icon"><Trash2 size={22} /></span>
          <div><span className="eyebrow">Confirmació necessària</span><h2 id="delete-competition-title">Vols esborrar aquesta competició?</h2><p><strong>{competitionToDelete.location}</strong> i tots els seus salts desapareixeran definitivament de l’Historial.</p></div>
          <div className="modal-actions"><button type="button" className="button-outline" onClick={() => setCompetitionToDelete(null)}>Cancel·lar</button><button type="button" className="button-danger" onClick={() => void deleteCompetition()}><Trash2 size={15} /> Sí, esborrar</button></div>
        </section>
      </div>}
      {evaluationToDelete && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEvaluationToDelete(null); }}>
        <section className="modal competition-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-evaluation-title">
          <span className="delete-warning-icon"><Trash2 size={22} /></span>
          <div><span className="eyebrow">Confirmació necessària</span><h2 id="delete-evaluation-title">Vols esborrar aquesta valoració?</h2><p>La valoració de <strong>{evaluationToDelete.location || "pista"}</strong> desapareixerà definitivament de l’Historial.</p></div>
          <div className="modal-actions"><button type="button" className="button-outline" onClick={() => setEvaluationToDelete(null)}>Cancel·lar</button><button type="button" className="button-danger" onClick={() => void deleteEvaluation()}><Trash2 size={15} /> Sí, esborrar</button></div>
        </section>
      </div>}
      {homeAnalysisToDelete && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHomeAnalysisToDelete(null); }}>
        <section className="modal competition-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-home-analysis-title">
          <span className="delete-warning-icon"><Trash2 size={22} /></span>
          <div><span className="eyebrow">Confirmació necessària</span><h2 id="delete-home-analysis-title">Vols esborrar aquesta anàlisi?</h2><p>L’anàlisi de <strong>{homeAnalysisToDelete.location}</strong> desapareixerà definitivament de l’Historial.</p></div>
          <div className="modal-actions"><button type="button" className="button-outline" onClick={() => setHomeAnalysisToDelete(null)}>Cancel·lar</button><button type="button" className="button-danger" onClick={() => void deleteHomeAnalysis()}><Trash2 size={15} /> Sí, esborrar</button></div>
        </section>
      </div>}
      {feedback && <div className="toast" role="status">{feedback}</div>}
    </div>
  );
}

export default ProductHub;