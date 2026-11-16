import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Cloud,
  CloudUpload,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  HardDriveDownload,
  Loader2,
  LogOut,
  Save,
  Settings,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { useSaveSettings } from "@/lib/queries";
import { api, sanitizeEmail } from "@/lib/api";
import { getDeviceBackupSnapshot, hasDeviceBackupData } from "@/lib/demo-store";
import { supabase } from "@/integrations/supabase/client";

const CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — Pound (£)" },
  { value: "AED", label: "AED — Dirham" },
];

const NO_DEFAULT = "none";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Vehicle Calculation System" },
      {
        name: "description",
        content:
          "Manage your profile, change your password and configure your transport business details.",
      },
      { property: "og:title", content: "Settings — Vehicle Calculation System" },
      {
        property: "og:description",
        content: "Manage your profile, change your password and business details.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, activeVehicles, isDemo } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useSaveSettings();

  const [transportName, setTransportName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [defaultVehicleId, setDefaultVehicleId] = useState(NO_DEFAULT);
  const [fullName, setFullName] = useState("");
  const [userRole, setUserRole] = useState("Super Admin");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [hydratedFor, setHydratedFor] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [authProvider, setAuthProvider] = useState<string>(isDemo ? "demo" : "google");
  const [deviceBackupAvailable, setDeviceBackupAvailable] = useState<boolean>(() =>
    hasDeviceBackupData(),
  );
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!settings || hydratedFor === settings._id) return;
    const initialName =
      settings.transportationName || settings.businessName || settings.appName || "";
    setTransportName(initialName);
    setCurrency(settings.currency || "INR");
    setDefaultVehicleId(settings.defaultVehicleId || NO_DEFAULT);
    setFullName(settings.fullName || "");
    setUserRole(settings.userRole || "Super Admin");
    setMobileNumber(settings.mobileNumber || "");
    setAddress(settings.address || "");
    setContactNumber(settings.contactNumber || "");
    setBusinessEmail(settings.businessEmail || "");
    setHydratedFor(settings._id);
  }, [settings, hydratedFor]);

  useEffect(() => {
    setDeviceBackupAvailable(hasDeviceBackupData());
    void supabase.auth.getUser().then(
      (res: {
        data: {
          user: {
            id?: string;
            email?: string;
            app_metadata?: Record<string, unknown>;
          } | null;
        };
      }) => {
        setEmail(res.data.user?.email ?? "");
        const provider = res.data.user?.app_metadata?.["provider"];
        if (typeof provider === "string" && provider) {
          setAuthProvider(provider);
        } else if (isDemo) {
          setAuthProvider("demo");
        }
      },
    );
  }, [isDemo]);

  const isPasswordAccount = !isDemo && authProvider === "password";

  const submit = () => {
    const name = transportName.trim();
    if (!name) {
      toast.error("Transport / Business name is required");
      return;
    }
    const payload = {
      appName: name,
      transportationName: name,
      businessName: name,
      currency,
      defaultVehicleId: defaultVehicleId === NO_DEFAULT ? null : defaultVehicleId,
      fullName: fullName.trim(),
      userRole: userRole.trim() || "Super Admin",
      mobileNumber: mobileNumber.trim(),
      address: address.trim(),
      contactNumber: contactNumber.trim(),
      businessEmail: sanitizeEmail(businessEmail),
    };
    setTransportName(name);
    save.mutate(payload, {
      onSuccess: (saved) => {
        setTransportName(saved.transportationName || saved.businessName || saved.appName || name);
        setFullName(saved.fullName || payload.fullName);
        setUserRole(saved.userRole || payload.userRole);
        setMobileNumber(saved.mobileNumber || payload.mobileNumber);
        setAddress(saved.address || payload.address);
        setContactNumber(saved.contactNumber || payload.contactNumber);
        setBusinessEmail(saved.businessEmail || payload.businessEmail);
        setCurrency(saved.currency || payload.currency);
        setDefaultVehicleId(saved.defaultVehicleId || payload.defaultVehicleId || NO_DEFAULT);
        setHydratedFor(saved._id || hydratedFor);
      },
    });
  };

  const changePassword = async () => {
    if (isDemo) {
      toast.info("Password changes are disabled in Demo Mode. Sign in with your own account.");
      return;
    }
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmNewPassword) {
      toast.error("Enter a valid new password and confirm it");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("New password must include at least one letter and one number");
      return;
    }
    setPasswordBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const userEmail = data.user?.email;
      if (!userEmail) {
        toast.error("Could not verify user");
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (authError) {
        toast.error("Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) toast.error("Could not change password");
      else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        toast.success("Password changed");
      }
    } catch {
      toast.error("Could not change password");
    } finally {
      setPasswordBusy(false);
    }
  };

  const logout = async () => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("vcs.selectedVehicleId");
        window.localStorage.removeItem("SELECTED_KEY");
      }
      navigate({ to: "/landing", replace: true });
    } catch {
      navigate({ to: "/landing", replace: true });
    }
  };

  const exportBackup = async () => {
    setBackupBusy(true);
    try {
      const [vehicles, trips, currentSettings] = await Promise.all([
        api.listVehicles(),
        api.listTrips(),
        api.getSettings(),
      ]);
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accountEmail: email,
        vehicles,
        trips,
        settings: currentSettings,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rideprofit-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Backup exported (${vehicles.length} vehicles, ${trips.length} trips)`);
    } catch {
      toast.error("Could not export backup");
    } finally {
      setBackupBusy(false);
    }
  };

  const runSyncPayload = async (
    payload: {
      vehicles?: Array<Record<string, unknown>>;
      trips?: Array<Record<string, unknown>>;
      settings?: Record<string, unknown>;
    },
    emptyMessage: string,
  ) => {
    const res = await api.syncLegacy(payload);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
      queryClient.invalidateQueries({ queryKey: ["trips"] }),
      queryClient.invalidateQueries({ queryKey: ["report"] }),
      queryClient.invalidateQueries({ queryKey: ["settings"] }),
    ]);
    if (res.importedVehicles === 0 && res.importedTrips === 0) {
      toast.info(emptyMessage);
    } else {
      setHydratedFor("");
      toast.success(`Restored ${res.importedVehicles} vehicle(s) and ${res.importedTrips} trip(s)`);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBackupBusy(true);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      let vehicles = Array.isArray(parsed["vehicles"])
        ? (parsed["vehicles"] as Array<Record<string, unknown>>)
        : [];
      let trips = Array.isArray(parsed["trips"])
        ? (parsed["trips"] as Array<Record<string, unknown>>)
        : [];
      let nextSettings =
        parsed["settings"] &&
        !Array.isArray(parsed["settings"]) &&
        typeof parsed["settings"] === "object"
          ? (parsed["settings"] as Record<string, unknown>)
          : undefined;

      // Support full db.json export shape (users + multi-account settings array)
      if (Array.isArray(parsed["users"]) && email) {
        const users = parsed["users"] as Array<Record<string, unknown>>;
        const matchedUser = users.find(
          (u) =>
            String(u["email"] ?? "")
              .trim()
              .toLowerCase() === email.trim().toLowerCase(),
        );
        if (matchedUser?.["id"]) {
          const legacyId = String(matchedUser["id"]);
          vehicles = vehicles.filter((v) => String(v["userId"] ?? v["user_id"] ?? "") === legacyId);
          trips = trips.filter((t) => String(t["userId"] ?? t["user_id"] ?? "") === legacyId);
          if (Array.isArray(parsed["settings"])) {
            const matchedSet = (parsed["settings"] as Array<Record<string, unknown>>).find(
              (s) => String(s["userId"] ?? s["user_id"] ?? "") === legacyId,
            );
            if (matchedSet) nextSettings = matchedSet;
          }
        }
      } else if (Array.isArray(parsed["settings"]) && parsed["settings"].length > 0) {
        const first = parsed["settings"][0];
        if (first && typeof first === "object") {
          nextSettings = first as Record<string, unknown>;
        }
      }

      if (vehicles.length === 0 && trips.length === 0 && !nextSettings) {
        toast.info("No matching account records found in that backup file.");
        return;
      }

      await runSyncPayload(
        {
          vehicles,
          trips,
          ...(nextSettings ? { settings: nextSettings } : {}),
        },
        "All records from this backup are already present in your account.",
      );
    } catch {
      toast.error("Invalid backup file. Please choose a valid JSON backup.");
    } finally {
      setBackupBusy(false);
    }
  };

  const scanBrowserStorage = async () => {
    if (typeof window === "undefined") return;
    setBackupBusy(true);
    try {
      const tryReadArray = (keys: string[]): Array<Record<string, unknown>> => {
        for (const key of keys) {
          try {
            const raw = window.localStorage.getItem(key);
            if (!raw) continue;
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed as Array<Record<string, unknown>>;
            }
          } catch {
            /* ignore malformed key */
          }
        }
        return [];
      };

      const vehicles = tryReadArray(["vcs.vehicles", "rideprofit.vehicles", "vehicles"]);
      const trips = tryReadArray(["vcs.trips", "rideprofit.trips", "trips"]);

      if (vehicles.length === 0 && trips.length === 0) {
        toast.info("No older un-synced records found in this browser.");
        return;
      }

      await runSyncPayload(
        { vehicles, trips },
        "Browser records were already synced to your account.",
      );
    } catch {
      toast.error("Could not scan browser storage.");
    } finally {
      setBackupBusy(false);
    }
  };

  const importDeviceDataToCloud = async () => {
    const snapshot = getDeviceBackupSnapshot();
    if (!snapshot || (snapshot.vehicles.length === 0 && snapshot.trips.length === 0)) {
      toast.info("No saved Device Mode records found on this browser.");
      return;
    }
    setBackupBusy(true);
    try {
      await runSyncPayload(
        {
          vehicles: snapshot.vehicles as unknown as Array<Record<string, unknown>>,
          trips: snapshot.trips as unknown as Array<Record<string, unknown>>,
          ...(snapshot.settings
            ? { settings: snapshot.settings as unknown as Record<string, unknown> }
            : {}),
        },
        "Your saved Device Mode records are already in your Cloud account.",
      );
      setDeviceBackupAvailable(hasDeviceBackupData());
    } catch {
      toast.error("Could not import Device Mode data to Cloud.");
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <AppShell showAddTrip={false}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold sm:text-2xl">Settings</h2>
              <p className="text-xs text-muted-foreground">
                Manage your profile, security and business details
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-black">
                1
              </span>
              User Profile
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="fullName"
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white"
                  placeholder="e.g. Gohil G."
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Account Email
                </Label>
                <Input
                  id="email"
                  value={email}
                  readOnly
                  className="h-11 rounded-xl bg-[#080D18]/50 border-[#1C2B44] text-sm text-slate-400 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="userRole"
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Role / Designation
                </Label>
                <Input
                  id="userRole"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white"
                  placeholder="e.g. Super Admin, Fleet Owner, Transport Manager"
                />
                <p className="text-[0.7rem] text-slate-400">
                  Displayed beside your name in the application header (e.g. Super Admin, Fleet
                  Owner).
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="mobileNumber"
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Mobile Number
                </Label>
                <Input
                  id="mobileNumber"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white font-mono"
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-5 lg:order-3 lg:col-span-2">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-black">
                2
              </span>
              Transport & Fleet Profile
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="transportName"
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Transport Business Name
                </Label>
                <Input
                  id="transportName"
                  value={transportName}
                  onChange={(e) => setTransportName(e.target.value)}
                  className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white font-bold"
                  placeholder="e.g. Gujarat Logistics Fleet"
                />
                <p className="text-xs text-slate-400">
                  Business name printed on reports, PDF statements, and WhatsApp summaries.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="businessEmail"
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Business Contact Email
                </Label>
                <Input
                  id="businessEmail"
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white"
                  placeholder="contact@fleet.com"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="address"
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Business Operating Address
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white"
                  placeholder="Transport Nagar, Ring Road..."
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="contactNumber"
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Office Phone
                </Label>
                <Input
                  id="contactNumber"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white"
                  placeholder="Office / Dispatch phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Currency Symbol
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#080D18] border-[#1C2B44] text-white">
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Default Quick Vehicle
                </Label>
                <Select value={defaultVehicleId} onValueChange={setDefaultVehicleId}>
                  <SelectTrigger className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white">
                    <SelectValue placeholder="No default" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 bg-[#080D18] border-[#1C2B44] text-white">
                    <SelectItem value={NO_DEFAULT}>No default</SelectItem>
                    {activeVehicles.map((v) => (
                      <SelectItem key={v._id} value={v._id}>
                        {v.type || v.name}
                        {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-[#1C2B44]">
              <Button
                onClick={submit}
                disabled={save.isPending}
                className="h-11 px-6 rounded-xl font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                <Save className="mr-2 h-4 w-4" />
                {save.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-5 lg:order-2">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-black">
                3
              </span>
              Account &amp; Storage
            </h3>
            <div className="space-y-3.5">
              <div className="rounded-xl border border-[#1C2B44] bg-[#080D18] p-3.5 flex items-start gap-3">
                <div
                  className={
                    isDemo
                      ? "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-300"
                      : "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400"
                  }
                >
                  {isDemo ? <HardDrive className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">
                    {isDemo ? "Device Storage Mode" : "Cloud Sync Active"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {isDemo
                      ? "Your vehicles, trips, and settings stay saved in this browser across reloads and sign-outs."
                      : `Signed in via ${authProvider === "google.com" ? "Google" : "Email"} (${email || "verified account"}). All data backs up to Cloud Firestore automatically.`}
                  </p>
                </div>
              </div>

              {isPasswordAccount ? (
                <>
                  {[
                    {
                      id: "currentPassword",
                      label: "Current Password",
                      value: currentPassword,
                      setter: setCurrentPassword,
                    },
                    {
                      id: "newPassword",
                      label: "New Password",
                      value: newPassword,
                      setter: setNewPassword,
                    },
                    {
                      id: "confirmNewPassword",
                      label: "Confirm New Password",
                      value: confirmNewPassword,
                      setter: setConfirmNewPassword,
                    },
                  ].map(({ id, label, value, setter }) => (
                    <div key={id} className="space-y-1.5">
                      <Label
                        htmlFor={id}
                        className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
                      >
                        {label}
                      </Label>
                      <div className="relative">
                        <Input
                          id={id}
                          type={showPasswords ? "text" : "password"}
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className="h-11 rounded-xl bg-[#080D18] border-[#1C2B44] text-sm text-white pr-10"
                        />
                        <button
                          type="button"
                          aria-label={showPasswords ? "Hide password" : "Show password"}
                          onClick={() => setShowPasswords((shown) => !shown)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 transition-colors hover:text-white"
                        >
                          {showPasswords ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={changePassword}
                    disabled={passwordBusy || save.isPending}
                    className="h-11 w-full rounded-xl font-bold bg-[#172844] hover:bg-[#1f355a] text-white border border-[#1C2B44]"
                  >
                    {passwordBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Update Password
                  </Button>
                </>
              ) : null}

              <div className="pt-1">
                <Button
                  variant="outline"
                  onClick={logout}
                  className="h-11 w-full rounded-xl border-[#1C2B44] bg-[#080D18] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Log Out
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-5 lg:order-4 lg:col-span-2">
            <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-white">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-black">
                4
              </span>
              Data Backup &amp; Recovery
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Download a JSON backup of your vehicles, trips, and profile, restore from a previous
              backup file, or move saved browser data into your Cloud account.
            </p>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleRestoreFile}
              className="hidden"
            />
            <div className="flex flex-wrap gap-3">
              {!isDemo && deviceBackupAvailable ? (
                <Button
                  type="button"
                  disabled={backupBusy}
                  onClick={importDeviceDataToCloud}
                  className="h-11 rounded-xl font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                >
                  {backupBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CloudUpload className="mr-2 h-4 w-4" />
                  )}
                  Import Saved Device Data to Cloud
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={backupBusy}
                onClick={exportBackup}
                className="h-11 rounded-xl border-[#1C2B44] bg-[#080D18] text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
              >
                {backupBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export Backup (.json)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={backupBusy}
                onClick={() => restoreInputRef.current?.click()}
                className="h-11 rounded-xl border-[#1C2B44] bg-[#080D18] text-white hover:bg-[#172844]"
              >
                <Upload className="mr-2 h-4 w-4" />
                Restore from Backup
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={backupBusy}
                onClick={scanBrowserStorage}
                className="h-11 rounded-xl border-[#1C2B44] bg-[#080D18] text-slate-300 hover:bg-[#172844] hover:text-white"
              >
                <HardDriveDownload className="mr-2 h-4 w-4" />
                Check Browser Storage
              </Button>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
