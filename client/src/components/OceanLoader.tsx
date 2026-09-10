type OceanLoaderProps = { overlay?: boolean; label?: string };

type FishPath = { id: string; begin: string; duration: string; scale: number };

const SCHOOL_RING = "M80 18 A62 62 0 1 1 80 142 A62 62 0 1 1 80 18";

const SCHOOL_PATHS: FishPath[] = [
  { id: "a", begin: "0s", duration: "8.8s", scale: .70 },
  { id: "b", begin: "-1.10s", duration: "8.8s", scale: .53 },
  { id: "c", begin: "-2.20s", duration: "8.8s", scale: .74 },
  { id: "d", begin: "-3.30s", duration: "8.8s", scale: .49 },
  { id: "e", begin: "-4.40s", duration: "8.8s", scale: .63 },
  { id: "f", begin: "-5.50s", duration: "8.8s", scale: .56 },
  { id: "g", begin: "-6.60s", duration: "8.8s", scale: .46 },
  { id: "h", begin: "-7.70s", duration: "8.8s", scale: .40 },
];

function OrbitFish({ id, begin, duration, scale }: FishPath) {
  return <g className={`facts-fish facts-fish-${id}`}>
    <animateMotion path={SCHOOL_RING} dur={duration} begin={begin} repeatCount="indefinite" rotate="auto" />
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
