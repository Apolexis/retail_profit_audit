import { useEffect, useState } from "react";

type OceanLoaderProps = { overlay?: boolean; label?: string };

type FishPath = { id: string; scale: number; angle: number };

const SCHOOL_PATHS: FishPath[] = [
  { id: "a", scale: .70, angle: 0 },
  { id: "b", scale: .53, angle: 45 },
  { id: "c", scale: .74, angle: 90 },
  { id: "d", scale: .49, angle: 135 },
  { id: "e", scale: .63, angle: 180 },
  { id: "f", scale: .56, angle: 225 },
  { id: "g", scale: .46, angle: 270 },
  { id: "h", scale: .40, angle: 315 },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function FishBody() {
  return <><path d="M42 11 C32 -4 15 -4 4 11 C15 26 32 26 42 11Z M6 11 L0 0 L1 22Z" />
    <circle className="facts-eye" cx="31" cy="5.7" r="2.2"/><circle className="facts-pupil" cx="31.4" cy="5.7" r=".92"/></>;
}

function OrbitFish({ id, scale, angle, reducedMotion }: FishPath & { reducedMotion: boolean }) {
  return <g className={`facts-fish facts-fish-${id}`}>
    <g transform={`rotate(${angle} 80 80)`}>
      {!reducedMotion && <animateTransform attributeName="transform" type="rotate" from={`${angle} 80 80`} to={`${angle + 360} 80 80`} dur="8.8s" begin="0s" repeatCount="indefinite" />}
      <g transform="translate(80 18)">
        <g className="facts-fish-size" transform={`scale(${scale})`}>
          <g className="facts-fish-body"><FishBody /></g>
        </g>
      </g>
    </g>
  </g>;
}

function FishSpinner({ className, label }: { className: string; label: string }) {
  const reducedMotion = useReducedMotion();
  return <section className={className} role="status" aria-live="polite"><p>{label}</p><svg className="facts-loader-art" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
    <g className="facts-school">{SCHOOL_PATHS.map(fish => <OrbitFish key={fish.id} {...fish} reducedMotion={reducedMotion}/>)}</g>
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
