import { useEffect, useState } from "react";

type OceanLoaderProps = { overlay?: boolean; label?: string };

type FishPath = { id: string; begin: string; duration: string; scale: number; firstFrameTransform: string };

const SCHOOL_RING = "M80 18 A62 62 0 1 1 80 142 A62 62 0 1 1 80 18";

// This is the exact orbit timing from 1c6f03bd.
const SCHOOL_PATHS: FishPath[] = [
  { id: "a", begin: "0s", duration: "8.8s", scale: .70, firstFrameTransform: "translate(80 18) rotate(0)" },
  { id: "b", begin: "-1.10s", duration: "8.8s", scale: .53, firstFrameTransform: "translate(124 36) rotate(45)" },
  { id: "c", begin: "-2.20s", duration: "8.8s", scale: .74, firstFrameTransform: "translate(142 80) rotate(90)" },
  { id: "d", begin: "-3.30s", duration: "8.8s", scale: .49, firstFrameTransform: "translate(124 124) rotate(135)" },
  { id: "e", begin: "-4.40s", duration: "8.8s", scale: .63, firstFrameTransform: "translate(80 142) rotate(180)" },
  { id: "f", begin: "-5.50s", duration: "8.8s", scale: .56, firstFrameTransform: "translate(36 124) rotate(225)" },
  { id: "g", begin: "-6.60s", duration: "8.8s", scale: .46, firstFrameTransform: "translate(18 80) rotate(270)" },
  { id: "h", begin: "-7.70s", duration: "8.8s", scale: .40, firstFrameTransform: "translate(36 36) rotate(315)" },
];

function FishBody() {
  return <><path d="M42 11 C32 -4 15 -4 4 11 C15 26 32 26 42 11Z M6 11 L0 0 L1 22Z" />
    <circle className="facts-eye" cx="31" cy="5.7" r="2.2"/><circle className="facts-pupil" cx="31.4" cy="5.7" r=".92"/></>;
}

function OrbitFish({ id, begin, duration, scale }: FishPath) {
  return <g className={`facts-fish facts-fish-${id}`}>
      <animateMotion path={SCHOOL_RING} dur={duration} begin={begin} repeatCount="indefinite" rotate="auto" />
      <g className="facts-fish-size" transform={`scale(${scale})`}>
        <g className="facts-fish-body">
          <FishBody />
        </g>
      </g>
  </g>;
}

function FirstFrameFish({ id, scale, firstFrameTransform }: FishPath) {
  return <g className={`facts-fish facts-fish-first-frame facts-fish-${id}`} transform={firstFrameTransform}>
    <g className="facts-fish-size" transform={`scale(${scale})`}><g className="facts-fish-body"><FishBody /></g></g>
  </g>;
}

function FishSpinner({ className, label }: { className: string; label: string }) {
  const [motionReady, setMotionReady] = useState(false);
  useEffect(() => {
    let frame = 0;
    let nextFrame = 0;
    let timer = 0;
    frame = window.requestAnimationFrame(() => {
      nextFrame = window.requestAnimationFrame(() => {
        timer = window.setTimeout(() => setMotionReady(true), 64);
      });
    });
    return () => { window.cancelAnimationFrame(frame); window.cancelAnimationFrame(nextFrame); window.clearTimeout(timer); };
  }, []);
  return <section className={className} role="status" aria-live="polite"><p>{label}</p><svg className="facts-loader-art" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
    <g className={motionReady ? "facts-school is-ready" : "facts-school"}>{SCHOOL_PATHS.map(fish => <OrbitFish key={fish.id} {...fish}/>)}</g>
    {!motionReady && <g className="facts-school-first-frame">{SCHOOL_PATHS.map(fish => <FirstFrameFish key={fish.id} {...fish}/>)}</g>}
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
