type OceanLoaderProps = { overlay?: boolean; label?: string };

type FishPath = { id: string; x: number; y: number; rotation: number; scale: number };

// The base transform makes all fish visible at distinct orbital positions before
// SVG animation produces its first frame; it prevents the flash of stacked fish.
const SCHOOL_PATHS: FishPath[] = [
  { id: "a", x: 73, y: 10, rotation: 90, scale: .70 },
  { id: "b", x: 117, y: 32, rotation: 138, scale: .53 },
  { id: "c", x: 132, y: 75, rotation: 184, scale: .74 },
  { id: "d", x: 104, y: 119, rotation: 228, scale: .49 },
  { id: "e", x: 56, y: 124, rotation: 274, scale: .63 },
  { id: "f", x: 19, y: 90, rotation: 318, scale: .56 },
  { id: "g", x: 18, y: 47, rotation: 5, scale: .46 },
  { id: "h", x: 47, y: 19, rotation: 48, scale: .40 },
];

function OrbitFish({ id, x, y, rotation, scale }: FishPath) {
  return <g className={`facts-fish facts-fish-${id}`} transform={`translate(${x} ${y}) rotate(${rotation})`}>
      <g className="facts-fish-size" transform={`scale(${scale})`}>
        <g className="facts-fish-body">
          <path d="M42 11 C32 -4 15 -4 4 11 C15 26 32 26 42 11Z M6 11 L0 0 L1 22Z" />
          <circle className="facts-eye" cx="31" cy="5.7" r="2.2"/><circle className="facts-pupil" cx="31.4" cy="5.7" r=".92"/>
        </g>
      </g>
  </g>;
}

function FishSpinner({ className, label }: { className: string; label: string }) {
  return <section className={className} role="status" aria-live="polite"><p>{label}</p><svg className="facts-loader-art" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
    <g className="facts-school">{SCHOOL_PATHS.map(fish => <OrbitFish key={fish.id} {...fish}/>)}</g>
  </svg></section>;
}

/** Загрузчик перехода между разделами: компактный круговой косяк. */
export function OceanLoader({ overlay = false, label = "Загружаем раздел…" }: OceanLoaderProps) {
  return <FishSpinner className={overlay ? "facts-loader ocean-loader overlay" : "facts-loader ocean-loader"} label={label}/>;
}

/** Компактный индикатор ожидания фактов. */
export function FactsLoader({ label = "Загружаем факты…" }: { label?: string }) {
  return <FishSpinner className="facts-loader" label={label}/>;
}
