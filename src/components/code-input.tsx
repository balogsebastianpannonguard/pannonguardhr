"use client";

import { useState } from "react";

/** Hatjegyű kód beviteli mező; hat számjegynél magától elküldi az űrlapot. */
export function CodeInput({ disabled }: { disabled?: boolean }) {
  const [value, setValue] = useState("");

  return (
    <div className="relative">
      <input
        name="code"
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
          setValue(digits);
          if (digits.length === 6) event.target.form?.requestSubmit();
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        pattern="\d{6}"
        maxLength={6}
        disabled={disabled}
        aria-label="Hatjegyű kód"
        className="pg-field pg-input h-16 w-full rounded-2xl text-center font-display text-3xl font-semibold tracking-[0.6em] text-white caret-rose placeholder:text-white/15"
        placeholder="••••••"
      />
    </div>
  );
}
