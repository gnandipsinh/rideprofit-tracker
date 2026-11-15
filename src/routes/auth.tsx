import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
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
  emailSchema,
  loginSchema,
  registerSchema,
  safeAuthMessage,
  sendRecoveryEmail,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: string | undefined; redirect?: string | undefined } => ({
    mode: typeof search["mode"] === "string" ? (search["mode"] as string) : undefined,
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Vehicle Calculation System — Fleet Accounting" },
      {
        name: "description",
        content: "Sign in to access your fleet accounting dashboard.",
      },
      { property: "og:title", content: "Vehicle Calculation System — Fleet Accounting" },
      {
        property: "og:description",
        content: "Secure fleet accounting for your transport business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function isSafeInternalPath(path: string | undefined): path is string {
  if (!path) return false;
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/auth");
}

type Step = "login" | "register" | "forgot";
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

function AuthPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const [step, setStep] = useState<Step>(() => {
    if (searchParams.mode === "register") return "register";
    if (typeof window !== "undefined") {
      const mode = new URLSearchParams(window.location.search).get("mode");
      if (mode === "register") return "register";
    }
    return "login";
  });
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const navigatingRef = useRef(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [notice, setNotice] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigateHome = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    const target = isSafeInternalPath(searchParams.redirect) ? searchParams.redirect : "/";
    const [pathname, queryStr] = target.split("?");
    const searchObj = queryStr ? Object.fromEntries(new URLSearchParams(queryStr)) : undefined;
    void Promise.resolve(
      navigate({
        to: (pathname || "/") as "/",
        ...(searchObj ? { search: searchObj as Record<string, string> } : {}),
        replace: true,
      }),
    ).catch(() => {
      navigatingRef.current = false;
    });
  }, [navigate, searchParams.redirect]);

  async function handleGoogleLogin() {
    setFormError("");
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithGoogle();
      if (error) {
        setFormError(error.message || "Google sign-in failed.");
        return;
      }
      toast.success("Signed in with Google!");
      navigateHome();
    } catch {
      setFormError("An error occurred during Google sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleDemoLogin() {
    setFormError("");
    setDemoLoading(true);
    try {
      const { error } = await supabase.auth.signInAsDemo();
      if (error) {
        const msg = error.message || "Failed to load demo account";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Welcome to Demo Mode! Exploring Express Logistics Fleet.");
      navigateHome();
    } catch {
      toast.error("An error occurred starting demo account.");
    } finally {
      setDemoLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    // If a session already exists there is nothing to do on this screen.
    supabase.auth.getUser().then((res: { data: { user: unknown } }) => {
      if (active && res.data?.user) {
        navigateHome();
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN") {
        navigateHome();
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigateHome]);

  function reset(next: Step) {
    setErrors({});
    setFormError("");
    setNotice("");
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
      toast.success("Account created successfully!");
      navigateHome();
    } catch {
      if (succeeded) return; // redirect raised after a successful registration
      setFormError(GENERIC_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
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
        if (error.status === 429) {
          setFormError(safeAuthMessage(error.message));
        } else if (error.status === 401) {
          setFormError(GENERIC_CREDENTIALS_ERROR);
        } else {
          setFormError(error.message || GENERIC_ERROR);
        }
        return;
      }
      succeeded = true;
      toast.success("Signed in successfully");
      navigateHome();
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
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setErrors({ email: parsed.error.issues[0]?.message ?? "Enter a valid email" });
      return;
    }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    try {
      const res = await sendRecoveryEmail(parsed.data);
      if (res.error) {
        setFormError(res.error.message || GENERIC_ERROR);
        return;
      }
      toast.success("Password reset email sent! Check your inbox.");
      setNotice(
        `We sent a password reset link to ${parsed.data}. Check your inbox (and spam folder), then return here to sign in.`,
      );
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  const heading: Record<Step, { title: string; sub: string }> = {
    login: { title: "Welcome back", sub: "Sign in securely to your fleet accounting workspace." },
    register: {
      title: "Create your account",
      sub: "Register with Google or email to sync your vehicles, trips, and settings.",
    },
    forgot: {
      title: "Forgot password",
      sub: "We'll email you a secure password reset link.",
    },
  };

  const googleButton = (
    <Button
      type="button"
      variant="outline"
      disabled={busy || googleLoading}
      onClick={handleGoogleLogin}
      className="h-12 w-full rounded-xl text-sm font-bold border-[#1C2B44] bg-[#0B111E] hover:bg-[#132137] text-white"
    >
      {googleLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
          />
        </svg>
      )}
      Continue with Google
    </Button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 pb-[env(safe-area-inset-bottom)] sm:px-6 lg:px-8">
      <div className="w-full max-w-md lg:max-w-[30rem]">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/landing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors hover:underline"
          >
            ← View RideProfit Landing Page
          </Link>
        </div>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/20">
            <Truck className="h-7 w-7" />
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white flex items-center justify-center">
            RideProfit
          </h1>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.25em] text-cyan-400">
            Tracker
          </p>
        </div>

        <div className="rounded-2xl p-6 sm:p-7 border border-[#1C2B44] bg-[#10192A] shadow-2xl">
          <div className="mb-5">
            <h2 className="text-xl font-extrabold">{heading[step].title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{heading[step].sub}</p>
          </div>

          {formError ? (
            <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive space-y-2">
              <p>{formError}</p>
              {formError.toLowerCase().includes("sign-in method") ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="https://console.firebase.google.com/project/gen-lang-client-0656218186/authentication/providers"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg bg-slate-900/80 px-2.5 py-1 text-[0.7rem] font-semibold text-cyan-300 border border-cyan-500/30 hover:bg-slate-800"
                  >
                    Enable Email/Password in Firebase Console →
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          {step !== "forgot" ? (
            <div className="mb-5 space-y-3">
              {googleButton}
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-border/60" />
                <span className="mx-3 shrink-0 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  Or continue with email
                </span>
                <div className="flex-grow border-t border-border/60" />
              </div>
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
              {notice ? (
                <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300">
                  {notice}
                </div>
              ) : null}
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
                Send reset link
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

          {/* Instant Demo Account Access */}
          <div className="mt-6 pt-5 border-t border-border/60 space-y-2.5">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={busy || demoLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              <span>
                {demoLoading ? "Starting Demo…" : "Try Demo Account (Instant 1-Click Access)"}
              </span>
            </button>
            <div className="text-center">
              <Link
                to="/landing"
                className="inline-block text-[0.75rem] font-medium text-muted-foreground hover:text-cyan-400 transition-colors"
              >
                ← Back to Landing Page
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
          Secured by Firebase Authentication &amp; Cloud Firestore. Your fleet records are private
          to your account.
        </p>
      </div>
    </div>
  );
}
