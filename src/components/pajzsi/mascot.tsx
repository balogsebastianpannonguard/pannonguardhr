export type Mood = "idle" | "think" | "talk" | "happy";

import { useId } from "react";

/**
 * Pajzsi, a HR védőangyala: rosegold pajzs-test, pink masni, szempillás élő arc. Pislog; gondolkodáskor felfelé néz
 * és pöttyök jelennek meg, beszéléskor mozog a szája, örömkor mosolygó szemei és szívecskéi vannak. Tiszta SVG.
 */
export function Mascot({ size = 56, mood = "idle", float = false }: { size?: number; mood?: Mood; float?: boolean }) {
  // Egyedi azonosító a színátmenetekhez, hogy több figura egymás mellett se ütközzön.
  const id = `pzi${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const look = mood === "think" ? { x: 1.3, y: -1.3 } : { x: 0.6, y: 0.5 };
  const eye = (cx: number, flip: 1 | -1) => (
    <g className="pg-blink">
      <circle cx={cx} cy="35.5" r="3.4" fill="#fff" />
      <circle cx={cx + look.x} cy={35.5 + look.y} r="1.8" fill="#10152e" />
      <circle cx={cx + 0.5 + look.x} cy={34.8 + look.y} r="0.6" fill="#fff" />
      {/* szempillák */}
      <path
        d={`M${cx - 3.2 * flip} 33.2 l${-1.6 * flip} -1.6 M${cx - 1.4 * flip} 32.3 l${-0.9 * flip} -1.9`}
        stroke="#10152e"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </g>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Pajzsi, a HR védőangyala"
      className={float ? "pg-float" : undefined}
      overflow="visible"
    >
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#f6c7b8" />
          <stop offset="0.5" stopColor="#d98a8f" />
          <stop offset="1" stopColor="#1c2350" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe1d6" />
          <stop offset="1" stopColor="#e8a796" />
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7a8c8" />
          <stop offset="1" stopColor="#e9679b" />
        </linearGradient>
        <radialGradient id={`${id}s`} cx="0.3" cy="0.2" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* pajzs-test */}
      <path
        d="M32 5.5 55 13v17.5c0 14.5-9.8 24.5-23 28.5C18.8 55 9 45 9 30.5V13L32 5.5Z"
        fill={`url(#${id}b)`}
        stroke={`url(#${id}g)`}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M32 9 51.5 15v15c0 12.5-8.4 21-19.5 24.6" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="22" cy="21" rx="12" ry="9" fill={`url(#${id}s)`} />

      {/* masni */}
      <g transform="translate(32 13)">
        <path d="M0 0 C-4 -6 -12 -6 -12 0 C-12 6 -4 6 0 0Z" fill={`url(#${id}p)`} stroke="#10152e" strokeOpacity="0.25" strokeWidth="0.8" />
        <path d="M0 0 C4 -6 12 -6 12 0 C12 6 4 6 0 0Z" fill={`url(#${id}p)`} stroke="#10152e" strokeOpacity="0.25" strokeWidth="0.8" />
        <path d="M-7.5 -1.5c1.5-1.6 3.4-1.8 4.6-.6M7.5 -1.5c-1.5-1.6-3.4-1.8-4.6-.6" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.9" strokeLinecap="round" />
        <circle r="2.6" fill="#f8d4c6" stroke="#e9679b" strokeWidth="1" />
      </g>

      {/* szemek */}
      {mood === "happy" ? (
        <>
          <path d="M21.5 36.5c1.2-2.8 4.8-2.8 6 0" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M36.5 36.5c1.2-2.8 4.8-2.8 6 0" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          {eye(24.5, 1)}
          {eye(39.5, -1)}
        </>
      )}
      {mood === "think" && <path d="M36 29.5c2-1.6 5-1.8 7.2-.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />}

      {/* arc: pír és száj */}
      <ellipse cx="19.5" cy="42" rx="2.8" ry="2.1" fill="#ff7fae" opacity={mood === "happy" ? 0.8 : 0.5} />
      <ellipse cx="44.5" cy="42" rx="2.8" ry="2.1" fill="#ff7fae" opacity={mood === "happy" ? 0.8 : 0.5} />
      {mood === "talk" ? (
        <ellipse className="pg-talk" cx="32" cy="45" rx="3.4" ry="3" fill="#7a1f45" stroke="#fff" strokeWidth="1.4" />
      ) : mood === "think" ? (
        <path d="M28.5 45.5h7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <path d="M26.5 43.5c2.2 3.4 8.8 3.4 11 0" fill="#7a1f45" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* gondolkodás pöttyei és örömszívecskék */}
      {mood === "think" && (
        <g fill="#f7a8c8">
          {[0, 1, 2].map((n) => (
            <circle key={n} className="pg-dot" cx={46 + n * 5.5} cy={9 - n * 2} r={1.6 + n * 0.5} style={{ animationDelay: `${n * 0.2}s` }} />
          ))}
        </g>
      )}
      {mood === "happy" && (
        <g fill="#f7a8c8">
          <path className="pg-dot" d="M53 16c-3-2.2-5-3.8-5-5.8 0-1.4 1.1-2.4 2.4-2.4.9 0 1.9.5 2.6 1.4.7-.9 1.7-1.4 2.6-1.4 1.3 0 2.4 1 2.4 2.4 0 2-2 3.6-5 5.8Z" />
          <path className="pg-dot" style={{ animationDelay: "0.4s" }} d="M10 20c-2.2-1.6-3.6-2.8-3.6-4.2 0-1 .8-1.8 1.8-1.8.7 0 1.3.4 1.8 1 .5-.6 1.1-1 1.8-1 1 0 1.8.8 1.8 1.8 0 1.4-1.4 2.6-3.6 4.2Z" />
        </g>
      )}
    </svg>
  );
}
