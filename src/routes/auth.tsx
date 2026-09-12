import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
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
  emailSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  resendSignupEmail,
  safeAuthMessage,
  sendLoginLink,
  sendRecoveryEmail,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Secure Sign In — Vehicle Trip Profit Tracker" },
      {
        name: "description",
        content: "Sign in or create an account to access your vehicle trip accounting dashboard.",
      },
      { property: "og:title", content: "Secure Sign In — Vehicle Trip Profit Tracker" },
      {
        property: "og:description",
        content: "Secure password authentication for your fleet trip and profit records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Step = "login" | "register" | "email-login" | "email-link" | "forgot" | "reset";
type EmailLinkPurpose = "login" | "register" | "reset";

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
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn("pl-9 pr-11", error && "border-destructive")}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
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
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} {...rest} className={cn("pl-9", error && "border-destructive")} />
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function AuthPage() {
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

  const [emailLinkPurpose, setEmailLinkPurpose] = useState<EmailLinkPurpose>("login");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("reset");
      } else if (event === "SIGNED_IN") {
        navigate({ to: "/", replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  function reset(next: Step) {
    setErrors({});
    setFormError("");
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
    try {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.fullName, mobile: parsed.data.mobile },
        },
      });
      if (error) {
        setFormError(safeAuthMessage(error.message));
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setEmailLinkPurpose("register");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      reset("email-link");
      toast.success(`Confirmation link sent to ${parsed.data.email}`);
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function handleLoginLink(e: React.FormEvent) {
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
      const { error } = await sendLoginLink(parsed.data);
      if (error) {
        setFormError(safeAuthMessage(error.message));
        return;
      }
      setEmailLinkPurpose("login");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      reset("email-link");
      toast.success("Login link sent");
    } catch {
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
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        setFormError(GENERIC_CREDENTIALS_ERROR);
        return;
      }
      await supabase.auth.getUser();
      toast.success("Signed in successfully");
      navigate({ to: "/", replace: true });
    } catch {
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
    setBusy(true);
    if (requestInFlight.current) {
      setBusy(false);
      return;
    }
    requestInFlight.current = true;
    try {
      const { error } = await sendRecoveryEmail(parsed.data);
      if (error) setFormError(safeAuthMessage(error.message));
      else {
        setEmailLinkPurpose("reset");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        reset("email-link");
        toast.success("Password reset link sent");
      }
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    try {
      const res =
        emailLinkPurpose === "reset"
          ? await sendRecoveryEmail(email)
          : emailLinkPurpose === "register"
            ? await resendSignupEmail(email)
            : await sendLoginLink(email);
      if (res.error) {
        setFormError(safeAuthMessage(res.error.message));
        return;
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("A new login link is on its way");
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
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        setFormError(safeAuthMessage(error.message));
        return;
      }
      toast.success("Password updated");
      setPassword("");
      setConfirmPassword("");
      navigate({ to: "/", replace: true });
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const heading: Record<Step, { title: string; sub: string }> = {
    login: { title: "Welcome back", sub: "Sign in securely with your password." },
    register: {
      title: "Create your account",
      sub: "We'll email a confirmation link to activate your account.",
    },
    "email-login": {
      title: "Login with email",
      sub: "We'll send a secure login link to your registered email.",
    },
    "email-link": {
      title: "Check your registered email",
      sub: "We've sent a login link to your registered email. Please check your inbox and click the link to continue.",
    },
    forgot: {
      title: "Forgot password",
      sub: "We'll email you a secure link to reset your password.",
    },
    reset: {
      title: "Set a new password",
      sub: "Choose a strong password you haven't used before.",
    },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Truck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Vehicle Calculation System</h1>
          <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-primary/80">
            Secure Fleet Accounting
          </p>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-xl backdrop-blur-xl sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-bold">{heading[step].title}</h2>
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
              <Button type="submit" disabled={busy} className="h-12 w-full text-sm font-bold">
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
                className="h-12 w-full text-sm font-bold"
              >
                <Mail className="mr-2 h-4 w-4" /> Login with email link
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
            <form onSubmit={handleLoginLink} className="space-y-4">
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
              <Button type="submit" disabled={busy} className="h-12 w-full text-sm font-bold">
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send Login Email
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => reset("login")}
                className="h-12 w-full text-sm font-bold"
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
              <Button type="submit" disabled={busy} className="h-12 w-full text-sm font-bold">
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
              <Button type="submit" disabled={busy} className="h-12 w-full text-sm font-bold">
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

          {step === "email-link" ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
                <MailOpen className="h-8 w-8" />
              </div>
              <p className="text-sm text-muted-foreground">
                {emailLinkPurpose === "reset"
                  ? "We've sent a password reset link to your registered email. Please check your inbox and click the link to continue."
                  : emailLinkPurpose === "register"
                    ? "We've sent a confirmation link to your registered email. Please check your inbox and click the link to continue."
                    : "We've sent a login link to your registered email. Please check your inbox and click the link to continue."}
              </p>
              <Button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={handleResend}
                className="h-12 w-full text-sm font-bold"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {cooldown > 0
                  ? `${emailLinkPurpose === "reset" ? "Resend Reset Email" : "Resend Login Email"} in ${cooldown}s`
                  : emailLinkPurpose === "reset"
                    ? "Resend Reset Email"
                    : emailLinkPurpose === "register"
                      ? "Resend Confirmation Email"
                      : "Resend Login Email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => reset("login")}
                className="h-12 w-full text-sm font-bold"
              >
                Back to Login
              </Button>
            </div>
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
              <Button type="submit" disabled={busy} className="h-12 w-full text-sm font-bold">
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
