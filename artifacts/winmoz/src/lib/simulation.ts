/**
 * MOZBET Simulation Engine
 * Central source of truth for all synthetic/live-feeling data.
 * All time-based logic uses Mozambique time (UTC+2).
 */

// ─── Time utilities ────────────────────────────────────────────────────────────

export function getMozDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + 2 * 60 * 60 * 1000);
}

export function getMozHour(): number {
  return getMozDate().getUTCHours();
}

// ─── Player count (time-slot aware) ──────────────────────────────────────────

type TimeSlot = "dawn" | "morning" | "peak" | "night";

function getTimeSlot(): TimeSlot {
  const h = getMozHour();
  if (h >= 5 && h < 10)  return "morning";
  if (h >= 10 && h < 17) return "morning"; // extend morning
  if (h >= 10 && h < 22) return "peak";
  return "night";
}

function getSlotRange(): [number, number] {
  const h = getMozHour();
  if (h >= 5  && h < 10) return [40, 152];
  if (h >= 10 && h < 17) return [150, 270];
  if (h >= 17 && h < 22) return [150, 500];
  return [10, 100]; // 22h–05h
}

/**
 * Returns a stable-ish player count for a given game that drifts slowly
 * based on a monotonic "tick" value (increment every ~15-30s in your component).
 * gameIndex offsets each game so they don't all move in lockstep.
 */
export function getLivePlayerCount(gameIndex: number, tick: number): number {
  const [min, max] = getSlotRange();
  const range = max - min;
  // Two sine waves with different periods create a natural-looking fluctuation
  const slow = Math.sin((tick + gameIndex * 137) * 0.07) * 0.5 + 0.5;
  const fast = Math.sin((tick + gameIndex * 53)  * 0.23) * 0.12;
  const raw  = min + range * Math.max(0, Math.min(1, slow + fast));
  return Math.round(raw);
}

export function formatPlayerCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".", ",") + "K";
  return String(n);
}

// ─── Mozambican name pool ─────────────────────────────────────────────────────

const FIRST_M = [
  "Adão","Alberto","Alfredo","Américo","André","António","Armando","Arnaldo",
  "Benedito","Bruno","Carlos","Celso","César","Constantino","Custódio","Daniel",
  "Domingos","Eduardo","Emanuel","Ernesto","Estêvão","Eugênio","Fausto","Feliciano",
  "Fernando","Filipe","Francisco","Gilberto","Gonçalo","Hélder","Horácio","Hugo",
  "Isaque","Jerónimo","João","Joaquim","Jorge","José","Júlio","Lázaro","Leandro",
  "Leonardo","Lourenço","Lúcio","Luís","Manuel","Marcelo","Marco","Mário","Miguel",
  "Nelson","Nuno","Orlando","Osvaldo","Paulo","Pedro","Rafael","Raul","Ricardo",
  "Roberto","Rodrigo","Rui","Sandro","Sérgio","Silvério","Simão","Tiago","Tomás",
  "Válter","Vasco","Vicente","Virgílio","Zacarias",
];
const FIRST_F = [
  "Albertina","Alice","Alina","Amanda","Amélia","Ana","Beatriz","Bruna","Carla",
  "Carolina","Catarina","Cecília","Celina","Célia","Clara","Clotilde","Conceição",
  "Cristina","Diana","Dulce","Edna","Elisa","Elisabete","Elvira","Eva","Fátima",
  "Felicidade","Fernanda","Filomena","Florência","Graça","Helena","Inês","Isabel",
  "Jacinta","Joana","Júlia","Laura","Lena","Leocádia","Leonor","Lúcia","Luísa",
  "Lurdes","Madalena","Marcelina","Margarida","Maria","Mariana","Marta","Natália",
  "Noémia","Olívia","Palmira","Patrícia","Paula","Perpétua","Rosa","Sandra","Sílvia",
  "Sofia","Susana","Teresa","Vanessa","Vera","Vitória","Yolanda","Zelda",
];
const SURNAMES = [
  "Abreu","Agostinho","Alves","Armando","Bila","Buque","Cau","Chaúque","Chimoio",
  "Chissano","Chivambo","Cossa","Cumbe","Dlamini","Dos Santos","Duarte","Ferreira",
  "Fonseca","Fumo","Guambe","Guimarães","Inguane","Jaime","Langa","Lemos","Lobão",
  "Macamo","Machava","Machiana","Macuacua","Macuénia","Maculuve","Madeira","Maia",
  "Malate","Maluana","Manhique","Mapanga","Maposse","Massango","Matsinhe","Mavie",
  "Mbanze","Melo","Mondlane","Morais","Mosca","Mouzinho","Muchanga","Muianga",
  "Mulungo","Munguambe","Muzunguri","Nhalivilo","Nhamposse","Nhantumbo","Nhavene",
  "Nuvunga","Oliveira","Penicela","Pereira","Pires","Rodrigues","Santos","Sibanda",
  "Silva","Sitoe","Sotomayor","Tembe","Tinga","Ubisse","Uamusse","Valente","Vilanculo",
  "Vundla","Zavala",
];

/** Deterministic pick from array using integer seed */
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export interface SyntheticUser {
  name: string;
  initials: string;
  bg: string;
}

const GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-indigo-700",
  "from-emerald-500 to-teal-700",
  "from-orange-500 to-red-600",
  "from-pink-500 to-rose-700",
  "from-amber-500 to-yellow-600",
  "from-cyan-500 to-blue-600",
  "from-lime-500 to-green-700",
  "from-fuchsia-500 to-pink-700",
  "from-sky-500 to-cyan-700",
  "from-teal-500 to-emerald-700",
  "from-red-500 to-rose-700",
];

export function getSyntheticUser(seed: number): SyntheticUser {
  const isFemale = seed % 3 === 0;
  const first    = isFemale ? pick(FIRST_F, seed >> 2) : pick(FIRST_M, seed >> 2);
  const last     = pick(SURNAMES, (seed >> 3) + 7);
  const name     = `${first} ${last}`;
  const initials = `${first[0]}${last[0]}`;
  const bg       = pick(GRADIENTS, seed + 5);
  return { name, initials, bg };
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

/** Tiered amount distribution: small amounts common, large amounts rare */
export function generateWithdrawalAmount(rng: () => number): number {
  const r = rng();
  if (r < 0.32) {
    // Very common: 20–60 MT
    const pool = [20, 25, 30, 30, 35, 40, 40, 45, 50, 50, 55, 60];
    return pick(pool, Math.floor(rng() * pool.length));
  }
  if (r < 0.55) {
    // Common: 70–180 MT
    const pool = [70, 80, 90, 100, 100, 120, 130, 150, 150, 170, 180];
    return pick(pool, Math.floor(rng() * pool.length));
  }
  if (r < 0.75) {
    // Uncommon: 200–350 MT
    const pool = [200, 200, 220, 250, 280, 300, 350];
    return pick(pool, Math.floor(rng() * pool.length));
  }
  if (r < 0.90) {
    // Rare: 400–800 MT
    const pool = [400, 450, 500, 600, 700, 800];
    return pick(pool, Math.floor(rng() * pool.length));
  }
  // Very rare: 1 000+ MT
  const pool = [1000, 1200, 1500, 2000, 3000];
  return pick(pool, Math.floor(rng() * pool.length));
}

/** ms between withdrawal feed updates, time-aware */
export function getWithdrawalInterval(): number {
  const h = getMozHour();
  // Night hours: very infrequent
  if (h >= 22 || h < 5)  return 18 * 60_000 + Math.random() * 12 * 60_000; // 18–30 min
  // Early morning / late evening
  if (h < 7 || h >= 20)  return 8 * 60_000  + Math.random() * 7 * 60_000;  // 8–15 min
  // Normal hours
  return 4 * 60_000 + Math.random() * 6 * 60_000; // 4–10 min
}

/** Whether to immediately update on mount (skip if it's night hours) */
export function shouldBootWithdrawal(): boolean {
  const h = getMozHour();
  return !(h >= 22 || h < 5);
}

export function formatWithdrawalAmount(mt: number): string {
  return mt.toLocaleString("pt-PT") + " MT";
}

// ─── Live match simulation ────────────────────────────────────────────────────

export type GameType = "damas" | "ludo" | "xadrez";

export interface SimMatch {
  id: string;
  game: GameType;
  gameName: string;
  player1: string;
  player2: string;
  bet: string;
  status: "AO VIVO";
  color: string;
  initials: string;
  image: string | null;
  /** Unix ms when this match ends */
  endsAt: number;
}

const GAME_META: Record<GameType, {
  name: string; color: string; initials: string; image: string | null;
  minMs: number; maxMs: number;
}> = {
  damas:  { name:"Damas Clássico",  color:"from-blue-500 to-indigo-700",   initials:"DA", image:"/damas-card.jpg",   minMs:8*60_000,  maxMs:15*60_000  },
  xadrez: { name:"Xadrez Rápido",   color:"from-violet-500 to-purple-800", initials:"XA", image:"/xadrez-card.jpg",  minMs:8*60_000,  maxMs:15*60_000  },
  ludo:   { name:"Ludo Turbo",      color:"from-emerald-500 to-teal-700",  initials:"LU", image:"/ludo-card2.png",   minMs:15*60_000, maxMs:25*60_000  },
};

const BET_POOL = [
  "50 MT","100 MT","150 MT","200 MT","250 MT","300 MT","400 MT","500 MT",
  "750 MT","1.000 MT","1.500 MT","2.000 MT","3.000 MT",
];

/** Simple seeded-ish RNG using xorshift32 — deterministic for same seed */
function xor(s: number): () => number {
  let state = s >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

/**
 * Generate a pool of N matches. Matches have an `endsAt` timestamp so the
 * caller can rotate them when they expire.
 * `epoch` is used as a seed so the pool regenerates deterministically when
 * called again (e.g. on a 30-second interval).
 */
export function generateMatchPool(count: number, epoch: number): SimMatch[] {
  const rng   = xor(epoch);
  const games: GameType[] = ["damas", "xadrez", "ludo"];
  const usedNames = new Set<string>();
  const now = Date.now();
  const matches: SimMatch[] = [];

  for (let i = 0; i < count; i++) {
    const seed1 = Math.floor(rng() * 100_000);
    const seed2 = Math.floor(rng() * 100_000) + 50_000;
    let u1 = getSyntheticUser(seed1);
    let u2 = getSyntheticUser(seed2);

    // Ensure no player appears in two simultaneous matches
    let attempts = 0;
    while ((usedNames.has(u1.name) || u1.name === u2.name) && attempts < 20) {
      u1 = getSyntheticUser(seed1 + (++attempts) * 17);
    }
    attempts = 0;
    while ((usedNames.has(u2.name) || u1.name === u2.name) && attempts < 20) {
      u2 = getSyntheticUser(seed2 + (++attempts) * 13);
    }
    usedNames.add(u1.name);
    usedNames.add(u2.name);

    const gameType = games[Math.floor(rng() * games.length)];
    const meta     = GAME_META[gameType];
    const duration = meta.minMs + rng() * (meta.maxMs - meta.minMs);
    // Stagger start times so not all matches end at the same moment
    const startOffset = rng() * duration * 0.85; // started 0–85% through
    const endsAt = now + duration - startOffset;

    matches.push({
      id:       `m-${epoch}-${i}`,
      game:     gameType,
      gameName: meta.name,
      player1:  u1.name.split(" ")[0] + " " + u1.name.split(" ").slice(-1)[0][0] + ".",
      player2:  u2.name.split(" ")[0] + " " + u2.name.split(" ").slice(-1)[0][0] + ".",
      bet:      pick(BET_POOL, Math.floor(rng() * BET_POOL.length)),
      status:   "AO VIVO",
      color:    meta.color,
      initials: meta.initials,
      image:    meta.image,
      endsAt,
    });
  }
  return matches;
}

// ─── Sala / Online count ──────────────────────────────────────────────────────

/**
 * Returns the total "online now" count for the Salas screen.
 * This is the sum of all live game players × a multiplier, capped by time slot.
 * Drifts naturally using a multi-wave sine so it never looks static.
 */
export function getSalaOnlineCount(tick: number): number {
  const [min, max] = getSlotRange();
  // Base: ~1.8× the peak-slot playing count, bounded by slot
  const basePlaying =
    getLivePlayerCount(0, tick) +
    getLivePlayerCount(1, tick) +
    getLivePlayerCount(2, tick) +
    getLivePlayerCount(3, tick) +
    getLivePlayerCount(4, tick);
  // Extra "browsing" users on top of active players
  const extra = Math.round(basePlaying * 0.6 + min * 1.2);
  const total = basePlaying + extra;
  // Small noise wave so the number keeps moving
  const noise = Math.round(Math.sin((tick + 99) * 0.31) * (max * 0.05));
  return Math.max(min * 2, total + noise);
}

export function formatOnlineCount(n: number): string {
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".", ",") + "K";
  return String(n);
}

// ─── Active game persistence (back button / resume) ───────────────────────────

export const ACTIVE_GAME_KEY = "wm_active_game";

export interface ActiveGameRecord {
  gameId: string;
  gameType: "damas" | "chess" | "ludo";
  betAmount: number;
  opponentName: string;
  savedAt: number;
  /** How long (ms) after savedAt before this record expires */
  ttlMs: number;
  /** Cor/lado do jogador nesta partida (necessário para retomar sem re-debitar) */
  playerColor?: string;
  /** Nome do jogador (para a URL de retomar) */
  playerName?: string;
}

export function saveActiveGame(r: ActiveGameRecord): void {
  try { localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

export function clearActiveGame(): void {
  try { localStorage.removeItem(ACTIVE_GAME_KEY); } catch { /* ignore */ }
}

export function getActiveGame(): ActiveGameRecord | null {
  try {
    const raw = localStorage.getItem(ACTIVE_GAME_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as ActiveGameRecord;
    if (Date.now() > rec.savedAt + rec.ttlMs) { clearActiveGame(); return null; }
    return rec;
  } catch {
    return null;
  }
}
