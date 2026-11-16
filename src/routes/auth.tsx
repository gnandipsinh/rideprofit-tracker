import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  Lock,
  Mail,
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
      { title: "Sign In — RideProfit Tracker" },
      {
        name: "description",
        content: "Sign in to manage your vehicles, daily trips, and profit reports.",
      },
      { property: "og:title", content: "Sign In — RideProfit Tracker" },
      {
        property: "og:description",
        content: "Simple vehicle accounting for your transport business.",
      },
      { property: "og:type", content: "website" },
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
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-11 pl-9 pr-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white",
            error && "border-rose-500 focus-visible:ring-rose-500",
          )}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:text-white transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
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
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={id}
          {...rest}
          className={cn(
            "h-11 pl-9 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white",
            error && "border-rose-500 focus-visible:ring-rose-500",
          )}
        />
      </div>
      {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const [emailOpen, setEmailOpen] = useState(false);
  const [step, setStep] = useState<Step>(() =>
    searchParams.mode === "register" ? "register" : "login",
  );
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
  const [deviceLoading, setDeviceLoading] = useState(false);
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

  async function handleDeviceLogin() {
    setFormError("");
    setDeviceLoading(true);
    try {
      const { error } = await supabase.auth.signInAsDemo();
      if (error) {
        const msg = error.message || "Failed to open local workspace";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Workspace opened. Your data stays saved on this device.");
      navigateHome();
    } catch {
      toast.error("Could not start local workspace.");
    } finally {
      setDeviceLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
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
        setFormError(error.message || GENERIC_ERROR);
        return;
      }
      succeeded = true;
      setPassword("");
      setConfirmPassword("");
      toast.success("Account created successfully!");
      navigateHome();
    } catch {
      if (succeeded) return;
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
      if (succeeded) return;
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
      toast.success("Password reset email sent!");
      setNotice(`We sent a password reset link to ${parsed.data}. Check your inbox.`);
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  const isSignInMethodError = formError.toLowerCase().includes("sign-in method");
  const isDomainError = formError.toLowerCase().includes("authorized domains");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B111E] px-4 py-8 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Truck className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-xl font-black tracking-tight text-white">RideProfit Tracker</h1>
          <p className="text-xs text-slate-400 mt-1">
            Simple vehicle, trip &amp; profit accounting
          </p>
        </div>

        <div className="rounded-2xl p-5 sm:p-6 border border-[#1C2B44] bg-[#10192A] shadow-xl space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-white">Sign in to continue</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Choose Google for multi-device cloud backup, or start directly on this device.
            </p>
          </div>

          {formError ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-300 space-y-2">
              <p>{formError}</p>
              {isSignInMethodError ? (
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0656218186/authentication/providers"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-[#080D18] px-2.5 py-1 text-[0.72rem] font-semibold text-cyan-300 border border-cyan-500/30 hover:bg-[#132137]"
                >
                  Open Firebase Sign-In Settings →
                </a>
              ) : null}
              {isDomainError ? (
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0656218186/authentication/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-[#080D18] px-2.5 py-1 text-[0.72rem] font-semibold text-cyan-300 border border-cyan-500/30 hover:bg-[#132137]"
                >
                  Add Domain in Firebase Settings →
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3">
            <Button
              type="button"
              disabled={busy || googleLoading || deviceLoading}
              onClick={handleGoogleLogin}
              className="h-12 w-full rounded-xl text-sm font-bold bg-white text-slate-900 hover:bg-slate-100"
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

            <Button
              type="button"
              variant="outline"
              onClick={handleDeviceLogin}
              disabled={busy || deviceLoading || googleLoading}
              className="h-12 w-full rounded-xl text-sm font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/35 hover:text-cyan-200"
            >
              {deviceLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="mr-2 h-4 w-4 text-cyan-400" />
              )}
              Use on This Device (No Login Needed)
            </Button>
          </div>

          {/* Optional Email/Password Section (Collapsed by default to avoid friction) */}
          <div className="pt-2 border-t border-[#1C2B44]">
            <button
              type="button"
              aria-expanded={emailOpen}
              onClick={() => {
                setEmailOpen((v) => !v);
                setFormError("");
                setErrors({});
              }}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <span>Use Email &amp; Password instead</span>
              {emailOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {emailOpen ? (
              <div className="mt-3 space-y-4">
                {step === "login" ? (
                  <form onSubmit={handleLogin} className="space-y-3">
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
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => reset("forgot")}
                        className="font-semibold text-cyan-400 hover:underline"
                      >
                        Forgot password?
                      </button>
                      <button
                        type="button"
                        onClick={() => reset("register")}
                        className="font-semibold text-cyan-400 hover:underline"
                      >
                        Create account
                      </button>
                    </div>
                    <Button
                      type="submit"
                      disabled={busy}
                      className="h-11 w-full rounded-xl text-sm font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    >
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Login
                    </Button>
                  </form>
                ) : null}

                {step === "register" ? (
                  <form onSubmit={handleRegister} className="space-y-3">
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
                      placeholder="10-digit mobile number"
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
                      placeholder="Min 8 chars, letters + numbers"
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
                      className="h-11 w-full rounded-xl text-sm font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    >
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create account
                    </Button>
                    <p className="text-center text-xs text-slate-400">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => reset("login")}
                        className="font-semibold text-cyan-400 hover:underline"
                      >
                        Sign in
                      </button>
                    </p>
                  </form>
                ) : null}

                {step === "forgot" ? (
                  <form onSubmit={handleForgot} className="space-y-3">
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
                      className="h-11 w-full rounded-xl text-sm font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    >
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send reset link
                    </Button>
                    <p className="text-center text-xs text-slate-400">
                      <button
                        type="button"
                        onClick={() => reset("login")}
                        className="font-semibold text-cyan-400 hover:underline"
                      >
                        Back to sign in
                      </button>
                    </p>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="text-center">
          <Link
            to="/landing"
            className="text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
