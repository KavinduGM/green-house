// Procedural 2D plant drawing. Scales vertically by the plant's height so two
// plants drawn with the same `scaleMaxCm` are visually comparable. Shape adapts
// to the crop form (bush / vine / herb / root / tree) and growth stage.

interface Props {
  form: string;
  heightCm: number;
  scaleMaxCm: number;        // shared scale across compared plants
  leafColor: string;
  fruitColor: string;
  stage: string;             // seed | vegetative | flowering | fruiting | mature
  width?: number;
  height?: number;
}

const VB_H = 150;
const GROUND_Y = 132;

export default function PlantSprite({ form, heightCm, scaleMaxCm, leafColor, fruitColor, stage, width = 120, height = 150 }: Props) {
  const frac = Math.max(0.04, Math.min(1, heightCm / Math.max(1, scaleMaxCm)));
  const drawableTop = 14;
  const px = (GROUND_Y - drawableTop) * frac;       // pixel height of the plant
  const topY = GROUND_Y - px;
  const cx = 60;
  const hasFruit = stage === 'fruiting' || stage === 'mature';
  const hasFlower = stage === 'flowering' || hasFruit;
  const seed = stage === 'seed';

  const leaf = (x: number, y: number, s: number, rot: number, color = leafColor) => (
    <path
      d={`M0,0 C ${6 * s},${-5 * s} ${14 * s},${-5 * s} ${18 * s},0 C ${14 * s},${5 * s} ${6 * s},${5 * s} 0,0 Z`}
      fill={color}
      transform={`translate(${x},${y}) rotate(${rot})`}
      opacity={0.95}
    />
  );
  const fruit = (x: number, y: number, r: number) => (
    <circle cx={x} cy={y} r={r} fill={fruitColor} stroke="rgba(0,0,0,.08)" />
  );
  const flower = (x: number, y: number) => (
    <g transform={`translate(${x},${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-3} rx={1.7} ry={3} fill="#fff7d6" stroke="#f2dd8f" strokeWidth={0.3} transform={`rotate(${a})`} />
      ))}
      <circle r={1.6} fill="#f4c430" />
    </g>
  );

  const nodes = Math.max(2, Math.round(px / 16));

  return (
    <svg viewBox={`0 0 120 ${VB_H}`} width={width} height={height} role="img">
      {/* pot / grow bag */}
      <path d={`M${cx - 22},${GROUND_Y} L${cx - 18},${GROUND_Y + 14} L${cx + 18},${GROUND_Y + 14} L${cx + 22},${GROUND_Y} Z`} fill="#6b5440" />
      <ellipse cx={cx} cy={GROUND_Y} rx={22} ry={4} fill="#4f3b2b" />
      <ellipse cx={cx} cy={GROUND_Y - 0.5} rx={18} ry={3} fill="#3a2a1e" />

      {seed ? (
        <g>{leaf(cx, GROUND_Y - 6, 0.4, -30)}{leaf(cx, GROUND_Y - 6, 0.4, 210)}<circle cx={cx} cy={GROUND_Y - 2} r={2} fill="#8a6f4f" /></g>
      ) : form === 'root' ? (
        <g>
          {/* foliage above, bulb below */}
          {Array.from({ length: 5 }).map((_, i) => leaf(cx, GROUND_Y - 4, 0.5 + frac * 0.3, -90 + (i - 2) * 28))}
          <path d={`M${cx - 7},${GROUND_Y + 2} Q${cx},${GROUND_Y + 6 + px * 0.5} ${cx},${GROUND_Y + 10 + px * 0.6} Q${cx},${GROUND_Y + 6 + px * 0.5} ${cx + 7},${GROUND_Y + 2} Z`} fill={fruitColor} />
        </g>
      ) : form === 'tree' ? (
        <g>
          <rect x={cx - 3} y={topY + px * 0.45} width={6} height={px * 0.55} rx={2} fill="#7a5a3c" />
          <circle cx={cx} cy={topY + px * 0.35} r={Math.max(14, px * 0.42)} fill={leafColor} />
          <circle cx={cx - px * 0.28} cy={topY + px * 0.5} r={Math.max(10, px * 0.3)} fill={leafColor} opacity={0.9} />
          <circle cx={cx + px * 0.28} cy={topY + px * 0.5} r={Math.max(10, px * 0.3)} fill={leafColor} opacity={0.9} />
          {hasFruit && Array.from({ length: 6 }).map((_, i) => fruit(cx - 14 + i * 6, topY + px * 0.3 + (i % 2) * 10, 3))}
        </g>
      ) : form === 'herb' ? (
        <g>
          {Array.from({ length: nodes * 2 }).map((_, i) => {
            const t = i / (nodes * 2);
            return leaf(cx, GROUND_Y - 4 - px * t, 0.55, -90 + (i % 2 ? 35 : -35) - t * 10);
          })}
          {hasFlower && form === 'herb' && flower(cx, topY)}
        </g>
      ) : (
        <g>
          {/* stem */}
          <path d={`M${cx},${GROUND_Y} C ${cx - 4},${GROUND_Y - px * 0.4} ${cx + 4},${GROUND_Y - px * 0.7} ${cx},${topY}`}
            stroke="#3f6e42" strokeWidth={form === 'vine' ? 1.8 : 2.6} fill="none" strokeLinecap="round" />
          {Array.from({ length: nodes }).map((_, i) => {
            const t = (i + 1) / (nodes + 1);
            const y = GROUND_Y - px * t;
            const s = (form === 'vine' ? 0.6 : 0.85) * (0.7 + 0.5 * (1 - t));
            return (
              <g key={i}>
                {leaf(cx, y, s, 200 + (t * 10))}
                {leaf(cx, y, s, -20 - (t * 10))}
                {hasFruit && i % 2 === 0 && fruit(cx + (i % 4 === 0 ? 9 : -9), y + 3, form === 'vine' ? 3.2 : 4)}
                {hasFlower && !hasFruit && i % 2 === 0 && flower(cx + (i % 4 === 0 ? 8 : -8), y)}
              </g>
            );
          })}
          {/* growing tip */}
          {leaf(cx, topY, 0.5, -90)}
        </g>
      )}
    </svg>
  );
}
