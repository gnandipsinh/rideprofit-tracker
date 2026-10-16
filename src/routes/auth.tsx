import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MailOpen,
  Phone,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  GENERIC_CREDENTIALS_ERROR,
  GENERIC_ERROR,
  RESEND_COOLDOWN_SECONDS,
  codeSchema,
  emailSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  safeAuthMessage,
  sendLoginCode,
  sendRecoveryEmail,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Jay Mataji Transport — Fleet Accounting" },
      {
        name: "description",
        content: "Sign in to access your fleet accounting dashboard.",
      },
      { property: "og:title", content: "Jay Mataji Transport — Fleet Accounting" },
      {
        property: "og:description",
        content: "Secure fleet accounting for Jay Mataji Transport.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Step = "login" | "register" | "email-login" | "code" | "forgot" | "reset";
type CodePurpose = "login" | "reset";
type Errors = Record<string, string>;

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  placeholder = "••••••••",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  autoComplete?: string | undefined;
  placeholder?: string | undefined;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-12 pl-9 pr-11 rounded-xl bg-secondary/60 text-base",
            error && "border-destructive focus-visible:ring-destructive",
          )}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: typeof Mail;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          {...rest}
          className={cn(
            "h-12 pl-9 rounded-xl bg-secondary/60 text-base",
            error && "border-destructive focus-visible:ring-destructive",
          )}
        />
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("login");
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [codePurpose, setCodePurpose] = useState<CodePurpose>("login");
  const [code, setCode] = useState("");
  const [codeNotice, setCodeNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    // If a session already exists there is nothing to do on this screen.
    supabase.auth.getUser().then((res: { data: { user: unknown } }) => {
      if (res.data?.user) {
        void Promise.resolve(navigate({ to: "/", replace: true })).catch(() => undefined);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("reset");
      } else if (event === "SIGNED_IN") {
        // Single navigation point — runs outside any submit handler so a
        // router redirect can never surface as a form error.
        void Promise.resolve(navigate({ to: "/", replace: true })).catch(() => undefined);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  function reset(next: Step) {
    setErrors({});
    setFormError("");
    setCode("");
    setCodeNotice("");
    setStep(next);
  }

  function zodErrors(issues: { path: (string | number)[]; message: string }[]): Errors {
    const out: Errors = {};
    for (const i of issues) {
      const key = String(i.path[0] ?? "form");
      if (!out[key]) out[key] = i.message;
    }
    return out;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError("");
    const parsed = registerSchema.safeParse({ fullName, mobile, email, password, confirmPassword });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error.issues));
      return;
    }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    let succeeded = false;
    try {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.fullName, mobile: parsed.data.mobile },
        },
      });
      if (error) {
        // Show the actual server error message directly (duplicate email, etc.)
        setFormError(error.message || GENERIC_ERROR);
        return;
      }
      succeeded = true;
      setPassword("");
      setConfirmPassword("");
      toast.success("Account created successfully! Welcome to Jay Mataji Transport.");
      // Navigation happens in the SIGNED_IN subscriber (outside this try/catch),
      // so a router redirect can never be misreported as an error here.
    } catch {
      if (succeeded) return; // redirect raised after a successful registration
      setFormError(GENERIC_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  /**
   * Shared sender for both the email-login code and the password-reset code.
   * The server's response never tells us whether the account exists.
   * Returns true when the code step should be shown.
   */
  async function sendCode(purpose: CodePurpose, opts: { resend?: boolean } = {}): Promise<boolean> {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setErrors({ email: parsed.error.issues[0]?.message ?? "Enter a valid email" });
      return false;
    }
    if (requestInFlight.current) return false;
    requestInFlight.current = true;
    setBusy(true);
    try {
      const res =
        purpose === "login"
          ? await sendLoginCode(parsed.data)
          : await sendRecoveryEmail(parsed.data);
      if (res.error) {
        setFormError(safeAuthMessage(res.error.message));
        return false;
      }

      const info = res.data;
      if (info?.devMode) {
        setCodeNotice(
          "Development mode: no email provider is configured, so the code was printed to the server console.",
        );
      } else if (info && !info.delivered) {
        setFormError(
          "Email delivery isn't configured on this server. Ask the administrator to set RESEND_API_KEY, or sign in with your password instead.",
        );
        return false;
      } else {
        setCodeNotice("");
      }

      setErrors({});
      setFormError("");
      if (!opts.resend) {
        setCode("");
        setStep("code");
        toast.success("Verification code sent");
      } else {
        toast.success("A new code is on its way");
      }
      setCodePurpose(purpose);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch {
      setFormError(GENERIC_ERROR);
      return false;
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function handleSendLoginCode(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError("");
    await sendCode("login");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError("");
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error.issues));
      return;
    }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    let succeeded = false;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        // Surface throttling clearly; everything else stays generic.
        setFormError(
          error.status === 429 ? safeAuthMessage(error.message) : GENERIC_CREDENTIALS_ERROR,
        );
        return;
      }
      succeeded = true;
      toast.success("Signed in successfully");
      // Navigation happens in the SIGNED_IN subscriber (outside this try/catch).
    } catch {
      if (succeeded) return; // redirect raised after a successful sign-in
      setFormError(GENERIC_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError("");
    await sendCode("reset");
  }

  async function handleResendCode() {
    if (cooldown > 0 || requestInFlight.current) return;
    setErrors({});
    setFormError("");
    await sendCode(codePurpose, { resend: true });
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError("");
    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) {
      setErrors({ code: parsed.error.issues[0]?.message ?? "Enter the 6-digit code" });
      return;
    }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    let succeeded = false;
    try {
      if (codePurpose === "login") {
        const { error } = await supabase.auth.verifyEmailCode({
          email,
          code: parsed.data,
        });
        if (error) {
          setFormError(error.message || GENERIC_ERROR);
          return;
        }
        succeeded = true;
        toast.success("Signed in successfully");
        // Navigation happens in the SIGNED_IN subscriber (outside this try/catch).
      } else {
        const { error } = await supabase.auth.verifyResetCode({
          email,
          code: parsed.data,
        });
        if (error) {
          setFormError(error.message || GENERIC_ERROR);
          return;
        }
        succeeded = true;
        setCode("");
        setStep("reset");
        toast.success("Code verified — now choose a new password");
      }
    } catch {
      if (succeeded) return;
      setFormError(GENERIC_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError("");
    const parsed = resetSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error.issues));
      return;
    }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    let succeeded = false;
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        setFormError(error.message || safeAuthMessage(error.message));
        return;
      }
      succeeded = true;
      toast.success("Password updated");
      setPassword("");
      setConfirmPassword("");
      // Full page reload: drops the old session and starts clean on "/".
      window.location.href = "/";
    } catch {
      if (succeeded) return;
      setFormError(GENERIC_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  const heading: Record<Step, { title: string; sub: string }> = {
    login: { title: "Welcome back", sub: "Sign in securely with your password." },
    register: {
      title: "Create your account",
      sub: "Fill in your details to register instantly. No email confirmation required.",
    },
    "email-login": {
      title: "Login with email code",
      sub: "We'll email a 6-digit code to your registered email address.",
    },
    code: {
      title: "Enter verification code",
      sub: "We emailed you a 6-digit code. It expires in 15 minutes.",
    },
    forgot: {
      title: "Forgot password",
      sub: "We'll email you a 6-digit code to verify it's you.",
    },
    reset: {
      title: "Set a new password",
      sub: "Choose a strong password you haven't used before.",
    },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 pb-[env(safe-area-inset-bottom)] sm:px-6 lg:px-8">
      <div className="w-full max-w-md lg:max-w-[30rem]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary/15 text-primary shadow-[var(--shadow-gold)] ring-1 ring-primary/35">
            <Truck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Jay Mataji Transport
          </h1>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-primary/85">
            Fleet Accounting
          </p>
        </div>

        <div className="fleet-panel rounded-3xl p-5 backdrop-blur-xl sm:p-7">
          <div className="mb-5">
            <h2 className="text-xl font-extrabold">{heading[step].title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{heading[step].sub}</p>
          </div>

          {formError ? (
            <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {formError}
            </div>
          ) : null}

          {step === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field
                id="login-email"
                label="Email"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                error={errors["email"]}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordField
                id="login-password"
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                error={errors["password"]}
              />
              <button
                type="button"
                onClick={() => reset("forgot")}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Forgot password?
              </button>
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Login
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => reset("email-login")}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                <Mail className="mr-2 h-4 w-4" /> Login with email code
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                New here?{" "}
                <button
                  type="button"
                  onClick={() => reset("register")}
                  className="font-semibold text-primary hover:underline"
                >
                  Create an account
                </button>
              </p>
            </form>
          ) : null}

          {step === "email-login" ? (
            <form onSubmit={handleSendLoginCode} className="space-y-4">
              <Field
                id="email-login-email"
                label="Registered email"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                error={errors["email"]}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send login code
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => reset("login")}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                Back to Login
              </Button>
            </form>
          ) : null}

          {step === "register" ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <Field
                id="reg-name"
                label="Full name"
                icon={User}
                autoComplete="name"
                placeholder="Enter your full name"
                value={fullName}
                error={errors["fullName"]}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Field
                id="reg-mobile"
                label="Mobile number"
                icon={Phone}
                inputMode="numeric"
                maxLength={10}
                autoComplete="tel"
                placeholder="Enter mobile number"
                value={mobile}
                error={errors["mobile"]}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
              <Field
                id="reg-email"
                label="Email"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                error={errors["email"]}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordField
                id="reg-password"
                label="Password"
                autoComplete="new-password"
                placeholder="Enter password"
                value={password}
                onChange={setPassword}
                error={errors["password"]}
              />
              <PasswordField
                id="reg-confirm"
                label="Confirm password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                error={errors["confirmPassword"]}
              />
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create account
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => reset("login")}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          ) : null}

          {step === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <Field
                id="forgot-email"
                label="Registered email"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                error={errors["email"]}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send reset code
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => reset("login")}
                  className="font-semibold text-primary hover:underline"
                >
                  Back to sign in
                </button>
              </p>
            </form>
          ) : null}

          {step === "code" ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-1 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
                  <MailOpen className="h-8 w-8" />
                </div>
                <p className="text-sm text-muted-foreground">Enter the 6-digit code we sent to</p>
                {email ? (
                  <p className="inline-block rounded-lg bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground/80">
                    {email}
                  </p>
                ) : null}
              </div>

              {codeNotice ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {codeNotice}
                </div>
              ) : null}

              <Field
                id="verify-code"
                label="Verification code"
                icon={ShieldCheck}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                error={errors["code"]}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Verify code
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={cooldown > 0 || busy}
                onClick={handleResendCode}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => reset(codePurpose === "reset" ? "forgot" : "email-login")}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                Back
              </Button>
            </form>
          ) : null}

          {step === "reset" ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <PasswordField
                id="new-password"
                label="New password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                error={errors["password"]}
              />
              <PasswordField
                id="new-confirm"
                label="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                error={errors["confirmPassword"]}
              />
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl text-sm font-bold"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update password
              </Button>
            </form>
          ) : null}
        </div>

        <p className="mt-5 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
          Protected by two-step email verification. Passwords are hashed and never stored in plain
          text.
        </p>
      </div>
    </div>
  );
}
