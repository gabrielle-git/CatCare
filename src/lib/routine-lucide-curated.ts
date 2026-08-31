import { icons } from "lucide-react";
import { pascalToKebab } from "@/lib/routine-icons";

/** Ícones exibidos na grade inicial — contexto pets/cuidados/rotina. */
const CURATED_RAW = [
  // Cuidados & pets
  "heart", "heart-pulse", "heart-handshake", "paw-print", "cat", "dog", "fish", "bird", "rabbit", "squirrel", "turtle", "bone",
  // Saúde
  "stethoscope", "pill", "syringe", "bandage", "cross", "hospital", "activity", "thermometer", "thermometer-sun",
  // Higiene
  "bath", "shower-head", "droplets", "droplet", "brush", "scissors", "sparkles", "hand", "hands", "hand-heart",
  // Alimentação
  "utensils", "utensils-crossed", "apple", "carrot", "milk", "coffee", "cookie", "egg", "salad", "beef", "candy",
  // Casa
  "home", "house", "sofa", "bed", "lamp", "door-open", "armchair",
  // Natureza
  "leaf", "tree-pine", "tree-deciduous", "flower", "flower-2", "clover", "sprout", "sun", "cloud", "cloud-sun", "mountain", "shell",
  // Afeto
  "gift", "party-popper", "smile", "smile-plus", "baby",
  // Tempo & rotina
  "clock", "clock-3", "alarm-clock", "timer", "calendar", "calendar-days", "calendar-check", "calendar-heart", "repeat", "refresh-cw", "list-checks",
  // Céu & símbolos
  "moon", "moon-star", "star", "stars", "rainbow", "cloud-moon", "cloud-rain", "sunrise", "sunset",
  // Outros úteis
  "eye", "ear", "feather", "bell", "bookmark", "clipboard-list", "notebook-pen", "camera", "image", "image-plus",
  "umbrella", "wind", "snowflake", "flame", "footprints", "bee", "bug", "butterfly", "worm", "snail", "duck", "rat",
  "notebook", "pen-line", "sticky-note", "check-circle", "circle-check", "shield", "shield-heart", "life-buoy",
];

const ALL_KEBAB = Object.keys(icons).map(pascalToKebab);

const BLOCKED_PREFIXES = [
  "arrow", "chevron", "circle-arrow", "square-arrow", "a-arrow", "bitcoin", "bluetooth", "wifi", "ethernet",
  "server", "database", "terminal", "git-", "github", "gitlab", "cpu", "hard-drive", "usb", "keyboard", "mouse",
  "monitor", "laptop", "smartphone", "tablet", "volume", "play", "pause", "skip", "rewind", "fast-forward",
  "upload", "download", "share", "external-link", "layout", "grid", "columns", "rows", "sidebar", "panel-",
  "align-", "justify-", "between-", "text-align", "bold", "italic", "underline", "type", "hash", "at-sign", "percent",
  "dollar", "euro", "credit-card", "wallet", "banknote", "chart", "trending", "analytics", "calculator", "binary",
  "bot", "circuit", "antenna", "radio", "satellite", "nfc", "qr-code", "barcode", "scan-line", "fingerprint",
  "accessibility", "square-", "rectangle-", "move-", "maximize", "minimize", "zoom-", "crop", "rotate-", "flip-",
  "undo", "redo", "folder", "file-", "paperclip", "link-", "unlink", "anchor", "code", "codepen", "command",
  "option", "control", "delete", "backspace", "power", "battery", "plug", "magnet", "flask-conical", "test-tube",
  "microscope", "dna", "atom", "sigma", "equal", "plus", "minus", "divide", "multiply", "parentheses", "brackets",
  "braces", "chess-", "list-start", "list-restart", "list-end", "list-todo",
];

/** Segmentos kebab que indicam ícone útil no contexto do produto. */
const RELEVANCE_SEGMENTS = new Set([
  "heart", "paw", "print", "pet", "cat", "dog", "fish", "bird", "rabbit", "bath", "brush", "scissor", "scissors",
  "droplet", "droplets", "drop", "water", "soap", "clean", "wash", "sparkle", "sparkles", "star", "stars", "moon",
  "sun", "cloud", "rainbow", "leaf", "tree", "flower", "plant", "grass", "home", "house", "bed", "sofa", "lamp",
  "food", "apple", "carrot", "milk", "bottle", "bowl", "utensil", "utensils", "cookie", "egg", "salad", "coffee",
  "clock", "calendar", "alarm", "timer", "repeat", "refresh", "gift", "smile", "camera", "photo", "image", "bookmark",
  "clipboard", "list", "check", "checks", "note", "book", "feather", "wind", "snow", "snowflake", "umbrella", "care",
  "love", "baby", "feed", "meal", "snack", "tooth", "nail", "cut", "groom", "comb", "pill", "medic", "syringe",
  "bandage", "hospital", "stethoscope", "thermometer", "activity", "eye", "ear", "hand", "hands", "vet", "health",
  "shell", "bone", "footprint", "footprints", "bee", "bug", "butterfly", "worm", "snail", "duck", "whale", "turtle",
  "squirrel", "mountain", "beach", "flame", "shield", "bell", "party", "clover", "sprout", "seedling", "armchair",
  "door", "notebook", "pen", "sticky", "buoy", "cross", "shower", "head", "sunrise", "sunset", "rain", "rat",
  "beef", "candy", "armchair", "open", "pulse", "handshake", "popper", "plus", "deciduous", "pine", "worm", "life",
]);

function isBlocked(name: string) {
  return BLOCKED_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function exists(name: string) {
  return ALL_KEBAB.includes(name);
}

function segments(name: string) {
  return name.split("-");
}

function isRelevant(name: string) {
  return segments(name).some((segment) => RELEVANCE_SEGMENTS.has(segment));
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/** Evita falsos positivos como "star" dentro de "start" ou "paw" dentro de "pawn". */
function iconMatchesQuery(name: string, q: string) {
  const n = name.toLowerCase();

  if (n === q || n.startsWith(`${q}-`) || n.endsWith(`-${q}`) || n.includes(`-${q}-`)) {
    return true;
  }

  const segs = segments(n);
  const segmentHit = segs.some((seg) => seg === q || (q.length >= 2 && seg.startsWith(q)));
  if (segmentHit) {
    if (q === "paw" && segs.includes("pawn") && !segs.includes("paw")) return false;
    if (q.length <= 4 && "start".startsWith(q) && q !== "star" && segs.some((seg) => seg.startsWith("start") && !seg.includes("star"))) {
      return false;
    }
    return true;
  }

  if (q.length >= 3 && n.includes(q)) {
    if (q === "star" && n.includes("start") && !n.includes("star")) return false;
    if (q === "paw" && n.includes("pawn") && !n.includes("paw")) return false;
    return true;
  }

  return false;
}

export const ROUTINE_LUCIDE_CURATED = CURATED_RAW.filter(exists);

const SEARCHABLE_EXTRA = ALL_KEBAB.filter(
  (name) => !isBlocked(name) && isRelevant(name),
);

export const ROUTINE_LUCIDE_SEARCHABLE = [...new Set([...ROUTINE_LUCIDE_CURATED, ...SEARCHABLE_EXTRA])].sort();

export function searchCuratedLucideIcons(query: string) {
  const q = normalizeQuery(query);
  if (!q) return ROUTINE_LUCIDE_CURATED;
  return ROUTINE_LUCIDE_SEARCHABLE.filter((name) => iconMatchesQuery(name, q));
}
