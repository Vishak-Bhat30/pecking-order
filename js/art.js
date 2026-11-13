// Pecking Order — original SVG art (characters, hen avatars, card back, icons).
// Flat-cartoon style: warm dark outline, flat fills with one shade tone, small highlights.
// Every animated part is a <g> with a class; all motion lives in css/art.css.
// No element IDs are used anywhere, so any number of copies can be inlined in one page.

const INK = '#2b2118';
const ln = (w = 4, c = INK) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const NOSTROKE = 'stroke="none"';
const r2 = (a, b) => (a + Math.random() * (b - a)).toFixed(2);
// Per-instance random negative delays so many copies on screen never animate in lockstep.
const stagger = () => `--po-d1:-${r2(0, 5)}s;--po-d2:-${r2(0, 5)}s;--po-d3:-${r2(0, 5)}s;--po-d4:-${r2(0, 5)}s`;
// Limb drawn as an outlined thick stroke (dark pass + colour pass).
const limb = (d, color, w = 5) =>
  `<path d="${d}" fill="none" ${ln(w + 5)}/><path d="${d}" fill="none" ${ln(w, color)}/>`;

export const ROLE_IDS = ['rooster', 'fox', 'raccoon', 'owl', 'goose'];

// Card colours (kept here too so the art preview / UI can share them).
export const ROLE_COLORS = {
  rooster: { bg: '#FFD166', ink: '#D7263D' },
  fox: { bg: '#2D6A4F', ink: '#F3722C' },
  raccoon: { bg: '#9B8EC4', ink: '#4A4E69' },
  owl: { bg: '#1D3557', ink: '#C68B59' },
  goose: { bg: '#A8DADC', ink: '#F4A261' },
};

/* ------------------------------------------------------------------ */
/* ROOSTER                                                             */
/* ------------------------------------------------------------------ */
function rooster() {
  const legC = '#f2b33d';
  return `
<g class="r-all">
  <ellipse cx="106" cy="191" rx="40" ry="5" fill="#000" opacity=".13" ${NOSTROKE}/>
  <g class="r-legs">
    ${limb('M92 156 L90 186 L103 189 M90 186 L80 191 M90 186 L97 193', legC)}
    ${limb('M118 156 L120 186 L133 189 M120 186 L110 191 M120 186 L127 193', legC)}
  </g>
  <g class="r-tail">
    <path d="M78 116 C 46 108, 22 74, 40 28 C 50 62, 70 86, 94 102 Z" fill="#1f4f5a" ${ln()}/>
    <path d="M76 122 C 38 124, 12 94, 16 54 C 32 84, 58 102, 90 110 Z" fill="#2f7f7a" ${ln()}/>
    <path d="M78 128 C 44 140, 16 128, 10 100 C 32 116, 56 122, 86 118 Z" fill="#1f4f5a" ${ln()}/>
    <path d="M82 110 C 64 94, 58 72, 68 50 C 72 74, 82 90, 98 102 Z" fill="#3a9a8f" ${ln()}/>
    <path d="M38 44 C 44 64, 58 82, 76 96" fill="none" ${ln(2.5, '#5fc0b0')} opacity=".7"/>
  </g>
  <g class="r-torso">
    <path d="M64 120 C 62 96, 88 86, 116 92 C 144 98, 160 116, 152 140 C 146 160, 124 170, 100 168 C 76 166, 64 146, 64 120 Z" fill="#c4512f" ${ln()}/>
    <path d="M67 134 C 72 154, 86 165, 104 166 C 126 167, 145 155, 151 138 C 138 152, 120 157, 100 155 C 85 153, 73 146, 67 134 Z" fill="#9c3b22" ${NOSTROKE}/>
    <path d="M64 120 C 62 96, 88 86, 116 92 C 144 98, 160 116, 152 140 C 146 160, 124 170, 100 168 C 76 166, 64 146, 64 120 Z" fill="none" ${ln()}/>
    <g class="r-wing">
      <path d="M134 122 C 130 104, 100 100, 84 112 C 76 118, 72 128, 64 136 C 74 135, 74 141, 82 143 C 86 149, 93 147, 98 151 C 116 155, 136 142, 134 122 Z" fill="#a8422a" ${ln(3.5)}/>
      <path d="M84 132 C 96 132, 112 128, 122 120 M90 142 C 104 142, 118 136, 128 128" fill="none" ${ln(2.5, '#7a2c18')}/>
      <path d="M100 108 C 110 105, 122 108, 128 116" fill="none" ${ln(2.5, '#e07a52')} opacity=".8"/>
    </g>
  </g>
  <g class="r-head">
    <path d="M98 102 C 102 80, 112 62, 124 54 L 146 60 C 153 74, 155 90, 151 106 L 145 100 L 141 113 L 133 104 L 127 117 L 120 104 L 112 115 L 108 103 Z" fill="#f4a42c" ${ln()}/>
    <path d="M118 66 C 116 78, 116 90, 120 100 M132 64 C 130 78, 132 90, 136 100 M144 70 C 144 82, 146 92, 146 100" fill="none" ${ln(2.5, '#ffd37a')}/>
    <g class="r-comb">
      <path d="M118 52 C 112 42, 118 32, 126 37 C 125 26, 136 22, 139 31 C 143 21, 156 25, 151 36 C 160 34, 162 46, 152 49 C 140 45, 128 47, 118 52 Z" fill="#e63946" ${ln()}/>
      <path d="M128 36 C 129 32, 132 30, 135 31" fill="none" ${ln(2.5, '#ff8a94')}/>
    </g>
    <circle cx="137" cy="60" r="19" fill="#e0503a" ${ln()}/>
    <g class="r-wattle">
      <path d="M149 66 C 160 68, 162 80, 157 88 C 151 93, 143 85, 145 74 Z" fill="#e63946" ${ln(3.5)}/>
    </g>
    <g class="r-beak-bot">
      <path d="M152 63 L 175 63 Q 166 72 154 70 Z" fill="#e89a26" ${ln(3.5)}/>
    </g>
    <g class="r-beak-top">
      <path d="M151 50 Q 170 51 180 62 Q 166 65 152 64 Z" fill="#f6b93b" ${ln(3.5)}/>
      <path d="M158 56 Q 163 56 166 58" fill="none" ${ln(2, '#c47a14')}/>
    </g>
    <g class="blink r-eye">
      <circle cx="141" cy="55" r="6.5" fill="#fff" ${ln(3)}/>
      <circle cx="143" cy="55.5" r="3.4" fill="${INK}" ${NOSTROKE}/>
      <circle cx="144.4" cy="53.8" r="1.2" fill="#fff" ${NOSTROKE}/>
    </g>
    <path d="M133 46 Q 141 44 149 48" fill="none" ${ln(3)}/>
    <g class="r-waves">
      <path d="M184 50 Q 190 60 184 70" fill="none" ${ln(4, '#D7263D')}/>
      <path d="M191 42 Q 201 60 191 78" fill="none" ${ln(4, '#D7263D')}/>
      <path d="M198 34 Q 212 60 198 86" fill="none" ${ln(4, '#D7263D')}/>
    </g>
  </g>
</g>`;
}

/* ------------------------------------------------------------------ */
/* FOX                                                                 */
/* ------------------------------------------------------------------ */
function fox() {
  const O = '#ef7a2e', OS = '#c95d1c', CREAM = '#fff1dc', DARK = '#3a2a22';
  return `
<g class="f-all">
  <ellipse cx="100" cy="191" rx="54" ry="5" fill="#000" opacity=".18" ${NOSTROKE}/>
  <g class="f-tail">
    <path d="M86 178 C 48 186, 14 164, 16 126 C 18 102, 34 84, 52 84 C 66 85, 68 100, 57 107 C 46 115, 44 132, 52 146 C 60 158, 76 162, 92 160 Z" fill="${O}" ${ln()}/>
    <path d="M18 116 C 22 96, 36 84, 52 84 C 66 85, 68 100, 57 107 C 50 103, 41 104, 34 109 C 28 113, 23 116, 18 116 Z" fill="${CREAM}" ${ln(3.5)}/>
    <path d="M30 150 C 38 162, 56 170, 76 170" fill="none" ${ln(2.5, OS)}/>
  </g>
  <g class="f-body">
    <path d="M66 178 C 58 146, 70 112, 104 108 C 138 112, 150 146, 142 178 C 132 188, 76 188, 66 178 Z" fill="${O}" ${ln()}/>
    <path d="M70 166 C 66 146, 72 126, 84 116 C 78 134, 78 154, 84 174 Z" fill="${OS}" ${NOSTROKE}/>
    <path d="M86 112 C 96 122, 112 122, 122 112 C 130 128, 124 146, 104 156 C 84 146, 78 128, 86 112 Z" fill="${CREAM}" ${ln(2.5)}/>
    <path d="M96 132 l 4 4 l 4 -4 l 4 4 M93 142 l 4 3 l 4 -3 l 4 3 l 4 -3" fill="none" ${ln(1.8, '#e9d3b4')}/>
    <path d="M68 180 C 62 164, 68 150, 82 150 C 88 158, 88 172, 84 182 Z" fill="${OS}" ${ln(3)}/>
    <path d="M140 180 C 146 164, 140 150, 126 150 C 120 158, 120 172, 124 182 Z" fill="${OS}" ${ln(3)}/>
    <ellipse cx="72" cy="187" rx="11" ry="5" fill="${DARK}" ${ln(3)}/>
    <ellipse cx="136" cy="187" rx="11" ry="5" fill="${DARK}" ${ln(3)}/>
    <path d="M87 146 C 87 160, 88 172, 87 183 Q 87 191 94 191 Q 101 191 101 183 C 100 172, 101 160, 101 146 Z" fill="${O}" ${ln(3.5)}/>
    <path d="M87.6 168 L 91 164.5 L 94 168.5 L 97.5 164.5 L 100.6 168 L 101 183 Q 101 191 94 191 Q 87 191 87 183 Z" fill="${DARK}" ${ln(3)}/>
    <path d="M107 146 C 107 160, 108 172, 107 183 Q 107 191 114 191 Q 121 191 121 183 C 120 172, 121 160, 121 146 Z" fill="${O}" ${ln(3.5)}/>
    <path d="M107.4 168 L 110.5 164.5 L 114 168.5 L 117 164.5 L 120.4 168 L 121 183 Q 121 191 114 191 Q 107 191 107 183 Z" fill="${DARK}" ${ln(3)}/>
    <path d="M92 186 L92 190 M96.5 186 L96.5 190 M111.5 186 L111.5 190 M116 186 L116 190" fill="none" ${ln(1.8, '#7d665a')}/>
  </g>
  <g class="f-head">
    <g class="f-ear-l">
      <path d="M68 58 L 58 14 Q 60 9 65 11 L 98 42 Z" fill="${O}" ${ln()}/>
      <path d="M71 49 L 65 22 L 88 42 Z" fill="${DARK}" ${ln(2.5)}/>
    </g>
    <g class="f-ear-r">
      <path d="M140 58 L 150 14 Q 148 9 143 11 L 110 42 Z" fill="${O}" ${ln()}/>
      <path d="M137 49 L 143 22 L 120 42 Z" fill="${DARK}" ${ln(2.5)}/>
    </g>
    <path d="M56 70 C 56 46, 78 34, 104 34 C 130 34, 152 46, 152 70 C 152 81, 147 88, 160 97 C 144 100, 133 104, 125 110 L 104 123 L 83 110 C 75 104, 64 100, 48 97 C 61 88, 56 81, 56 70 Z" fill="${O}" ${ln()}/>
    <path d="M58 84 C 70 88, 84 86, 93 90 C 97 98, 99 104, 100 110 L 108 110 C 109 104, 111 98, 115 90 C 124 86, 138 88, 150 84 C 142 96, 130 102, 122 110 L 104 122 L 86 110 C 78 102, 66 96, 58 84 Z" fill="${CREAM}" ${NOSTROKE}/>
    <path d="M86 40 C 94 37, 104 37, 112 39" fill="none" ${ln(2.5, '#ffa766')}/>
    <g class="f-eyes blink">
      <ellipse cx="84" cy="71" rx="10.5" ry="8" fill="#fff" ${ln(2.5)}/>
      <ellipse cx="124" cy="71" rx="10.5" ry="8" fill="#fff" ${ln(2.5)}/>
      <g class="f-pupils">
        <circle cx="88" cy="73" r="4.8" fill="#4b2e12" ${NOSTROKE}/>
        <circle cx="128" cy="73" r="4.8" fill="#4b2e12" ${NOSTROKE}/>
        <circle cx="89.5" cy="71.5" r="1.4" fill="#fff" ${NOSTROKE}/>
        <circle cx="129.5" cy="71.5" r="1.4" fill="#fff" ${NOSTROKE}/>
      </g>
      <path d="M71 70 C 76 63, 92 62, 97 68 L 97 58 L 71 58 Z" fill="${O}" ${NOSTROKE}/>
      <path d="M111 68 C 116 62, 132 63, 137 70 L 137 58 L 111 58 Z" fill="${O}" ${NOSTROKE}/>
      <path d="M72 70 C 78 64, 90 63, 97 68" fill="none" ${ln(3.2)}/>
      <path d="M111 68 C 118 63, 130 64, 136 70" fill="none" ${ln(3.2)}/>
    </g>
    <path d="M71 58 L 95 63 M137 58 L 113 63" fill="none" ${ln(3.5)}/>
    <path d="M97 110 Q 104 106 111 110 Q 104 118 97 110 Z" fill="${DARK}" ${ln(2.5)}/>
    <g class="f-smirk"><path d="M93 116 Q 99 121 106 117 Q 112 116 117 111" fill="none" ${ln(3)}/></g>
    <g class="f-grin">
      <path d="M86 112 Q 104 136 124 110 Q 104 120 86 112 Z" fill="#5a1f1a" ${ln(3)}/>
      <path d="M90 114 L 94 120 L 97 115 M111 115 L 114 120 L 118 113" fill="#fff" ${ln(1.6)}/>
    </g>
    <g class="f-glint">
      <path d="M140 46 L 142.5 55 L 151 57.5 L 142.5 60 L 140 69 L 137.5 60 L 129 57.5 L 137.5 55 Z" fill="#fff" ${ln(2)}/>
    </g>
  </g>
</g>`;
}

/* ------------------------------------------------------------------ */
/* RACCOON                                                             */
/* ------------------------------------------------------------------ */
function raccoon() {
  const G = '#8d8f9e', GS = '#6f7182', L = '#d9dae2', M = '#2e2f3e', RING = '#3d3e4e';
  const tail = 'M128 170 C 160 176, 180 152, 176 122 C 174 106, 164 96, 152 98';
  return `
<g class="rc-all">
  <ellipse cx="100" cy="192" rx="48" ry="5" fill="#000" opacity=".15" ${NOSTROKE}/>
  <g class="rc-tail">
    <path d="${tail}" fill="none" ${ln(27)}/>
    <path d="${tail}" fill="none" ${ln(19, G)}/>
    <path d="${tail}" fill="none" stroke="${RING}" stroke-width="19" stroke-dasharray="10 9" stroke-dashoffset="4" stroke-linecap="butt"/>
    <circle cx="152" cy="98" r="9.5" fill="${RING}" ${NOSTROKE}/>
  </g>
  <g class="rc-body">
    <path d="M60 186 C 50 150, 62 112, 100 110 C 138 112, 150 150, 140 186 Z" fill="${G}" ${ln()}/>
    <path d="M64 176 C 58 152, 64 128, 78 118 C 72 136, 72 158, 78 182 Z" fill="${GS}" ${NOSTROKE}/>
    <path d="M80 184 C 74 160, 82 134, 100 132 C 118 134, 126 160, 120 184 Z" fill="${L}" ${NOSTROKE}/>
    <ellipse cx="80" cy="188" rx="15" ry="6.5" fill="${RING}" ${ln(3.5)}/>
    <ellipse cx="120" cy="188" rx="15" ry="6.5" fill="${RING}" ${ln(3.5)}/>
  </g>
  <g class="rc-paw-l">
    ${limb('M70 126 C 68 138, 78 146, 90 142', G, 9)}
    <circle cx="92" cy="141" r="7.5" fill="${RING}" ${ln(3.5)}/>
    <path d="M88 136 L 86 133 M93 134 L 93 131 M97 136 L 99 133" fill="none" ${ln(2.2)}/>
  </g>
  <g class="rc-paw-r">
    ${limb('M130 126 C 132 138, 122 146, 110 142', G, 9)}
    <circle cx="108" cy="141" r="7.5" fill="${RING}" ${ln(3.5)}/>
    <path d="M112 136 L 114 133 M107 134 L 107 131 M103 136 L 101 133" fill="none" ${ln(2.2)}/>
  </g>
  <g class="rc-head">
    <g class="rc-ear-l"><circle cx="64" cy="40" r="15" fill="${G}" ${ln()}/><circle cx="64" cy="42" r="7.5" fill="${M}" ${NOSTROKE}/></g>
    <g class="rc-ear-r"><circle cx="136" cy="40" r="15" fill="${G}" ${ln()}/><circle cx="136" cy="42" r="7.5" fill="${M}" ${NOSTROKE}/></g>
    <path d="M50 74 C 46 50, 70 30, 100 30 C 130 30, 154 50, 150 74 C 152 82, 158 88, 162 95 C 154 95, 151 98, 146 99 C 138 107, 122 112, 100 112 C 78 112, 62 107, 54 99 C 49 98, 46 95, 38 95 C 42 88, 48 82, 50 74 Z" fill="${G}" ${ln()}/>
    <path d="M100 36 C 94 44, 94 56, 100 64 C 106 56, 106 44, 100 36 Z" fill="${RING}" ${NOSTROKE} opacity=".85"/>
    <ellipse cx="75" cy="55" rx="15" ry="7" fill="${L}" ${NOSTROKE} transform="rotate(-10 75 55)"/>
    <ellipse cx="125" cy="55" rx="15" ry="7" fill="${L}" ${NOSTROKE} transform="rotate(10 125 55)"/>
    <path d="M77 88 C 80 76, 120 76, 123 88 C 125 101, 113 109, 100 109 C 87 109, 75 101, 77 88 Z" fill="${L}" ${NOSTROKE}/>
    <path d="M51 72 C 58 58, 84 58, 100 68 C 116 58, 142 58, 149 72 C 147 85, 130 91, 116 87 C 108 85, 104 81, 100 81 C 96 81, 92 85, 84 87 C 70 91, 53 85, 51 72 Z" fill="${M}" ${ln(3)}/>
    <g class="rc-eyes blink">
      <circle cx="78" cy="72" r="9" fill="#fff" ${NOSTROKE}/>
      <circle cx="122" cy="72" r="9" fill="#fff" ${NOSTROKE}/>
      <g class="rc-pupils">
        <circle cx="79" cy="73" r="4.8" fill="#14141c" ${NOSTROKE}/>
        <circle cx="123" cy="73" r="4.8" fill="#14141c" ${NOSTROKE}/>
        <circle cx="80.6" cy="71.2" r="1.5" fill="#fff" ${NOSTROKE}/>
        <circle cx="124.6" cy="71.2" r="1.5" fill="#fff" ${NOSTROKE}/>
      </g>
    </g>
    <path d="M91 88 Q 100 83 109 88 Q 107 96 100 96 Q 93 96 91 88 Z" fill="#1d1d26" ${ln(2.5)}/>
    <circle cx="97" cy="88" r="1.6" fill="#fff" ${NOSTROKE} opacity=".7"/>
    <g class="rc-mouth"><path d="M100 96 L 100 101 M91 100 Q 100 107 109 100" fill="none" ${ln(3)}/></g>
    <g class="rc-gasp"><ellipse cx="100" cy="103" rx="5" ry="4" fill="#5a1f1a" ${ln(2.5)}/></g>
  </g>
  <g class="rc-cob"><g transform="translate(100 126) scale(.6) translate(-100 -118)">
    <path d="M86 116 C 84 104, 90 92, 100 90 C 110 92, 116 104, 114 116 C 112 128, 106 134, 100 134 C 94 134, 88 128, 86 116 Z" fill="#f9c22e" ${ln(3.5)}/>
    <path d="M92 100 L108 100 M89 108 L111 108 M88 116 L112 116 M90 124 L110 124 M96 92 L96 132 M104 92 L104 132" fill="none" ${ln(1.8, '#d99a12')}/>
    <path d="M86 124 C 80 132, 82 142, 92 146 C 92 138, 94 132, 98 130 Z" fill="#7cb342" ${ln(3)}/>
    <path d="M114 124 C 120 132, 118 142, 108 146 C 108 138, 106 132, 102 130 Z" fill="#8bc34a" ${ln(3)}/>
    </g></g>
</g>`;
}

/* ------------------------------------------------------------------ */
/* OWL                                                                 */
/* ------------------------------------------------------------------ */
function owl() {
  const B = '#a0683f', BS = '#7a4b2c', BELLY = '#ecd3a5', DISC = '#f3dfb5', TAL = '#f2a541';
  const scallops = [];
  const rows = [[124, 3], [138, 4], [152, 4], [165, 3]];
  for (const [y, n] of rows) {
    const w = 11, start = 100 - (n * w) / 2;
    for (let i = 0; i < n; i++) {
      const x = start + i * w + (y % 2 ? 0 : 0);
      scallops.push(`M${(x + 1).toFixed(1)} ${y} q ${(w / 2 - 1).toFixed(1)} 6 ${(w - 2).toFixed(1)} 0`);
    }
  }
  return `
<g class="ow-all">
  <g class="ow-branch">
    <path d="M10 184 C 60 178, 140 178, 190 183 L 190 192 C 140 188, 60 188, 10 193 Z" fill="#6b4a2b" ${ln(3.5)}/>
    <path d="M30 187 C 50 185, 70 185, 88 186 M120 186 C 140 186, 160 187, 176 188" fill="none" ${ln(2, '#8a6440')}/>
    <path d="M176 183 C 182 170, 194 168, 196 172 C 194 180, 186 184, 176 183 Z" fill="#6aa84f" ${ln(3)}/>
  </g>
  <g class="ow-wing-far-l"><path d="M58 104 C 30 104, 12 126, 14 150 C 28 146, 40 152, 50 146 C 60 140, 66 120, 58 104 Z" fill="${BS}" ${ln(3.5)}/></g>
  <g class="ow-wing-far-r"><path d="M142 104 C 170 104, 188 126, 186 150 C 172 146, 160 152, 150 146 C 140 140, 134 120, 142 104 Z" fill="${BS}" ${ln(3.5)}/></g>
  <g class="ow-body">
    <path d="M54 132 C 54 98, 76 84, 100 84 C 124 84, 146 98, 146 132 C 146 166, 126 184, 100 184 C 74 184, 54 166, 54 132 Z" fill="${B}" ${ln()}/>
    <path d="M72 142 C 72 120, 86 110, 100 110 C 114 110, 128 120, 128 142 C 128 165, 116 179, 100 179 C 84 179, 72 165, 72 142 Z" fill="${BELLY}" ${NOSTROKE}/>
    <path d="${scallops.join(' ')}" fill="none" ${ln(2.4, '#b07a4f')}/>
  </g>
  <g class="ow-talons">
    <path d="M80 180 q -2 8 2 10 M86 181 q 0 8 3 10 M92 180 q 2 8 5 9" fill="none" ${ln(6)}/>
    <path d="M80 180 q -2 8 2 10 M86 181 q 0 8 3 10 M92 180 q 2 8 5 9" fill="none" ${ln(3, TAL)}/>
    <path d="M108 180 q -2 8 -5 9 M114 181 q 0 8 -3 10 M120 180 q 2 8 -2 10" fill="none" ${ln(6)}/>
    <path d="M108 180 q -2 8 -5 9 M114 181 q 0 8 -3 10 M120 180 q 2 8 -2 10" fill="none" ${ln(3, TAL)}/>
  </g>
  <g class="ow-wing-l">
    <path d="M60 104 C 44 116, 41 150, 53 174 C 62 178, 71 169, 73 156 C 77 138, 73 116, 60 104 Z" fill="${BS}" ${ln(3.5)}/>
    <path d="M56 130 C 60 140, 62 152, 60 164 M64 124 C 68 134, 70 146, 68 158" fill="none" ${ln(2, '#5c3720')}/>
  </g>
  <g class="ow-wing-r">
    <path d="M140 104 C 156 116, 159 150, 147 174 C 138 178, 129 169, 127 156 C 123 138, 127 116, 140 104 Z" fill="${BS}" ${ln(3.5)}/>
    <path d="M144 130 C 140 140, 138 152, 140 164 M136 124 C 132 134, 130 146, 132 158" fill="none" ${ln(2, '#5c3720')}/>
  </g>
  <g class="ow-head">
    <path d="M60 72 L 46 26 L 84 52 Z" fill="${BS}" ${ln()}/>
    <path d="M140 72 L 154 26 L 116 52 Z" fill="${BS}" ${ln()}/>
    <path d="M48 82 C 48 54, 72 40, 100 40 C 128 40, 152 54, 152 82 C 152 106, 128 120, 100 120 C 72 120, 48 106, 48 82 Z" fill="${B}" ${ln()}/>
    <path d="M100 66 C 90 50, 54 52, 54 81 C 54 101, 76 110, 100 106 C 124 110, 146 101, 146 81 C 146 52, 110 50, 100 66 Z" fill="${DISC}" ${ln(2.5, '#c49a6c')}/>
    <path d="M84 47 C 90 44, 96 44, 100 46 C 104 44, 110 44, 116 47" fill="none" ${ln(2.5, '#c48a5c')}/>
    <g class="ow-glow">
      <circle cx="78" cy="81" r="21" fill="#ffd166" opacity=".55" stroke="#fff1a8" stroke-width="3"/>
      <circle cx="122" cy="81" r="21" fill="#ffd166" opacity=".55" stroke="#fff1a8" stroke-width="3"/>
    </g>
    <g class="ow-eyes">
      <circle cx="78" cy="81" r="17" fill="#f6b12b" ${ln(3.5)}/>
      <circle cx="122" cy="81" r="17" fill="#f6b12b" ${ln(3.5)}/>
      <circle cx="78" cy="81" r="12.5" fill="#ffcb4d" ${NOSTROKE}/>
      <circle cx="122" cy="81" r="12.5" fill="#ffcb4d" ${NOSTROKE}/>
      <g class="ow-iris-glow">
        <circle cx="78" cy="81" r="13" fill="#fff4a3" ${NOSTROKE}/>
        <circle cx="122" cy="81" r="13" fill="#fff4a3" ${NOSTROKE}/>
      </g>
      <g class="ow-pupils">
        <circle cx="78" cy="81" r="8.5" fill="#1b1410" ${NOSTROKE}/>
        <circle cx="122" cy="81" r="8.5" fill="#1b1410" ${NOSTROKE}/>
        <circle cx="82" cy="77" r="3.4" fill="#fff" ${NOSTROKE}/>
        <circle cx="126" cy="77" r="3.4" fill="#fff" ${NOSTROKE}/>
        <circle cx="74.5" cy="85" r="1.4" fill="#fff" ${NOSTROKE}/>
        <circle cx="118.5" cy="85" r="1.4" fill="#fff" ${NOSTROKE}/>
      </g>
    </g>
    <g class="ow-lid-l"><circle cx="78" cy="81" r="18.5" fill="${B}" ${NOSTROKE}/></g>
    <g class="ow-lid-r"><circle cx="122" cy="81" r="18.5" fill="${B}" ${NOSTROKE}/></g>
    <circle cx="78" cy="81" r="17" fill="none" ${ln(3.5)}/>
    <circle cx="122" cy="81" r="17" fill="none" ${ln(3.5)}/>
    <path d="M93 99 Q 100 96 107 99 L 100 115 Z" fill="#e2a23b" ${ln(3)}/>
  </g>
</g>`;
}

/* ------------------------------------------------------------------ */
/* GOOSE                                                               */
/* ------------------------------------------------------------------ */
function goose() {
  const W = '#fbfaf5', WS = '#dfe6ea', OR = '#f4a261', ORD = '#e07a2f';
  return `
<g class="g-all">
  <ellipse cx="94" cy="192" rx="54" ry="5" fill="#000" opacity=".13" ${NOSTROKE}/>
  <g class="g-legs">
    ${limb('M90 168 L 88 184', OR, 5)}
    ${limb('M110 168 L 112 184', OR, 5)}
    <path d="M74 191 L 88 182 L 100 191 Q 87 194 74 191 Z" fill="${OR}" ${ln(3.5)}/>
    <path d="M100 191 L 112 182 L 126 191 Q 113 194 100 191 Z" fill="${OR}" ${ln(3.5)}/>
  </g>
  <g class="g-wing-far">
    <path d="M110 120 C 96 92, 64 76, 40 82 C 44 94, 54 100, 62 104 C 52 106, 46 110, 44 116 C 62 122, 86 126, 110 120 Z" fill="${WS}" ${ln(3.5)}/>
  </g>
  <g class="g-neck">
    <path d="M100 124 C 108 104, 114 92, 112 76 C 110 60, 114 30, 136 28 C 152 28, 159 42, 155 55 C 151 66, 141 70, 139 82 C 137 96, 141 110, 148 126 Z" fill="${W}" ${ln()}/>
    <path d="M118 104 C 120 92, 120 82, 118 72" fill="none" ${ln(2.2, '#c9d3d8')}/>
    <g class="g-cap">
      <path d="M121 32 C 122 18, 148 15, 152 28 C 142 30, 130 31, 121 32 Z" fill="#2b4a7a" ${ln(3.2)}/>
      <path d="M146 27 C 154 25, 162 27, 166 31 C 158 33, 150 32, 145 31 Z" fill="#1d3557" ${ln(3)}/>
      <path d="M135 19.5 L 136.6 23.4 L 140.6 23.6 L 137.5 26 L 138.6 30 L 135 27.7 L 131.4 30 L 132.5 26 L 129.4 23.6 L 133.4 23.4 Z" fill="#ffd166" ${ln(1.5)}/>
    </g>
    <g class="g-beak-bot">
      <path d="M150 51 L 174 50 C 168 57, 158 59, 150 57 Z" fill="${ORD}" ${ln(3.2)}/>
    </g>
    <g class="g-beak-top">
      <path d="M147 39 C 158 37, 171 41, 179 48 C 170 52, 158 52, 149 52 Z" fill="${OR}" ${ln(3.5)}/>
      <path d="M147 39 C 151 36, 156 37, 158 41 C 154 43, 150 43, 147 41 Z" fill="#3a2a22" ${ln(2.5)}/>
      <circle cx="166" cy="44" r="1.3" fill="${INK}" ${NOSTROKE}/>
    </g>
    <g class="blink g-eye">
      <circle cx="139" cy="43" r="5.8" fill="#fff" ${ln(2.8)}/>
      <circle cx="140.5" cy="43.5" r="3.1" fill="${INK}" ${NOSTROKE}/>
      <circle cx="141.6" cy="42.2" r="1" fill="#fff" ${NOSTROKE}/>
    </g>
    <path class="g-brow" d="M130 35 L 146 39" fill="none" ${ln(3.6)}/>
    <g class="g-honk">
      <path d="M183 38 L 191 31 M186 50 L 196 50 M183 62 L 191 69" fill="none" ${ln(4, '#e07a2f')}/>
    </g>
  </g>
  <g class="g-body">
    <path d="M16 110 C 28 118, 40 117, 52 111 C 70 102, 100 102, 122 110 C 144 118, 156 134, 150 152 C 144 168, 124 176, 98 176 C 70 176, 46 168, 34 152 C 26 142, 18 128, 16 110 Z" fill="${W}" ${ln()}/>
    <path d="M38 156 C 60 170, 122 174, 148 154 C 142 167, 124 175, 98 175 C 70 175, 50 168, 38 156 Z" fill="${WS}" ${NOSTROKE}/>
    <path d="M16 110 C 28 118, 40 117, 52 111 C 70 102, 100 102, 122 110 C 144 118, 156 134, 150 152 C 144 168, 124 176, 98 176 C 70 176, 46 168, 34 152 C 26 142, 18 128, 16 110 Z" fill="none" ${ln()}/>
  </g>
  <g class="g-wing">
    <path d="M124 118 C 104 112, 72 114, 54 126 C 44 132, 36 136, 26 134 C 36 146, 54 150, 70 150 C 96 152, 120 146, 130 134 C 134 128, 131 120, 124 118 Z" fill="#eef2f4" ${ln(3.5)}/>
    <path d="M52 140 L 68 136 M66 146 L 84 140 M84 148 L 102 142" fill="none" ${ln(2.4, '#aab6bd')}/>
  </g>
</g>`;
}

const CHARS = { rooster, fox, raccoon, owl, goose };

export function characterSVG(role) {
  const fn = CHARS[role];
  if (!fn) return '';
  return `<svg class="char char-${role}" viewBox="0 0 200 200" overflow="visible" xmlns="http://www.w3.org/2000/svg" style="${stagger()}" aria-hidden="true">${fn()}</svg>`;
}

/* ------------------------------------------------------------------ */
/* HEN AVATARS                                                         */
/* ------------------------------------------------------------------ */
export const HEN_COLORS = [
  { name: 'Snow', body: '#fbf7ee', shade: '#e2d9c6' },
  { name: 'Cocoa', body: '#b8743e', shade: '#935a2c' },
  { name: 'Midnight', body: '#45424f', shade: '#2e2c37' },
  { name: 'Golden', body: '#f2b233', shade: '#d18f17' },
  { name: 'Speckled', body: '#d8d3c8', shade: '#b3ab9c', speckle: '#6b6358' },
  { name: 'Russet', body: '#c8553d', shade: '#a03f2b' },
  { name: 'Bluebell', body: '#7aa0d4', shade: '#587fb5' },
  { name: 'Lavender', body: '#b9a3e0', shade: '#957cc7' },
];
export const HEN_HATS = ['None', 'Top Hat', 'Bow', 'Cap', 'Flower', 'Beanie', 'Cowboy Hat', 'Party Hat'];

const mod = (n, m) => ((Math.floor(Number(n) || 0) % m) + m) % m;

function henHat(i) {
  switch (i) {
    case 1: // top hat
      return `<g class="h-hat" transform="rotate(-8 60 22)">
        <ellipse cx="60" cy="22" rx="19" ry="4.5" fill="#2d2a32" ${ln(3)}/>
        <path d="M48 21 L 49 2 Q 60 -1 71 2 L 72 21 Z" fill="#2d2a32" ${ln(3)}/>
        <path d="M48.6 13 L 71.4 13 L 71.8 19 L 48.3 19 Z" fill="#c0392b" ${NOSTROKE}/>
        <path d="M53 5 L 53 11" ${ln(2, '#6a6575')} fill="none"/>
      </g>`;
    case 2: // bow
      return `<g class="h-hat">
        <path d="M74 20 C 66 10, 62 24, 70 26 Z" fill="#ff6fa5" ${ln(2.8)}/>
        <path d="M76 20 C 86 10, 90 24, 80 26 Z" fill="#ff6fa5" ${ln(2.8)}/>
        <circle cx="75" cy="22" r="3.6" fill="#e0457f" ${ln(2.5)}/>
      </g>`;
    case 3: // cap
      return `<g class="h-hat">
        <path d="M40 28 C 39 12, 80 10, 80 27 Z" fill="#3a7bd5" ${ln(3)}/>
        <path d="M74 24 C 84 21, 95 23, 98 28 C 90 31, 81 30, 74 29 Z" fill="#2a5ea8" ${ln(3)}/>
        <circle cx="60" cy="12.5" r="2.4" fill="#2a5ea8" ${ln(2)}/>
        <path d="M49 16 C 51 22, 52 25, 52 28" fill="none" ${ln(1.6, '#2a5ea8')}/>
      </g>`;
    case 4: // flower
      return `<g class="h-hat">
        ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="75" cy="15" rx="4" ry="6.5" fill="#fff" ${ln(2)} transform="rotate(${a} 75 21)"/>`).join('')}
        <circle cx="75" cy="21" r="3.8" fill="#ffc93c" ${ln(2)}/>
      </g>`;
    case 5: // beanie
      return `<g class="h-hat">
        <path d="M39 27 C 38 9, 82 9, 81 27 Z" fill="#4caf7a" ${ln(3)}/>
        <path d="M37 24 Q 60 19 83 24 L 83 30 Q 60 25 37 30 Z" fill="#2f8f5c" ${ln(2.8)}/>
        <path d="M50 14 L 50 22 M60 12 L 60 21 M70 14 L 70 22" fill="none" ${ln(1.6, '#2f8f5c')}/>
        <circle cx="60" cy="7" r="5" fill="#f4f1e8" ${ln(2.6)}/>
      </g>`;
    case 6: // cowboy hat
      return `<g class="h-hat" transform="rotate(-5 60 24)">
        <path d="M45 24 C 44 10, 52 6, 60 10 C 68 6, 76 10, 75 24 Z" fill="#9a6232" ${ln(3)}/>
        <path d="M46 20 L 74 20 L 74 24 L 46 24 Z" fill="#5c3a1c" ${NOSTROKE}/>
        <path d="M28 22 C 36 30, 84 30, 92 22 C 90 28, 82 32, 60 32 C 38 32, 30 28, 28 22 Z" fill="#b5773f" ${ln(3)}/>
      </g>`;
    case 7: // party hat
      return `<g class="h-hat" transform="rotate(10 60 26)">
        <path d="M60 3 L 47 27 L 73 27 Z" fill="#7b5cd6" ${ln(3)}/>
        <path d="M55 12 L 64 14 M51.5 19 L 67.5 22" fill="none" ${ln(3, '#ffd166')}/>
        <circle cx="60" cy="3" r="3.6" fill="#ff5d8f" ${ln(2.2)}/>
      </g>`;
    default:
      return '';
  }
}

export function henSVG(look = {}) {
  const c = HEN_COLORS[mod(look.color, HEN_COLORS.length)];
  const hat = mod(look.hat, HEN_HATS.length);
  const covers = [1, 3, 5, 6, 7].includes(hat);
  let speck = '';
  if (c.speckle) {
    const pts = [[40, 72], [52, 64], [70, 66], [82, 76], [46, 88], [62, 84], [76, 92], [56, 100], [36, 82], [86, 88], [66, 104]];
    speck = pts.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.5" fill="${c.speckle}" ${NOSTROKE}/>`).join('');
    speck += `<ellipse cx="49" cy="30" rx="1.8" ry="1.3" fill="${c.speckle}" ${NOSTROKE}/><ellipse cx="71" cy="28" rx="1.8" ry="1.3" fill="${c.speckle}" ${NOSTROKE}/>`;
  }
  const feet = '#f2a541';
  const comb = covers
    ? ''
    : `<path d="M47 23 C 43 13, 52 9, 55 15 C 56 6, 66 6, 66 14 C 70 8, 79 12, 74 22 Z" fill="#e63946" ${ln(3)}/>`;
  return `<svg class="hen" viewBox="0 0 120 120" overflow="visible" xmlns="http://www.w3.org/2000/svg" style="${stagger()}" aria-hidden="true">
<ellipse cx="60" cy="115" rx="30" ry="4" fill="#000" opacity=".15" ${NOSTROKE}/>
<g class="h-all">
  <g class="h-feet">
    ${limb('M50 104 L 49 114 M49 114 L 43 117 M49 114 L 55 117', feet, 3)}
    ${limb('M70 104 L 71 114 M71 114 L 65 117 M71 114 L 77 117', feet, 3)}
  </g>
  <g class="h-wing-l"><path d="M30 66 C 17 68, 11 82, 15 92 C 22 94, 30 88, 35 81 Z" fill="${c.shade}" ${ln(3.2)}/></g>
  <g class="h-wing-r"><path d="M90 66 C 103 68, 109 82, 105 92 C 98 94, 90 88, 85 81 Z" fill="${c.shade}" ${ln(3.2)}/></g>
  <path d="M24 79 C 24 57, 40 45, 60 45 C 80 45, 96 57, 96 79 C 96 99, 80 110, 60 110 C 40 110, 24 99, 24 79 Z" fill="${c.body}" ${ln(3.5)}/>
  <path d="M30 93 C 40 104, 80 104, 90 93 C 85 104, 74 109, 60 109 C 46 109, 35 104, 30 93 Z" fill="${c.shade}" ${NOSTROKE}/>
  <path d="M24 79 C 24 57, 40 45, 60 45 C 80 45, 96 57, 96 79 C 96 99, 80 110, 60 110 C 40 110, 24 99, 24 79 Z" fill="none" ${ln(3.5)}/>
  ${speck}
  <g class="h-head">
    ${comb}
    <circle cx="60" cy="41" r="22" fill="${c.body}" ${ln(3.5)}/>
    ${c.speckle ? `<ellipse cx="49" cy="30" rx="1.8" ry="1.3" fill="${c.speckle}" ${NOSTROKE}/><ellipse cx="72" cy="31" rx="1.8" ry="1.3" fill="${c.speckle}" ${NOSTROKE}/>` : ''}
    <ellipse cx="44.5" cy="48" rx="4.2" ry="2.6" fill="#ff8fa3" opacity=".7" ${NOSTROKE}/>
    <ellipse cx="75.5" cy="48" rx="4.2" ry="2.6" fill="#ff8fa3" opacity=".7" ${NOSTROKE}/>
    <g class="h-eyes">
      <circle cx="51.5" cy="39" r="5.4" fill="#fff" ${ln(2.4)}/>
      <circle cx="68.5" cy="39" r="5.4" fill="#fff" ${ln(2.4)}/>
      <g class="h-pupils">
        <circle cx="52.3" cy="39.6" r="3.1" fill="${INK}" ${NOSTROKE}/>
        <circle cx="69.3" cy="39.6" r="3.1" fill="${INK}" ${NOSTROKE}/>
        <circle cx="53.4" cy="38.3" r="1.1" fill="#fff" ${NOSTROKE}/>
        <circle cx="70.4" cy="38.3" r="1.1" fill="#fff" ${NOSTROKE}/>
      </g>
    </g>
    <g class="h-xeyes">
      <path d="M47.5 35 L 55.5 43 M55.5 35 L 47.5 43 M64.5 35 L 72.5 43 M72.5 35 L 64.5 43" fill="none" ${ln(3)}/>
    </g>
    <path d="M54.5 47 L 65.5 47 L 60 55.5 Z" fill="#f6b93b" ${ln(2.6)}/>
    <path d="M57.5 55 C 55.5 60, 57.5 64, 60 64 C 62.5 64, 64.5 60, 62.5 55 Z" fill="#e63946" ${ln(2.4)}/>
    ${henHat(hat)}
  </g>
</g>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* CARD BACK                                                           */
/* ------------------------------------------------------------------ */
export function cardBackSVG() {
  const planks = [29, 56, 84, 111].map((x) => `M${x} 6 L ${x} 194`).join(' ');
  const grain = 'M16 40 q 6 4 0 10 M44 120 q 6 4 0 10 M98 60 q -6 4 0 10 M124 150 q -6 4 0 10 M70 166 q 5 3 0 8';
  return `<svg class="cardback" viewBox="0 0 140 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect x="2" y="2" width="136" height="196" rx="14" fill="#b5382c" ${ln(4)}/>
<path d="${planks}" fill="none" stroke="#8f2a20" stroke-width="2.5"/>
<path d="${grain}" fill="none" stroke="#9d3024" stroke-width="1.6" stroke-linecap="round"/>
<path d="M20 20 L 120 180 M120 20 L 20 180" fill="none" stroke="#5c1a12" stroke-width="13" stroke-linecap="butt"/>
<path d="M20 20 L 120 180 M120 20 L 20 180" fill="none" stroke="#f6e7c8" stroke-width="8.5" stroke-linecap="butt"/>
<rect x="15" y="15" width="110" height="170" rx="8" fill="none" stroke="#5c1a12" stroke-width="11"/>
<rect x="15" y="15" width="110" height="170" rx="8" fill="none" stroke="#f6e7c8" stroke-width="7"/>
<g fill="#5c1a12">
  <circle cx="21" cy="21" r="2"/><circle cx="119" cy="21" r="2"/><circle cx="21" cy="179" r="2"/><circle cx="119" cy="179" r="2"/>
</g>
<circle cx="70" cy="100" r="27" fill="#f6e7c8" ${ln(3.5)}/>
<circle cx="70" cy="100" r="21.5" fill="none" stroke="#b5382c" stroke-width="2" stroke-dasharray="3 3"/>
<g transform="translate(55 84) scale(.5)">${cornShapes()}</g>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* ICONS                                                               */
/* ------------------------------------------------------------------ */
function cornShapes() {
  const K = 'M32 5 C 45 5, 55 13, 53 25 C 51 39, 43 53, 35 58 Q 32 60 29 58 C 21 53, 13 39, 11 25 C 9 13, 19 5, 32 5 Z';
  return `<path d="${K}" fill="#f9c22e" ${ln(4)}/>
<path d="M44 10 C 53 16, 52 30, 47 40 C 44 47, 40 52, 36 55 C 41 44, 46 28, 44 10 Z" fill="#e39d14" ${NOSTROKE}/>
<path d="M32 28 C 37 28, 40 36, 38 44 C 37 49, 35 52, 32 52 C 29 52, 27 49, 26 44 C 24 36, 27 28, 32 28 Z" fill="#fff0b3" ${NOSTROKE}/>
<ellipse cx="22" cy="16" rx="5.5" ry="3.4" fill="#fffbe0" ${NOSTROKE} transform="rotate(-25 22 16)"/>
<path d="M28.5 57 Q 32 62 35.5 57" fill="#c9741a" ${ln(2.5)}/>
<path d="${K}" fill="none" ${ln(4)}/>`;
}

const ICONS = {
  corn: () => cornShapes(),
  sack: () => `
<path d="M14 58 C 6 52, 8 34, 20 26 L 44 26 C 56 34, 58 52, 50 58 C 40 62, 24 62, 14 58 Z" fill="#d8b07a" ${ln(3.5)}/>
<path d="M18 50 C 24 54, 40 54, 46 50" fill="none" ${ln(2, '#b48a54')}/>
<path d="M22 26 C 20 20, 26 16, 32 18 C 38 16, 44 20, 42 26 Z" fill="#c99a5f" ${ln(3)}/>
<path d="M20 27 Q 32 32 44 27" fill="none" ${ln(3.5, '#7a4b2c')}/>
<g transform="translate(22 4) scale(.32)">${cornShapes()}</g>
<g transform="translate(33 8) scale(.26) rotate(20 32 32)">${cornShapes()}</g>
<g transform="translate(26 40) scale(.3)"><path d="M12 18 C 12 6, 52 6, 52 18 C 52 34, 43 57, 32 59 C 21 57, 12 34, 12 18 Z" fill="#f9c22e" ${ln(6)}/></g>`,
  peck: () => `
<path d="M6 10 C 20 10, 36 18, 44 30 C 32 32, 18 28, 8 22 Z" fill="#f6b93b" ${ln(3.5)}/>
<path d="M8 22 C 18 28, 30 32, 42 32 C 32 38, 18 36, 8 28 Z" fill="#e89a26" ${ln(3)}/>
<path d="M48 38 L 52 34 M54 44 L 59 42 M46 46 L 47 51" fill="none" ${ln(3)}/>
<g transform="translate(30 36) scale(.42)">${cornShapes()}</g>`,
  forage: () => `
<g transform="translate(9 4) scale(.3)">${cornShapes()}</g>
<g transform="translate(22 0) scale(.32) rotate(15 32 32)">${cornShapes()}</g>
<g transform="translate(36 5) scale(.3) rotate(-10 32 32)">${cornShapes()}</g>
<path d="M6 28 L 58 28 L 52 58 C 40 61, 24 61, 12 58 Z" fill="#c48a4a" ${ln(3.5)}/>
<path d="M10 38 L 54 38 M11 48 L 53 48 M20 28 L 22 59 M32 28 L 32 60 M44 28 L 42 59" fill="none" ${ln(2.2, '#8f5d2b')}/>
<path d="M6 28 L 58 28" fill="none" ${ln(4)}/>`,
  barnstorm: () => `
<path d="M6 10 C 6 4, 58 4, 58 10 C 58 18, 6 18, 6 10 Z" fill="#9fb3c8" ${ln(3.5)}/>
<path d="M10 20 C 12 15, 52 15, 54 20 C 52 27, 12 27, 10 20 Z" fill="#8aa0b8" ${ln(3.5)}/>
<path d="M16 31 C 18 26, 46 26, 48 31 C 46 37, 18 37, 16 31 Z" fill="#9fb3c8" ${ln(3.5)}/>
<path d="M22 41 C 24 37, 40 37, 42 41 C 40 46, 24 46, 22 41 Z" fill="#8aa0b8" ${ln(3.5)}/>
<path d="M28 50 C 29 47, 37 47, 38 50 C 37 54, 29 54, 28 50 Z" fill="#9fb3c8" ${ln(3)}/>
<path d="M32 54 C 31 57, 32 60, 34 61" fill="none" ${ln(3)}/>
<path d="M50 30 L 58 27 M54 40 L 61 40" fill="none" ${ln(2.5, '#e8b04a')}/>
<path d="M4 34 L 10 32 M6 44 L 14 44" fill="none" ${ln(2.5, '#e8b04a')}/>`,
  crown: () => `
<path d="M8 48 L 6 18 L 20 32 L 32 12 L 44 32 L 58 18 L 56 48 Z" fill="#f9c22e" ${ln(3.5)}/>
<path d="M8 48 L 56 48 L 56 56 L 8 56 Z" fill="#e09b12" ${ln(3.5)}/>
<circle cx="32" cy="38" r="4.5" fill="#e63946" ${ln(2.5)}/>
<circle cx="18" cy="41" r="3" fill="#4fc3f7" ${ln(2)}/><circle cx="46" cy="41" r="3" fill="#4fc3f7" ${ln(2)}/>
<circle cx="6" cy="17" r="3" fill="#f9c22e" ${ln(2.2)}/><circle cx="32" cy="11" r="3" fill="#f9c22e" ${ln(2.2)}/><circle cx="58" cy="17" r="3" fill="#f9c22e" ${ln(2.2)}/>`,
  feather: () => `
<path d="M50 6 C 30 10, 14 30, 14 50 C 30 50, 50 34, 54 12 Z" fill="#f4f1e8" ${ln(3.5)}/>
<path d="M54 10 L 8 58" fill="none" ${ln(3.5)}/>
<path d="M44 20 L 36 18 M40 26 L 30 26 M34 34 L 24 34 M28 40 L 20 42" fill="none" ${ln(2, '#b9b3a3')}/>`,
  shield: () => `
<path d="M32 4 C 40 10, 50 12, 58 12 C 58 36, 50 52, 32 60 C 14 52, 6 36, 6 12 C 14 12, 24 10, 32 4 Z" fill="#4f86c6" ${ln(3.5)}/>
<path d="M32 10 C 38 14, 46 16, 52 16 C 51 34, 44 46, 32 53 Z" fill="#3a6aa8" ${NOSTROKE}/>
<path d="M21 32 L 29 40 L 44 24" fill="none" ${ln(5, '#fff')}/>
<path d="M32 4 C 40 10, 50 12, 58 12 C 58 36, 50 52, 32 60 C 14 52, 6 36, 6 12 C 14 12, 24 10, 32 4 Z" fill="none" ${ln(3.5)}/>`,
  eye: () => `
<path d="M4 32 C 14 16, 50 16, 60 32 C 50 48, 14 48, 4 32 Z" fill="#fff" ${ln(3.5)}/>
<circle cx="32" cy="32" r="11" fill="#f6b12b" ${ln(3)}/>
<circle cx="32" cy="32" r="5.5" fill="${INK}" ${NOSTROKE}/>
<circle cx="35" cy="29" r="2.2" fill="#fff" ${NOSTROKE}/>`,
  swap: () => `
<path d="M10 26 C 12 14, 24 8, 36 10 C 44 12, 50 16, 52 22" fill="none" ${ln(5)}/>
<path d="M44 20 L 54 26 L 58 14 Z" fill="${INK}" ${ln(3)}/>
<path d="M54 38 C 52 50, 40 56, 28 54 C 20 52, 14 48, 12 42" fill="none" ${ln(5)}/>
<path d="M20 44 L 10 38 L 6 50 Z" fill="${INK}" ${ln(3)}/>
<path d="M10 26 C 12 14, 24 8, 36 10 C 44 12, 50 16, 52 22" fill="none" ${ln(2.2, '#4caf7a')}/>
<path d="M54 38 C 52 50, 40 56, 28 54 C 20 52, 14 48, 12 42" fill="none" ${ln(2.2, '#ef7a2e')}/>`,
  deck: () => `
<rect x="20" y="8" width="30" height="42" rx="5" fill="#8f2a20" ${ln(3)} transform="rotate(12 35 29)"/>
<rect x="16" y="12" width="30" height="42" rx="5" fill="#a33024" ${ln(3)} transform="rotate(4 31 33)"/>
<rect x="12" y="14" width="30" height="42" rx="5" fill="#b5382c" ${ln(3)}/>
<path d="M17 19 L 37 51 M37 19 L 17 51" fill="none" stroke="#f6e7c8" stroke-width="3"/>
<circle cx="27" cy="35" r="6" fill="#f6e7c8" ${ln(2.2)}/>`,
  challenge: () => `
<path d="M32 3 L 38 13 L 50 7 L 49 20 L 61 23 L 52 32 L 61 41 L 49 44 L 50 57 L 38 51 L 32 61 L 26 51 L 14 57 L 15 44 L 3 41 L 12 32 L 3 23 L 15 20 L 14 7 L 26 13 Z" fill="#e63946" ${ln(3)}/>
<path d="M21 23 C 21 16, 33 15, 33 22 C 33 27, 27 28, 27 33" fill="none" ${ln(4.2, '#fff')}/>
<circle cx="27" cy="40" r="2.6" fill="#fff" ${NOSTROKE}/>
<path d="M42 17 L 41 33" fill="none" ${ln(4.6, '#fff')}/>
<circle cx="41" cy="40" r="2.6" fill="#fff" ${NOSTROKE}/>`,
  knockout: () => `
<path d="M32 6 C 46 6, 54 26, 54 38 C 54 52, 44 60, 32 60 C 20 60, 10 52, 10 38 C 10 26, 18 6, 32 6 Z" fill="#fbf4e4" ${ln(3.5)}/>
<path d="M11 33 L 19 28 L 25 35 L 32 27 L 39 35 L 45 28 L 53 33" fill="none" ${ln(3.5)}/>
<path d="M20 42 L 26 48 M26 42 L 20 48 M38 42 L 44 48 M44 42 L 38 48" fill="none" ${ln(3)}/>
<path d="M26 54 Q 32 51 38 54" fill="none" ${ln(2.5)}/>`,
};

export function iconSVG(name) {
  const fn = ICONS[name];
  if (!fn) return '';
  return `<svg class="po-icon po-icon-${name}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${fn()}</svg>`;
}
