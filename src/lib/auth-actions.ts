"use server";

import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import {
  addEvent,
  checkInvitationToken,
  checkResetToken,
  getAccessState,
  markLogin,
  markTotpEnabled,
  needsTotpReset,
  redeemInvitation,
  redeemResetToken,
  requestTotpResetFor,
  undoRedeem,
} from "@/lib/invitations";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { open, seal } from "@/lib/secret-box";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  getPendingSession,
  getSession,
  registerCodeFailure,
  requireUser,
} from "@/lib/session";
import { clearAttempts, registerAttempt } from "@/lib/throttle";
import { generateTotpSecret, verifyTotp } from "@/lib/totp";
import { consumeTotpStep, findUserByEmail, findUserById, users } from "@/lib/users";

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/* ---------- Regisztráció ---------- */

export type RegisterState = { error?: string; name?: string };

export async function register(
  _previous: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const token = field(formData, "token");
  const name = field(formData, "name").trim().replace(/\s+/g, " ");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  try {
    const invitation = await checkInvitationToken(token);
    if (invitation.status !== "valid") {
      return { error: "Ez a meghívó már nem érvényes. Kérj újat az adminisztrátortól.", name };
    }
    if (name.length < 4 || name.length > 80 || !name.includes(" ")) {
      return { error: "Add meg a teljes neved (vezeték- és keresztnév).", name };
    }
    const problem = passwordProblem(password, invitation.email);
    if (problem) return { error: problem, name };
    if (password !== confirm) return { error: "A két jelszó nem egyezik.", name };

    const passwordHash = await hashPassword(password);
    const redeemed = await redeemInvitation(token, name);
    if (!redeemed) {
      return { error: "Ez a meghívó közben érvénytelenné vált.", name };
    }

    let userId;
    try {
      const inserted = await (await users()).insertOne({
        _id: new ObjectId(),
        email: redeemed.email.toLowerCase(),
        name,
        passwordHash,
        totpSecret: seal(generateTotpSecret()),
        invitationId: redeemed._id,
        invitedBy: redeemed.invitedBy,
        createdAt: new Date(),
      });
      userId = inserted.insertedId;
    } catch (error) {
      await undoRedeem(redeemed._id);
      const duplicate = (error as { code?: number }).code === 11000;
      return {
        error: duplicate
          ? "Ezzel az e-mail-címmel már van fiók. Lépj be inkább."
          : "A regisztráció átmenetileg nem érhető el.",
        name,
      };
    }

    await recordAudit("register", redeemed.email, userId);
    await createSession(userId, redeemed._id, "setup");
  } catch (error) {
    console.error("Regisztrációs hiba:", (error as Error).name);
    return { error: "A regisztráció átmenetileg nem érhető el.", name };
  }
  redirect("/ketfaktor");
}

/* ---------- Hitelesítő beállítása ---------- */

export type CodeState = { error?: string; expired?: boolean };

export async function confirmTotpSetup(
  _previous: CodeState,
  formData: FormData,
): Promise<CodeState> {
  try {
    const session = await getPendingSession("setup");
    if (!session) return { expired: true, error: "A beállítás ideje lejárt. Lépj be újra." };
    const user = await findUserById(session.userId);
    if (!user) return { expired: true, error: "A fiók nem található." };

    const step = verifyTotp(open(user.totpSecret), field(formData, "code"), user.lastTotpStep);
    if (step === null) {
      const canRetry = await registerCodeFailure(session);
      await recordAudit("totp.failure", user.email, user._id);
      return canRetry
        ? { error: "A kód nem megfelelő. Nézd meg az alkalmazásban a legfrissebbet." }
        : { expired: true, error: "Túl sok hibás kód. Lépj be újra." };
    }

    const now = new Date();
    if (!(await consumeTotpStep(user._id, step, { totpEnabledAt: now, lastLoginAt: now }))) {
      return { error: "Ezt a kódot már felhasználtad, várd meg a következőt." };
    }
    await Promise.all([
      markTotpEnabled(user.invitationId),
      markLogin(user.invitationId),
      recordAudit("totp.enabled", user.email, user._id),
    ]);
    await recordAudit("login.success", user.email, user._id);
    await createSession(user._id, user.invitationId, "full");
  } catch (error) {
    console.error("Hitelesítő beállítási hiba:", (error as Error).name);
    return { error: "A beállítás átmenetileg nem érhető el." };
  }
  redirect("/?udv=1");
}

/* ---------- Belépés ---------- */

export type LoginState = { step: "password" | "code"; error?: string; email?: string };

export async function login(previous: LoginState, formData: FormData): Promise<LoginState> {
  return field(formData, "intent") === "code"
    ? verifyLoginCode(previous, formData)
    : verifyLoginPassword(formData);
}

async function verifyLoginPassword(formData: FormData): Promise<LoginState> {
  const email = field(formData, "email").trim().toLowerCase().slice(0, 254);
  const password = field(formData, "password");
  let next: "/ketfaktor" | null = null;

  try {
    if (!(await registerAttempt(`login:${email}`))) {
      await recordAudit("login.locked", email);
      return { step: "password", email, error: "Túl sok próbálkozás. Próbáld újra 15 perc múlva." };
    }
    const user = await findUserByEmail(email);
    const passwordOk = await verifyPassword(password, user?.passwordHash);
    if (!user || !passwordOk) {
      await recordAudit("login.failure", email, user?._id);
      return { step: "password", email, error: "Hibás e-mail-cím vagy jelszó." };
    }
    const access = await getAccessState(user.invitationId);
    if (access.revoked) {
      return { step: "password", email, error: "A hozzáférésedet visszavonták." };
    }
    await clearAttempts(`login:${email}`);

    let totpEnabled = Boolean(user.totpEnabledAt);
    if (needsTotpReset(access.totpResetAt, user.totpEnabledAt)) {
      // Az adminisztrátor visszaállította a hitelesítőt: új kulcs, új beállítás.
      await (await users()).updateOne(
        { _id: user._id },
        {
          $set: { totpSecret: seal(generateTotpSecret()) },
          $unset: { totpEnabledAt: "", lastTotpStep: "" },
        },
      );
      totpEnabled = false;
    }

    if (!totpEnabled) {
      await createSession(user._id, user.invitationId, "setup");
      next = "/ketfaktor";
    } else {
      await createSession(user._id, user.invitationId, "mfa");
    }
  } catch (error) {
    console.error("Belépési hiba:", (error as Error).name);
    return { step: "password", email, error: "A belépés átmenetileg nem érhető el." };
  }
  if (next) redirect(next);
  return { step: "code", email };
}

async function verifyLoginCode(previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = previous.email;
  try {
    const session = await getPendingSession("mfa");
    if (!session) {
      return { step: "password", email, error: "A belépés ideje lejárt, kezdd újra." };
    }
    const user = await findUserById(session.userId);
    if (!user) return { step: "password", email, error: "A fiók nem található." };

    const step = verifyTotp(open(user.totpSecret), field(formData, "code"), user.lastTotpStep);
    if (step === null || !(await consumeTotpStep(user._id, step, { lastLoginAt: new Date() }))) {
      await recordAudit("totp.failure", user.email, user._id);
      const canRetry = await registerCodeFailure(session);
      return canRetry
        ? { step: "code", email, error: "A kód nem megfelelő vagy már felhasználtad." }
        : { step: "password", email, error: "Túl sok hibás kód. Kezdd újra a belépést." };
    }

    await Promise.all([
      markLogin(user.invitationId),
      recordAudit("login.success", user.email, user._id),
    ]);
    await createSession(user._id, user.invitationId, "full");
  } catch (error) {
    console.error("Kódellenőrzési hiba:", (error as Error).name);
    return { step: "code", email, error: "A belépés átmenetileg nem érhető el." };
  }
  redirect("/");
}

export async function cancelLogin() {
  await destroySession();
  redirect("/login");
}

/* ---------- Kijelentkezés ---------- */

export async function logout() {
  const session = await getSession();
  if (session?.stage === "full") {
    const user = await findUserById(session.userId);
    if (user) await recordAudit("logout", user.email, user._id);
  }
  await destroySession();
  redirect("/login?ok=kilepve");
}

export async function logoutEverywhere() {
  const user = await requireUser();
  await recordAudit("logout.all", user.email, user.session.userId);
  await destroyAllSessions(user.session.userId);
  await destroySession();
  redirect("/login?ok=mindenhol");
}


/* ---------- Jelszó-visszaállítás (az elosztóból kapott linkkel) ---------- */

export type ResetState = { error?: string };

export async function resetPassword(_previous: ResetState, formData: FormData): Promise<ResetState> {
  const token = field(formData, "token");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  try {
    const check = await checkResetToken(token);
    if (check.status !== "valid") {
      return { error: "Ez a link már nem érvényes. Kérj újat az adminisztrátortól." };
    }
    const problem = passwordProblem(password, check.email);
    if (problem) return { error: problem };
    if (password !== confirm) return { error: "A két jelszó nem egyezik." };

    const passwordHash = await hashPassword(password);
    const redeemed = await redeemResetToken(token);
    if (!redeemed) return { error: "Ez a link közben érvénytelenné vált. Kérj újat." };

    const user = await findUserByEmail(redeemed.email);
    if (!user) return { error: "A fiók nem található. Fordulj az adminisztrátorhoz." };

    // Az új jelszó beállítása után a régi munkamenetek megszűnnek, a belépési zár is feloldódik.
    await (await users()).updateOne({ _id: user._id }, { $set: { passwordHash } });
    await destroyAllSessions(user._id);
    await clearAttempts(`login:${user.email}`);
    // „Jelszó + hitelesítő” esetén a következő belépéskor új hitelesítőt is be kell állítani.
    if (redeemed.resetKind === "both") await requestTotpResetFor(redeemed._id);
    await Promise.all([
      recordAudit("password.reset", user.email, user._id),
      addEvent(redeemed._id, "password.changed", "felhasználó", redeemed.resetKind === "both" ? "új hitelesítő is szükséges" : undefined),
    ]);
  } catch (error) {
    console.error("Jelszó-visszaállítási hiba:", (error as Error).name);
    return { error: "A művelet átmenetileg nem érhető el." };
  }
  redirect("/login?ok=jelszocsere");
}
