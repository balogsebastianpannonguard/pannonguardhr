"use client";

import { startTransition, useEffect, useRef, useState, type FormEvent } from "react";

/** A szerverműveletek kéréskorlátja 4,5 MB; a fájlokra 4 MB jut, a maradék a többi mezőé. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Ha a kiválasztott fájlok együtt túl nagyok, a hibaüzenet; különben `undefined`. */
export function uploadTooBig(form: HTMLFormElement) {
  const total = [...form.querySelectorAll<HTMLInputElement>('input[type="file"]')]
    .flatMap((input) => [...(input.files ?? [])])
    .reduce((sum, file) => sum + file.size, 0);
  return total > MAX_UPLOAD_BYTES
    ? `A kiválasztott fájl(ok) mérete ${(total / 1024 / 1024).toFixed(1).replace(".", ",")} MB, legfeljebb 4 MB tölthető fel egyszerre. Válassz kisebb vagy kevesebb fájlt.`
    : undefined;
}

/**
 * A React 19 a `<form action>` után minden mezőt visszaállít – hibás válasznál is (eltűnik a beírt szöveg), a
 * `<select>` pedig a betöltéskori értékére ugrik vissza. Ezzel a segéddel a beküldés megtartja a mezőket;
 * `resetOnOk` esetén (új tétel felvétele) csak sikeres mentés után ürül az űrlap. A `check` a küldés előtti
 * kliensoldali ellenőrzés (pl. fájlméret); hibaüzenete a `clientError`-ban jelenik meg.
 */
export function useKeepForm(
  dispatch: (formData: FormData) => void,
  state: { ok?: boolean },
  { resetOnOk = false, check, onReset }: { resetOnOk?: boolean; check?: (form: HTMLFormElement) => string | undefined; onReset?: () => void } = {},
) {
  const ref = useRef<HTMLFormElement>(null);
  const previous = useRef(state);
  const resetHandler = useRef(onReset);
  const [clientError, setClientError] = useState<string>();

  useEffect(() => {
    resetHandler.current = onReset;
  });

  useEffect(() => {
    if (state !== previous.current && state.ok && resetOnOk) {
      ref.current?.reset();
      resetHandler.current?.();
    }
    previous.current = state;
  }, [state, resetOnOk]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const problem = check?.(form);
    setClientError(problem);
    if (problem) return;
    const formData = new FormData(form, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(formData));
  }

  return { ref, onSubmit, clientError, clearClientError: () => setClientError(undefined) };
}
