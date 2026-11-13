// Classes are written out in full, so Tailwind finds them
export const brickColors = ["fill-red-500", "fill-yellow-400", "fill-blue-500", "fill-green-500", "fill-orange-400"];

const STUD = 20;
const HEIGHT = 29;

// One brick seen from the front, with its studs on top
const BrickShape = ({ studs, x = 0, y = 0, color }: { studs: number; x?: number; y?: number; color: string }) => (
  <g transform={`translate(${x} ${y})`} class={color}>
    {Array.from({ length: studs }, (_, index) => (
      <rect x={index * STUD + 4} width={12} height={7} rx={1.5} />
    ))}
    <rect y={5} width={studs * STUD} height={24} rx={2} />
    <rect y={23} width={studs * STUD} height={6} rx={2} class="fill-black/15" />
    <rect x={3} y={8} width={studs * STUD - 6} height={3} rx={1.5} class="fill-white/30" />
  </g>
);

/**
 * A single brick as a small decoration.
 */
export const Brick = ({ studs = 2, color, class: className }: { studs?: number; color: string; class?: string }) => (
  <svg viewBox={`0 0 ${studs * STUD} ${HEIGHT}`} class={className} aria-hidden="true">
    <BrickShape studs={studs} color={color} />
  </svg>
);

// Every entity type has a brick of its own, new types get the last one until they are listed here
const typeBricks: Record<string, { studs: number; color: string }> = {
  set: { studs: 4, color: "fill-red-500" },
  brand: { studs: 3, color: "fill-yellow-400" },
  wiki: { studs: 2, color: "fill-blue-500" },
  other: { studs: 2, color: "fill-green-500" },
};

export const TypeBrick = ({ type, class: className }: { type: string; class?: string }) => (
  <Brick {...(typeBricks[type] ?? typeBricks.other)} class={className} />
);

/**
 * A small build with one brick still falling into place.
 */
export const BrickPile = ({ class: className }: { class?: string }) => (
  <svg viewBox="0 -8 128 108" class={className} aria-hidden="true">
    <g transform="rotate(10 100 76)">
      <BrickShape studs={1} x={100} y={47} color="fill-orange-400" />
    </g>
    <BrickShape studs={6} y={71} color="fill-blue-500" />
    <BrickShape studs={4} x={20} y={47} color="fill-yellow-400" />
    <BrickShape studs={2} x={60} y={23} color="fill-green-500" />
    <g class="origin-center [transform-box:fill-box] motion-safe:animate-brick-drop">
      <BrickShape studs={2} x={20} y={23} color="fill-red-500" />
    </g>
  </svg>
);

/**
 * A few bricks that fell over, for pages with nothing to show.
 */
export const BrickSpill = ({ class: className }: { class?: string }) => (
  <svg viewBox="0 0 170 72" class={className} aria-hidden="true">
    <g transform="rotate(-9 40 71)">
      <BrickShape studs={4} x={4} y={36} color="fill-blue-500" />
    </g>
    <g transform="rotate(-32 80 20)">
      <BrickShape studs={1} x={72} y={4} color="fill-yellow-400" />
    </g>
    <BrickShape studs={2} x={92} y={43} color="fill-green-500" />
    <g transform="rotate(24 150 71)">
      <BrickShape studs={2} x={128} y={40} color="fill-red-500" />
    </g>
  </svg>
);

/**
 * A row of bricks in changing colors and lengths, as a divider.
 */
export const BrickRow = ({ class: className }: { class?: string }) => (
  <div class={`flex h-4 items-end overflow-hidden ${className ?? ""}`} aria-hidden="true">
    {Array.from({ length: 40 }, (_, index) => (
      <Brick studs={[2, 4, 1, 3][index % 4]} color={brickColors[index % brickColors.length]} class="h-full shrink-0" />
    ))}
  </div>
);
