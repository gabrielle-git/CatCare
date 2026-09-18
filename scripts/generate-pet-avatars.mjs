/**
 * Generates original CatCare builtin avatar SVGs (ASCII-only, viewBox 0 0 128 128).
 * Run: node scripts/generate-pet-avatars.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "avatars");
mkdirSync(outDir, { recursive: true });

function svg(label, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${label}">
${body}
</svg>
`;
}

function bg(fill) {
  return `  <circle cx="64" cy="64" r="64" fill="${fill}"/>`;
}

function catFace({ fur, earInner, eye, nose, stroke, stripes = "", extra = "" }) {
  return `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="34" ry="28" fill="${fur}"/>
  <path d="M28 52 L40 22 L52 52 Z" fill="${fur}"/>
  <path d="M76 52 L88 22 L100 52 Z" fill="${fur}"/>
  <path d="M34 48 L40 30 L46 48 Z" fill="${earInner}"/>
  <path d="M82 48 L88 30 L94 48 Z" fill="${earInner}"/>
${stripes}  <circle cx="50" cy="72" r="5" fill="${eye}"/>
  <circle cx="78" cy="72" r="5" fill="${eye}"/>
  <ellipse cx="64" cy="86" rx="5" ry="3.5" fill="${nose}"/>
  <path d="M64 86 Q52 94 46 90" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 86 Q76 94 82 90" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
${extra}`;
}

function dogFace({ fur, ear, eye, nose, stroke, snout = "", extra = "" }) {
  return `${bg("#F3E6D4")}
  <ellipse cx="64" cy="78" rx="30" ry="28" fill="${fur}"/>
  <ellipse cx="38" cy="62" rx="11" ry="20" fill="${ear}"/>
  <ellipse cx="90" cy="62" rx="11" ry="20" fill="${ear}"/>
${snout}  <circle cx="50" cy="74" r="5" fill="${eye}"/>
  <circle cx="78" cy="74" r="5" fill="${eye}"/>
  <ellipse cx="64" cy="88" rx="7" ry="5" fill="${nose}"/>
  <path d="M64 90 Q54 100 48 96" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 90 Q74 100 80 96" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
${extra}`;
}

const avatars = {
  "cat-cream": svg("Cat cream", catFace({ fur: "#E8D2B5", earInner: "#F6C1B0", eye: "#3D3344", nose: "#E89A8A", stroke: "#3D3344" })),
  "cat-orange": svg(
    "Cat orange",
    catFace({
      fur: "#E89A4A",
      earInner: "#F0B27A",
      eye: "#3D3344",
      nose: "#D76B5A",
      stroke: "#3D3344",
      stripes: `  <path d="M48 58 Q64 66 80 58" fill="none" stroke="#C56F2A" stroke-width="3" stroke-linecap="round"/>
`,
    }),
  ),
  "cat-black": svg("Cat black", catFace({ fur: "#3D3344", earInner: "#6B5B7A", eye: "#F5C84C", nose: "#E89A8A", stroke: "#F5EDE6" })),
  "cat-gray": svg("Cat gray", catFace({ fur: "#9A93A6", earInner: "#B7B0C2", eye: "#3D3344", nose: "#E89A8A", stroke: "#3D3344" })),
  "cat-white": svg("Cat white", catFace({ fur: "#F7F4FB", earInner: "#F6C1B0", eye: "#3D3344", nose: "#E89A8A", stroke: "#3D3344" })),
  "cat-tabby": svg(
    "Cat tabby",
    catFace({
      fur: "#C4A574",
      earInner: "#E8C9A0",
      eye: "#3D3344",
      nose: "#E89A8A",
      stroke: "#3D3344",
      stripes: `  <path d="M44 58 L48 88" stroke="#8B6B3E" stroke-width="3" stroke-linecap="round"/>
  <path d="M58 56 L60 90" stroke="#8B6B3E" stroke-width="3" stroke-linecap="round"/>
  <path d="M70 56 L68 90" stroke="#8B6B3E" stroke-width="3" stroke-linecap="round"/>
  <path d="M84 58 L80 88" stroke="#8B6B3E" stroke-width="3" stroke-linecap="round"/>
`,
    }),
  ),
  "cat-calico": svg(
    "Cat calico",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="34" ry="28" fill="#F7F4FB"/>
  <path d="M28 52 L40 22 L52 52 Z" fill="#F7F4FB"/>
  <path d="M76 52 L88 22 L100 52 Z" fill="#3D3344"/>
  <path d="M34 48 L40 30 L46 48 Z" fill="#F6C1B0"/>
  <path d="M82 48 L88 30 L94 48 Z" fill="#6B5B7A"/>
  <path d="M42 68 Q52 58 58 78 Q48 86 42 68 Z" fill="#E89A4A"/>
  <path d="M70 62 Q82 56 88 78 Q76 86 70 62 Z" fill="#3D3344"/>
  <circle cx="50" cy="72" r="5" fill="#3D3344"/>
  <circle cx="78" cy="72" r="5" fill="#F5C84C"/>
  <ellipse cx="64" cy="86" rx="5" ry="3.5" fill="#E89A8A"/>
  <path d="M64 86 Q52 94 46 90" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 86 Q76 94 82 90" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "cat-tuxedo": svg(
    "Cat tuxedo",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="34" ry="28" fill="#3D3344"/>
  <path d="M28 52 L40 22 L52 52 Z" fill="#3D3344"/>
  <path d="M76 52 L88 22 L100 52 Z" fill="#3D3344"/>
  <path d="M34 48 L40 30 L46 48 Z" fill="#6B5B7A"/>
  <path d="M82 48 L88 30 L94 48 Z" fill="#6B5B7A"/>
  <ellipse cx="64" cy="86" rx="14" ry="16" fill="#F7F4FB"/>
  <circle cx="50" cy="72" r="5" fill="#F5C84C"/>
  <circle cx="78" cy="72" r="5" fill="#F5C84C"/>
  <ellipse cx="64" cy="86" rx="5" ry="3.5" fill="#E89A8A"/>
  <path d="M64 86 Q52 94 46 90" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 86 Q76 94 82 90" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "cat-siamese": svg(
    "Cat Siamese",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="34" ry="28" fill="#F3E6D4"/>
  <path d="M28 52 L40 22 L52 52 Z" fill="#6B5344"/>
  <path d="M76 52 L88 22 L100 52 Z" fill="#6B5344"/>
  <path d="M34 48 L40 30 L46 48 Z" fill="#8B6B3E"/>
  <path d="M82 48 L88 30 L94 48 Z" fill="#8B6B3E"/>
  <ellipse cx="64" cy="70" rx="18" ry="14" fill="#C4A574"/>
  <circle cx="50" cy="72" r="5" fill="#5B7CDE"/>
  <circle cx="78" cy="72" r="5" fill="#5B7CDE"/>
  <ellipse cx="64" cy="86" rx="5" ry="3.5" fill="#E89A8A"/>
  <path d="M64 86 Q52 94 46 90" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 86 Q76 94 82 90" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "cat-persian": svg(
    "Cat Persian",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="80" rx="38" ry="32" fill="#E8D2B5"/>
  <path d="M26 56 L38 24 L54 56 Z" fill="#E8D2B5"/>
  <path d="M74 56 L90 24 L102 56 Z" fill="#E8D2B5"/>
  <path d="M32 52 L38 32 L46 52 Z" fill="#F6C1B0"/>
  <path d="M82 52 L90 32 L98 52 Z" fill="#F6C1B0"/>
  <circle cx="50" cy="74" r="5" fill="#3D3344"/>
  <circle cx="78" cy="74" r="5" fill="#3D3344"/>
  <ellipse cx="64" cy="88" rx="6" ry="4" fill="#E89A8A"/>
  <path d="M64 88 Q52 96 46 92" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 88 Q76 96 82 92" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "cat-maine-coon": svg(
    "Cat Maine Coon",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="80" rx="36" ry="30" fill="#A67C52"/>
  <path d="M24 54 L36 18 L54 54 Z" fill="#A67C52"/>
  <path d="M74 54 L92 18 L104 54 Z" fill="#A67C52"/>
  <path d="M30 50 L36 28 L44 50 Z" fill="#C4A574"/>
  <path d="M84 50 L92 28 L100 50 Z" fill="#C4A574"/>
  <path d="M44 58 L48 90" stroke="#6E452A" stroke-width="3" stroke-linecap="round"/>
  <path d="M64 56 L64 92" stroke="#6E452A" stroke-width="3" stroke-linecap="round"/>
  <path d="M84 58 L80 90" stroke="#6E452A" stroke-width="3" stroke-linecap="round"/>
  <circle cx="50" cy="74" r="5" fill="#3D3344"/>
  <circle cx="78" cy="74" r="5" fill="#3D3344"/>
  <ellipse cx="64" cy="88" rx="5" ry="3.5" fill="#E89A8A"/>
  <path d="M64 88 Q52 96 46 92" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 88 Q76 96 82 92" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "cat-sphynx": svg(
    "Cat Sphynx",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="30" ry="26" fill="#E8C9A0"/>
  <path d="M32 54 L42 28 L52 54 Z" fill="#E8C9A0"/>
  <path d="M76 54 L86 28 L96 54 Z" fill="#E8C9A0"/>
  <path d="M36 50 L42 34 L48 50 Z" fill="#F6C1B0"/>
  <path d="M80 50 L86 34 L92 50 Z" fill="#F6C1B0"/>
  <ellipse cx="48" cy="68" rx="8" ry="6" fill="#D9B996"/>
  <ellipse cx="80" cy="68" rx="8" ry="6" fill="#D9B996"/>
  <circle cx="50" cy="72" r="5" fill="#5B7CDE"/>
  <circle cx="78" cy="72" r="5" fill="#5B7CDE"/>
  <ellipse cx="64" cy="86" rx="5" ry="3.5" fill="#E89A8A"/>
  <path d="M64 86 Q52 94 46 90" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 86 Q76 94 82 90" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "cat-tortie": svg(
    "Cat tortie",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="34" ry="28" fill="#6B5344"/>
  <path d="M28 52 L40 22 L52 52 Z" fill="#E89A4A"/>
  <path d="M76 52 L88 22 L100 52 Z" fill="#6B5344"/>
  <path d="M34 48 L40 30 L46 48 Z" fill="#F0B27A"/>
  <path d="M82 48 L88 30 L94 48 Z" fill="#8B6B3E"/>
  <path d="M46 62 Q58 58 62 80 Q50 84 46 62 Z" fill="#E89A4A"/>
  <path d="M68 60 Q80 55 86 82 Q72 86 68 60 Z" fill="#3D3344"/>
  <circle cx="50" cy="72" r="5" fill="#3D3344"/>
  <circle cx="78" cy="72" r="5" fill="#F5C84C"/>
  <ellipse cx="64" cy="86" rx="5" ry="3.5" fill="#E89A8A"/>
  <path d="M64 86 Q52 94 46 90" fill="none" stroke="#F5EDE6" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 86 Q76 94 82 90" fill="none" stroke="#F5EDE6" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "cat-blue": svg("Cat blue-gray", catFace({ fur: "#7A8BA3", earInner: "#A8B4C4", eye: "#3D3344", nose: "#E89A8A", stroke: "#3D3344" })),
  "cat-fluffy": svg(
    "Cat fluffy",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="80" rx="40" ry="34" fill="#D9C4E8"/>
  <path d="M24 56 L38 20 L56 56 Z" fill="#D9C4E8"/>
  <path d="M72 56 L90 20 L104 56 Z" fill="#D9C4E8"/>
  <path d="M30 52 L38 30 L48 52 Z" fill="#F6C1B0"/>
  <path d="M80 52 L90 30 L98 52 Z" fill="#F6C1B0"/>
  <circle cx="50" cy="74" r="5" fill="#3D3344"/>
  <circle cx="78" cy="74" r="5" fill="#3D3344"/>
  <ellipse cx="64" cy="88" rx="5" ry="3.5" fill="#E89A8A"/>
  <path d="M64 88 Q52 96 46 92" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 88 Q76 96 82 92" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "cat-srd": svg(
    "Cat SRD",
    catFace({
      fur: "#C4A574",
      earInner: "#E8C9A0",
      eye: "#3D3344",
      nose: "#E89A8A",
      stroke: "#3D3344",
      extra: `  <ellipse cx="42" cy="80" rx="6" ry="5" fill="#F7F4FB"/>
  <ellipse cx="86" cy="80" rx="6" ry="5" fill="#F7F4FB"/>
`,
    }),
  ),

  "dog-cream": svg("Dog cream", dogFace({ fur: "#E8D2B5", ear: "#D9B996", eye: "#3D3344", nose: "#E89A8A", stroke: "#3D3344" })),
  "dog-brown": svg("Dog brown", dogFace({ fur: "#8B5E3C", ear: "#6E452A", eye: "#F5EDE6", nose: "#E89A8A", stroke: "#F5EDE6" })),
  "dog-caramel": svg("Dog caramel", dogFace({ fur: "#D4A574", ear: "#B8834A", eye: "#3D3344", nose: "#E89A8A", stroke: "#3D3344" })),
  "dog-black": svg("Dog black", dogFace({ fur: "#3D3344", ear: "#2A2230", eye: "#F5C84C", nose: "#E89A8A", stroke: "#F5EDE6" })),
  "dog-white": svg("Dog white", dogFace({ fur: "#F7F4FB", ear: "#E8D2B5", eye: "#3D3344", nose: "#E89A8A", stroke: "#3D3344" })),
  "dog-golden": svg(
    "Dog Golden",
    dogFace({
      fur: "#E8B86D",
      ear: "#D49A45",
      eye: "#3D3344",
      nose: "#3D3344",
      stroke: "#3D3344",
      snout: `  <ellipse cx="64" cy="86" rx="16" ry="12" fill="#F0C98A"/>
`,
    }),
  ),
  "dog-labrador": svg(
    "Dog Labrador",
    dogFace({
      fur: "#C4A574",
      ear: "#A67C52",
      eye: "#3D3344",
      nose: "#3D3344",
      stroke: "#3D3344",
      snout: `  <ellipse cx="64" cy="88" rx="14" ry="10" fill="#D9B996"/>
`,
    }),
  ),
  "dog-shih-tzu": svg(
    "Dog Shih-tzu",
    `${bg("#F3E6D4")}
  <ellipse cx="64" cy="80" rx="36" ry="32" fill="#F7F4FB"/>
  <ellipse cx="30" cy="78" rx="14" ry="26" fill="#E8D2B5"/>
  <ellipse cx="98" cy="78" rx="14" ry="26" fill="#E8D2B5"/>
  <ellipse cx="64" cy="70" rx="20" ry="16" fill="#F7F4FB"/>
  <circle cx="50" cy="72" r="5" fill="#3D3344"/>
  <circle cx="78" cy="72" r="5" fill="#3D3344"/>
  <ellipse cx="64" cy="86" rx="8" ry="6" fill="#E89A8A"/>
  <path d="M64 88 Q54 98 48 94" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 88 Q74 98 80 94" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "dog-poodle": svg(
    "Dog Poodle",
    `${bg("#F3E6D4")}
  <circle cx="40" cy="48" r="14" fill="#F7F4FB"/>
  <circle cx="88" cy="48" r="14" fill="#F7F4FB"/>
  <circle cx="64" cy="42" r="16" fill="#F7F4FB"/>
  <ellipse cx="64" cy="78" rx="28" ry="26" fill="#F7F4FB"/>
  <ellipse cx="36" cy="70" rx="10" ry="16" fill="#E8D2B5"/>
  <ellipse cx="92" cy="70" rx="10" ry="16" fill="#E8D2B5"/>
  <circle cx="50" cy="74" r="5" fill="#3D3344"/>
  <circle cx="78" cy="74" r="5" fill="#3D3344"/>
  <ellipse cx="64" cy="88" rx="7" ry="5" fill="#E89A8A"/>
  <path d="M64 90 Q54 100 48 96" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 90 Q74 100 80 96" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "dog-dachshund": svg(
    "Dog Dachshund",
    `${bg("#F3E6D4")}
  <ellipse cx="64" cy="78" rx="34" ry="24" fill="#8B5E3C"/>
  <ellipse cx="34" cy="82" rx="14" ry="10" fill="#6E452A"/>
  <ellipse cx="94" cy="82" rx="14" ry="10" fill="#6E452A"/>
  <circle cx="50" cy="74" r="5" fill="#F5EDE6"/>
  <circle cx="78" cy="74" r="5" fill="#F5EDE6"/>
  <ellipse cx="64" cy="88" rx="8" ry="5" fill="#3D3344"/>
  <path d="M64 90 Q54 98 48 94" fill="none" stroke="#F5EDE6" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 90 Q74 98 80 94" fill="none" stroke="#F5EDE6" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "dog-husky": svg(
    "Dog Husky",
    `${bg("#F3E6D4")}
  <ellipse cx="64" cy="78" rx="32" ry="28" fill="#F7F4FB"/>
  <ellipse cx="36" cy="60" rx="12" ry="22" fill="#3D3344"/>
  <ellipse cx="92" cy="60" rx="12" ry="22" fill="#3D3344"/>
  <path d="M48 58 Q64 70 80 58" fill="#3D3344"/>
  <circle cx="50" cy="74" r="5" fill="#5B7CDE"/>
  <circle cx="78" cy="74" r="5" fill="#5B7CDE"/>
  <ellipse cx="64" cy="88" rx="7" ry="5" fill="#3D3344"/>
  <path d="M64 90 Q54 100 48 96" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 90 Q74 100 80 96" fill="none" stroke="#3D3344" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "dog-shepherd": svg(
    "Dog German Shepherd",
    `${bg("#F3E6D4")}
  <ellipse cx="64" cy="78" rx="32" ry="28" fill="#C4A574"/>
  <ellipse cx="36" cy="58" rx="10" ry="22" fill="#3D3344"/>
  <ellipse cx="92" cy="58" rx="10" ry="22" fill="#3D3344"/>
  <path d="M48 62 Q64 74 80 62 L76 90 Q64 96 52 90 Z" fill="#3D3344"/>
  <circle cx="50" cy="74" r="5" fill="#F5EDE6"/>
  <circle cx="78" cy="74" r="5" fill="#F5EDE6"/>
  <ellipse cx="64" cy="88" rx="7" ry="5" fill="#3D3344"/>
  <path d="M64 90 Q54 100 48 96" fill="none" stroke="#F5EDE6" stroke-width="2" stroke-linecap="round"/>
  <path d="M64 90 Q74 100 80 96" fill="none" stroke="#F5EDE6" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "dog-french-bulldog": svg(
    "Dog French Bulldog",
    `${bg("#F3E6D4")}
  <ellipse cx="64" cy="80" rx="34" ry="28" fill="#9A93A6"/>
  <ellipse cx="40" cy="52" rx="12" ry="10" fill="#9A93A6"/>
  <ellipse cx="88" cy="52" rx="12" ry="10" fill="#9A93A6"/>
  <ellipse cx="64" cy="90" rx="16" ry="12" fill="#6B5B7A"/>
  <circle cx="50" cy="74" r="5" fill="#3D3344"/>
  <circle cx="78" cy="74" r="5" fill="#3D3344"/>
  <ellipse cx="64" cy="88" rx="8" ry="5" fill="#3D3344"/>
  <path d="M56 92 Q64 98 72 92" fill="none" stroke="#F5EDE6" stroke-width="2" stroke-linecap="round"/>`,
  ),

  "bird-cockatiel": svg(
    "Cockatiel",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="26" ry="28" fill="#F5EDE6"/>
  <path d="M64 28 L72 58 L56 58 Z" fill="#F5C84C"/>
  <circle cx="64" cy="68" r="18" fill="#F5EDE6"/>
  <ellipse cx="54" cy="66" rx="4" ry="5" fill="#3D3344"/>
  <ellipse cx="74" cy="66" rx="4" ry="5" fill="#3D3344"/>
  <ellipse cx="64" cy="76" rx="5" ry="3" fill="#E89A4A"/>
  <path d="M40 80 Q64 100 88 80" fill="#F5C84C"/>`,
  ),
  "bird-parakeet": svg(
    "Parakeet",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="24" ry="28" fill="#7BC47F"/>
  <circle cx="64" cy="66" r="16" fill="#9ED6A1"/>
  <ellipse cx="54" cy="64" rx="4" ry="5" fill="#3D3344"/>
  <ellipse cx="74" cy="64" rx="4" ry="5" fill="#3D3344"/>
  <ellipse cx="64" cy="74" rx="4" ry="3" fill="#E89A4A"/>
  <path d="M42 82 Q64 104 86 82" fill="#5AA85E"/>`,
  ),
  "bird-canary": svg(
    "Canary",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="24" ry="28" fill="#F5C84C"/>
  <circle cx="64" cy="66" r="16" fill="#FFE08A"/>
  <ellipse cx="54" cy="64" rx="4" ry="5" fill="#3D3344"/>
  <ellipse cx="74" cy="64" rx="4" ry="5" fill="#3D3344"/>
  <ellipse cx="64" cy="74" rx="4" ry="3" fill="#E89A4A"/>
  <path d="M42 82 Q64 104 86 82" fill="#E8B86D"/>`,
  ),
  "bird-parrot": svg(
    "Parrot",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="80" rx="26" ry="30" fill="#5B7CDE"/>
  <circle cx="64" cy="66" r="17" fill="#7BC47F"/>
  <ellipse cx="54" cy="64" rx="4" ry="5" fill="#3D3344"/>
  <ellipse cx="74" cy="64" rx="4" ry="5" fill="#3D3344"/>
  <path d="M58 74 Q64 82 70 74" fill="#E89A4A"/>
  <path d="M40 84 Q64 108 88 84" fill="#E85A5A"/>`,
  ),
  "rabbit-cream": svg(
    "Rabbit cream",
    `${bg("#EDE8F5")}
  <ellipse cx="44" cy="36" rx="10" ry="28" fill="#E8D2B5"/>
  <ellipse cx="84" cy="36" rx="10" ry="28" fill="#E8D2B5"/>
  <ellipse cx="44" cy="36" rx="5" ry="18" fill="#F6C1B0"/>
  <ellipse cx="84" cy="36" rx="5" ry="18" fill="#F6C1B0"/>
  <ellipse cx="64" cy="78" rx="30" ry="28" fill="#E8D2B5"/>
  <circle cx="50" cy="74" r="5" fill="#3D3344"/>
  <circle cx="78" cy="74" r="5" fill="#3D3344"/>
  <ellipse cx="64" cy="88" rx="6" ry="4" fill="#E89A8A"/>`,
  ),
  "hamster-brown": svg(
    "Hamster",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="78" rx="32" ry="28" fill="#D4A574"/>
  <ellipse cx="40" cy="70" rx="12" ry="14" fill="#E8C9A0"/>
  <ellipse cx="88" cy="70" rx="12" ry="14" fill="#E8C9A0"/>
  <circle cx="50" cy="74" r="5" fill="#3D3344"/>
  <circle cx="78" cy="74" r="5" fill="#3D3344"/>
  <ellipse cx="64" cy="88" rx="6" ry="4" fill="#E89A8A"/>
  <ellipse cx="64" cy="96" rx="8" ry="5" fill="#F6C1B0"/>`,
  ),
  "paw-neutral": svg(
    "Paw",
    `${bg("#EDE8F5")}
  <ellipse cx="64" cy="82" rx="22" ry="18" fill="#9B8EC4"/>
  <circle cx="40" cy="52" r="11" fill="#9B8EC4"/>
  <circle cx="56" cy="42" r="11" fill="#9B8EC4"/>
  <circle cx="72" cy="42" r="11" fill="#9B8EC4"/>
  <circle cx="88" cy="52" r="11" fill="#9B8EC4"/>
  <circle cx="48" cy="78" r="3" fill="#EDE8F5" opacity="0.5"/>
  <circle cx="64" cy="74" r="3" fill="#EDE8F5" opacity="0.5"/>
  <circle cx="80" cy="78" r="3" fill="#EDE8F5" opacity="0.5"/>`,
  ),
};

for (const [id, content] of Object.entries(avatars)) {
  writeFileSync(join(outDir, `${id}.svg`), content, "utf8");
}

console.log(`Wrote ${Object.keys(avatars).length} avatars to ${outDir}`);
