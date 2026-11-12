import type { CSSProperties } from "react";

/** Rövid konfettiszórás a sikeres bejelentés után (csökkentett mozgásnál a CSS kikapcsolja). */
export function Confetti() {
  const colors = ["#f8d4c6", "#e9679b", "#e8a796", "#f7a8c8", "#8fa2ff", "#fff"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
      {Array.from({ length: 22 }, (_, index) => {
        const angle = (index / 22) * Math.PI * 2;
        const distance = 70 + ((index * 37) % 70);
        return (
          <span
            key={index}
            className="absolute size-2 rounded-[2px]"
            style={
              {
                background: colors[index % colors.length],
                "--dx": `${Math.cos(angle) * distance}px`,
                "--dy": `${Math.sin(angle) * distance - 30}px`,
                "--rot": `${(index * 97) % 540}deg`,
                animation: "pg-confetti 1.1s cubic-bezier(0.2,0.7,0.3,1) both",
                animationDelay: `${(index % 5) * 30}ms`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
