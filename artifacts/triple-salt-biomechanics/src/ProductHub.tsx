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
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  createdAt: string;
};
type AssessmentOption = { level: "Excel·lent" | "Notable" | "Satisfactori" | "Suspès"; description: string; value: 10 | 8.5 | 7 | 0; tone: "excellent" | "notable" | "satisfactory" | "failed" };
type AssessmentGroup = { key: string; title: string; subtitle: string; question: string; hint?: string; options: AssessmentOption[] };
type WarmupItem = { title?: string; description: string; note?: string };
type WarmupSubsection = { title: string; intro?: string; items: WarmupItem[] };
type WarmupSection = { number: string; title: string; intro?: string; videoSrc?: string; posterSrc?: string; imageSrc?: string; imageAlt?: string; subsections?: WarmupSubsection[]; items?: WarmupItem[] };

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
    title: "Cursa d’impuls",
    subtitle: "Progressió, ritme i control",
    question: "Com has vist la cursa d’impuls?",
    options: [
      { level: "Excel·lent", description: "Ha realitzat una cursa progressiva, ràpida i controlada. Ha mantingut un ritme constant, sense frenar abans de la taula, i ha combinat correctament l’amplitud i la freqüència de la gambada. La mirada s’ha mantingut cap a l’horitzó, els genolls s’han projectat amb energia i el peu ha entrat en contacte amb el terra de manera activa (peu «armat»).", value: 10, tone: "excellent" },
      { level: "Notable", description: "Ha fet una cursa ràpida i bastant regular, tot i presentar algun petit error de ritme, postura o coordinació. No ha perdut gaire velocitat i ha arribat a la taula amb una bona preparació general.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "Ha completat la cursa, però amb una velocitat o una regularitat millorables. Ha pogut frenar lleugerament, mirar a terra o modificar la llargada de les passes abans de la batuda. Tot i això, ha aconseguit arribar a la taula i iniciar el salt.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "Ha fet una cursa poc controlada, lenta o molt irregular. Ha frenat clarament abans de la taula, ha mirat constantment a terra, ha perdut el ritme o ha corregut amb una postura inadequada. Aquests errors han perjudicat la batuda i la continuïtat del triple salt.", value: 0, tone: "failed" },
    ],
  },
  {
    key: "takeoff",
    title: "Entrada a la taula",
    subtitle: "Precisió i batuda",
    question: "Com ha entrat a la taula de batuda?",
    options: [
      { level: "Excel·lent", description: "Ha arribat a la taula amb precisió, sense frenar ni modificar el ritme dels últims passos. Ha entrat amb el peu ben preparat, el cos alineat i els malucs avançats. La batuda ha estat ràpida, activa i dirigida principalment cap endavant.", value: 10, tone: "excellent" },
      { level: "Notable", description: "Ha entrat correctament a la taula i ha mantingut gairebé tota la velocitat. Pot haver comès algun petit error en la col·locació del peu, en la postura o en la coordinació, però sense afectar gaire el resultat de la batuda.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "Ha arribat a la taula de manera acceptable, però ha frenat lleugerament, ha allargat o escurçat l’últim pas o ha entrat amb una postura poc estable. La batuda ha estat vàlida, però ha provocat una certa pèrdua de velocitat.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "Ha entrat malament a la taula, ha frenat molt, ha trepitjat fora de la zona adequada o ha modificat clarament els últims passos. La batuda ha estat massa vertical, desequilibrada o poc coordinada, fet que ha perjudicat les fases següents.", value: 0, tone: "failed" },
    ],
  },
  {
    key: "phases",
    title: "Les tres fases",
    subtitle: "Hop, step i jump",
    question: "Com han estat els tres salts?",
    options: [
      { level: "Excel·lent", description: "Ha executat els tres salts de manera contínua, equilibrada i coordinada. El hop ha estat controlat i no excessivament vertical, l’step ha permès conservar la velocitat i el jump ha aprofitat l’impuls restant per aconseguir una bona distància. Les tres fases han estat ben connectades.", value: 10, tone: "excellent" },
      { level: "Notable", description: "Ha realitzat correctament els tres salts, amb una bona continuïtat general. Pot haver-hi una petita pèrdua de velocitat o algun desequilibri en una de les fases, però el conjunt ha estat efectiu i tècnicament adequat.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "Ha completat les tres fases, però una d’elles ha estat clarament més dèbil. Pot haver fet un hop massa alt, un step massa curt o un jump amb poca velocitat. Tot i això, ha aconseguit mantenir una certa continuïtat i completar el salt.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "No ha aconseguit connectar correctament les tres fases. Ha perdut molt l’equilibri, ha fet un dels salts excessivament vertical, ha reduït molt la velocitat o ha interromput el moviment entre fases. El conjunt no ha estat fluid ni eficaç.", value: 0, tone: "failed" },
    ],
  },
  {
    key: "landing",
    title: "Caiguda al fossat",
    subtitle: "Projecció i aprofitament",
    question: "Com ha acabat el salt al fossat?",
    options: [
      { level: "Excel·lent", description: "Ha projectat les cames cap endavant en el moment adequat i ha entrat a la sorra amb control. Després del contacte, ha flexionat les cames i ha portat el cos cap endavant per evitar deixar una marca enrere. Ha aprofitat molt bé la distància aconseguida durant el vol.", value: 10, tone: "excellent" },
      { level: "Notable", description: "Ha fet una bona caiguda, amb les cames prou projectades i sense caure clarament cap enrere. Pot haver perdut uns centímetres per una petita falta de coordinació, però ha acabat el salt de manera correcta.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "Ha caigut de manera acceptable, però ha projectat poc les cames, les ha mantingut massa rígides o ha tingut una certa dificultat per portar el cos cap endavant després del contacte.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "Ha caigut cap enrere, ha deixat una marca amb les mans o els malucs darrere dels peus, no ha projectat les cames o ha entrat a la sorra de manera molt descontrolada. Això ha reduït clarament la distància final del salt.", value: 0, tone: "failed" },
    ],
  },
  {
    key: "posture",
    title: "Posició corporal",
    subtitle: "Alineació i estabilitat",
    question: "Com ha estat la seva posició corporal?",
    options: [
      { level: "Excel·lent", description: "Ha mantingut una postura estable i alineada durant tota la prova. El tronc ha estat controlat, els malucs s’han mantingut avançats, el cap ha mirat cap endavant i els braços i les cames han treballat de manera coordinada.", value: 10, tone: "excellent" },
      { level: "Notable", description: "Ha mantingut una bona posició corporal en la major part del salt. Pot haver presentat alguna inclinació o rotació puntual, però no ha afectat gaire la continuïtat ni l’eficàcia del moviment.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "La posició corporal ha estat irregular. En alguns moments ha inclinat massa el tronc, ha endarrerit els malucs o ha perdut l’alineació, però ha pogut completar el triple salt.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "Ha mantingut una postura molt descontrolada, amb el tronc excessivament inclinat, els malucs endarrerits o una rotació important del cos. Aquesta mala posició ha afectat la batuda, els contactes i la caiguda.", value: 0, tone: "failed" },
    ],
  },
  {
    key: "contacts",
    title: "Resposta als contactes",
    subtitle: "Rigidesa activa i continuïtat",
    question: "S’enfonsa massa durant els contactes i les caigudes?",
    options: [
      { level: "Excel·lent", description: "No s’enfonsa excessivament en els contactes. La cama de suport absorbeix l’impacte de manera controlada i els malucs continuen avançant. Manté una bona rigidesa activa sense bloquejar la cama i aconsegueix continuar el moviment cap endavant.", value: 10, tone: "excellent" },
      { level: "Notable", description: "Presenta una bona resposta en els contactes, tot i que pot enfonsar-se lleugerament en alguna fase. La pèrdua de velocitat és reduïda i aconsegueix continuar el salt amb una tècnica adequada.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "S’enfonsa de manera visible en un o més contactes. Això provoca una certa pèrdua de velocitat i fa que la transició entre fases sigui menys fluida, però encara pot completar el salt.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "S’enfonsa molt en els contactes, especialment en l’step, i no aconsegueix transformar correctament l’impacte en un nou impuls. Perd molta velocitat, queda assegut sobre la cama de suport o interromp la continuïtat del triple salt.", value: 0, tone: "failed" },
    ],
  },
  {
    key: "rhythm",
    title: "Ritme global",
    subtitle: "Continuïtat entre fases",
    question: "El ritme de tot el salt és «ta-ta-ta-ta»?",
    hint: "Escolta la continuïtat entre la batuda, el hop, l’step i el jump.",
    options: [
      { level: "Excel·lent", description: "El salt presenta un ritme continu, fluid i ben coordinat: «ta-ta-ta-ta». No hi ha pauses ni frenades entre la batuda, el hop, l’step i el jump. Les fases estan connectades i el moviment sembla natural i controlat.", value: 10, tone: "excellent" },
      { level: "Notable", description: "El ritme és bastant fluid i només presenta una petita interrupció o una lleugera pèrdua de continuïtat. En general, les fases estan ben connectades i l’atleta manté una bona velocitat.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "El ritme és irregular. Hi ha alguna pausa, contacte massa llarg o canvi brusc entre fases. Tot i això, l’atleta aconsegueix completar la seqüència del triple salt.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "El ritme és molt trencat i no es percep una continuïtat entre les fases. Hi ha frenades, contactes excessivament llargs, desequilibris o pauses que interrompen clarament el moviment.", value: 0, tone: "failed" },
    ],
  },
  {
    key: "coordination",
    title: "Velocitat i coordinació",
    subtitle: "Conservació de l’impuls",
    question: "Ha mantingut la velocitat durant les tres fases?",
    options: [
      { level: "Excel·lent", description: "Ha conservat molt bé la velocitat horitzontal des de la batuda fins al jump. No ha fet salts excessivament verticals ni contactes que provoquessin una frenada important. Ha distribuït l’esforç de manera equilibrada entre les tres fases.", value: 10, tone: "excellent" },
      { level: "Notable", description: "Ha mantingut una bona part de la velocitat, tot i perdre’n una mica en algun contacte. Aquesta pèrdua no ha afectat greument la distància final ni la continuïtat del salt.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "Ha perdut una quantitat visible de velocitat en una de les fases, sobretot en l’step o en la recepció del hop. Tot i això, ha pogut continuar i completar el jump.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "Ha perdut molta velocitat durant les fases, especialment per una batuda vertical, un contacte rígid, un enfonsament excessiu o un desequilibri. Aquesta pèrdua ha reduït clarament la distància dels salts posteriors.", value: 0, tone: "failed" },
    ],
  },
  {
    key: "arms",
    title: "Coordinació segmentària",
    subtitle: "Braços i cames",
    question: "Com ha estat la coordinació entre braços i cames?",
    options: [
      { level: "Excel·lent", description: "Els braços i les cames han treballat de manera coordinada durant la cursa, la batuda, els tres salts i la caiguda. Els braços han ajudat a projectar els genolls, mantenir l’equilibri i preparar els contactes sense moviments innecessaris.", value: 10, tone: "excellent" },
      { level: "Notable", description: "La coordinació ha estat bona en general, tot i presentar algun petit desajust en una de les fases. Els braços han contribuït al moviment i no han provocat desequilibris importants.", value: 8.5, tone: "notable" },
      { level: "Satisfactori", description: "La coordinació ha estat irregular. En alguns moments els braços s’han mogut tard, han quedat enrere o no han acompanyat prou les cames. Tot i això, l’atleta ha pogut completar el salt.", value: 7, tone: "satisfactory" },
      { level: "Suspès", description: "Hi ha hagut una descoordinació clara entre braços, cames i tronc. Els moviments han estat rígids o desordenats i han provocat pèrdua d’equilibri, de velocitat o de control durant les fases.", value: 0, tone: "failed" },
    ],
  },
];

const validityOptions = [
  {
    key: "valid",
    level: "Intent vàlid",
    description: "Respecta la línia de batuda i executa correctament les tres fases del triple salt.",
    improvement: "Mantén aquesta precisió a la taula sense reduir la velocitat dels últims passos.",
  },
  {
    key: "far",
    level: "Vàlid, però lluny de la taula",
    description: "L’intent és vàlid, però la distància fins a la taula ha repercutit en el resultat dels tres salts.",
    improvement: "Ajusta la talonació i conserva el ritme de cursa per arribar més a prop de la taula sense allargar ni escurçar els últims passos.",
  },
  {
    key: "foul",
    level: "Intent nul",
    description: "Trepitja o supera la línia de batuda, fa una batuda incorrecta o incompleix alguna norma bàsica del triple salt.",
    improvement: "Revisa la talonació i el punt d’inici de la cursa. Prioritza una entrada natural i controlada, sense buscar la taula amb els últims passos.",
  },
] as const;

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
            <video src={section.videoSrc} poster={section.posterSrc} controls preload="metadata" playsInline className="exercise-video" />
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
  const [validityAnswer, setValidityAnswer] = useState<number | null>(null);
  const [assessmentSaved, setAssessmentSaved] = useState(false);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [competitionToDelete, setCompetitionToDelete] = useState<Competition | null>(null);

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
      await loadData();
      setSelectedCompetitionId(result.competition.id);
      if (result.competition.athleteId) setSelectedAthleteId(result.competition.athleteId);
      notify("Competició actualitzada correctament.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No s’ha pogut actualitzar la competició.");
    }
  };

  const openCompetition = async (competition: Competition) => {
    try {
      const result = await api<{ competition: Competition }>(`/competitions/${competition.id}`);
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

  const selectedAssessment = assessmentGroups.map((group) => group.options[assessmentAnswers[group.key] ?? -1]);
  const selectedValidity = validityAnswer === null ? null : validityOptions[validityAnswer];
  const assessmentComplete = selectedAssessment.every(Boolean) && Boolean(selectedValidity);
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
          criteria: assessmentGroups.map((group, index) => ({
            key: group.key,
            question: group.question,
            level: selectedAssessment[index].level,
            criterion: selectedAssessment[index].description,
            score: selectedAssessment[index].value,
          })),
          validity: selectedValidity,
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
  const competitionProgressData = useMemo<CompetitionProgressPoint[]>(() => (
    [...athleteCompetitions]
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
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
          {competitionProgressData.length > 0 && (
            <section className="competition-progress-card">
              <div className="competition-progress-heading">
                <div><span className="eyebrow">Evolució de marques</span><h2>Progrés per competició</h2><p>Millor marca vàlida aconseguida entre els salts registrats a cada competició.</p></div>
                <div className="progress-legend"><span /><strong>Millor marca (m)</strong></div>
              </div>
              <div className="competition-chart-scroll">
                <div style={{ width: `${Math.max(720, competitionProgressData.length * 165)}px` }}>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={competitionProgressData} margin={{ top: 32, right: 24, left: 0, bottom: 58 }} accessibilityLayer>
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
                      <Bar dataKey="bestMark" fill="hsl(var(--primary))" maxBarSize={62} radius={[8, 8, 2, 2]}>
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
          {selectedAthlete && <div className="athlete-history-grid">
            <article className="athlete-profile-card">
              <div className="profile-heading"><span className="athlete-avatar large">{`${selectedAthlete.firstName[0]}${selectedAthlete.lastName[0]}`}</span><div><span className="eyebrow">Fitxa d’atleta</span><h2>{selectedAthlete.firstName} {selectedAthlete.lastName}</h2></div></div>
              <div className="profile-fields"><div><span>Millor marca registrada</span><strong>{athleteRecordedBest === null ? "Encara no disponible" : `${athleteRecordedBest.toFixed(2).replace(".", ",")} m`}</strong></div><div><span>Objectius</span><strong>{selectedAthlete.goals || "Encara no definits"}</strong></div><div><span>Informació tècnica</span><strong>{selectedAthlete.technicalNotes || "Preparada per afegir-hi contingut"}</strong></div><div><span>Valoracions de pista</span><strong>{athleteEvaluations.length ? `${athleteEvaluations.length} registrada${athleteEvaluations.length > 1 ? "s" : ""}` : "Encara no disponibles"}</strong></div></div>
            </article>
            <article className="history-competitions">
              <div className="section-card-heading"><div><span className="eyebrow">Competicions</span><h2>Últims registres</h2></div><button className="button-outline" onClick={() => setPage("competició")}>Nova</button></div>
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
              {athleteEvaluations.length > 0 && <div className="track-history"><span className="eyebrow">Valoracions de pista</span>{athleteEvaluations.map((evaluation) => <div key={evaluation.id}><span>{new Date(evaluation.createdAt).toLocaleDateString("ca-ES")}</span><strong>{Number(evaluation.finalScore ?? ((Number(evaluation.approachScore) + Number(evaluation.rhythmScore) + Number(evaluation.landingScore)) / 3)).toFixed(1).replace(".", ",")} / 10</strong></div>)}</div>}
            </article>
          </div>}
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
      <section className="hub-page track-assessment-page">
        <BackButton onClick={() => setPage("inici")} />
        <div className="hub-title-row"><div><span className="eyebrow">Anàlisi immediata del salt</span><h1>Estic a pista</h1><p>Valora cada aspecte observat i obtén una nota tècnica clara del salt.</p></div>{athletes.length > 0 && <label className="compact-select">Atleta<select value={selectedAthleteId} onChange={(event) => setSelectedAthleteId(event.target.value)}>{athletes.map((athlete) => <option value={athlete.id} key={athlete.id}>{athlete.firstName} {athlete.lastName}</option>)}</select></label>}</div>
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
            <div><span>Progrés</span><strong>{selectedAssessment.filter(Boolean).length + (selectedValidity ? 1 : 0)} / {assessmentGroups.length + 1}</strong></div>
            <div className="assessment-progress-track"><span style={{ width: `${((selectedAssessment.filter(Boolean).length + (selectedValidity ? 1 : 0)) / (assessmentGroups.length + 1)) * 100}%` }} /></div>
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
          <article className="assessment-card validity-card">
            <div className="assessment-heading"><span>{String(assessmentGroups.length + 1).padStart(2, "0")}</span><div><h2>Arribada a taula i intent</h2><p>Validesa reglamentària</p></div></div>
            <div className="assessment-unscored-note"><strong>No modifica la nota final</strong><span>Aquesta resposta només genera una indicació de millora.</span></div>
            <h3>L’intent és vàlid o nul?</h3>
            <div className="validity-options">
              {validityOptions.map((option, index) => (
                <button type="button" className={validityAnswer === index ? "selected" : ""} onClick={() => { setValidityAnswer(index); setAssessmentSaved(false); }} key={option.key}>
                  <span><strong>{option.level}</strong><small>{option.description}</small></span>
                  {validityAnswer === index && <Check size={18} />}
                </button>
              ))}
            </div>
            {selectedValidity && <div className="validity-improvement"><span>Millora proposada</span><p>{selectedValidity.improvement}</p></div>}
          </article>
        </div>
        {assessmentComplete && <section className="assessment-result"><div><span className="eyebrow">Nota final del salt</span><h2>{assessmentAverage?.toFixed(1).replace(".", ",")} / 10</h2><p>Mitjana dels {assessmentGroups.length} criteris tècnics. La validesa de l’intent no forma part de la puntuació.</p>{selectedValidity && <div className="assessment-result-improvement"><strong>Millora prioritària</strong><span>{selectedValidity.improvement}</span></div>}</div><button className="button-primary" onClick={saveAssessment} disabled={assessmentSaved}><Check size={16} /> {assessmentSaved ? "Valoració guardada" : "Guardar anàlisi"}</button></section>}
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
      const blocks = ["Cursa d’aproximació", "Entrada a la taula", "Hop", "Step", "Jump", "Caiguda", "Errors habituals", "Correccions"];
      return <section className="hub-page"><BackButton onClick={() => setPage("inici")} /><div className="hub-title-row"><div><span className="eyebrow">Espai de contingut</span><h1>Tècnica</h1><p>Prepara explicacions, vídeos, imatges i exercicis per a cada fase del triple salt.</p></div></div><div className="content-placeholder-grid">{blocks.map((block) => <article key={block} className="content-placeholder"><span className="placeholder-icon"><BookOpen size={19} /></span><h2>{block}</h2><p>Aquí apareixerà el contingut quan l’afegeixis.</p><div><span>Text</span><span>Vídeo</span><span>Imatges</span></div></article>)}</div></section>;
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
      {competitionToDelete && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompetitionToDelete(null); }}>
        <section className="modal competition-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-competition-title">
          <span className="delete-warning-icon"><Trash2 size={22} /></span>
          <div><span className="eyebrow">Confirmació necessària</span><h2 id="delete-competition-title">Vols esborrar aquesta competició?</h2><p><strong>{competitionToDelete.location}</strong> i tots els seus salts desapareixeran definitivament de l’Historial.</p></div>
          <div className="modal-actions"><button type="button" className="button-outline" onClick={() => setCompetitionToDelete(null)}>Cancel·lar</button><button type="button" className="button-danger" onClick={() => void deleteCompetition()}><Trash2 size={15} /> Sí, esborrar</button></div>
        </section>
      </div>}
      {feedback && <div className="toast" role="status">{feedback}</div>}
    </div>
  );
}

export default ProductHub;