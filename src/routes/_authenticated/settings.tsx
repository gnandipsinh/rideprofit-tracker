import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, LogOut, Save, Settings } from "lucide-react";
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
  const { settings, activeVehicles } = useApp();
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

  useEffect(() => {
    // Hydrate per settings record (_id is `set_<userId>`): if the cached record
    // belongs to a different account than the one shown now, re-hydrate with
    // this account's values so another account's profile can never stick here.
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
    void supabase.auth
      .getUser()
      .then((res: { data: { user: { id?: string; email?: string } | null } }) => {
        setEmail(res.data.user?.email ?? "");
      });
  }, []);

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
              Account Security
            </h3>
            <div className="space-y-3.5">
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
                      {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="grid gap-2 pt-3">
                <Button
                  onClick={changePassword}
                  disabled={passwordBusy || save.isPending}
                  className="h-11 w-full rounded-xl font-bold bg-[#172844] hover:bg-[#1f355a] text-white border border-[#1C2B44]"
                >
                  {passwordBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Update Password
                </Button>
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
        </div>
      </div>
    </AppShell>
  );
}
