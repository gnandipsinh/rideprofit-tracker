import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LogOut, Save } from "lucide-react";
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
  head: () => ({
    meta: [
      { title: "Settings — App Name, Currency & Backend" },
      {
        name: "description",
        content:
          "Configure the app name, currency, default vehicle and the backend API URL for your fleet accounting.",
      },
      { property: "og:title", content: "Settings — App Name, Currency & Backend" },
      {
        property: "og:description",
        content: "Change app name, currency, default vehicle and backend connection.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, vehicles } = useApp();
  const navigate = useNavigate();
  const save = useSaveSettings();

  const [appName, setAppName] = useState("");
  const [transportationName, setTransportationName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [defaultVehicleId, setDefaultVehicleId] = useState(NO_DEFAULT);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const savedSettingsRef = useRef<{
    appName: string;
    transportationName: string;
    currency: string;
    defaultVehicleId: string;
    fullName: string;
    mobileNumber: string;
    businessName: string;
    address: string;
    contactNumber: string;
    businessEmail: string;
  } | null>(null);

  useEffect(() => {
    if (!settings) return;
    const saved = savedSettingsRef.current;
    setAppName(saved?.appName ?? settings.appName);
    setTransportationName(
      saved?.transportationName ?? settings.transportationName ?? settings.appName ?? "",
    );
    setCurrency(saved?.currency ?? settings.currency ?? "INR");
    setDefaultVehicleId(saved?.defaultVehicleId ?? settings.defaultVehicleId ?? NO_DEFAULT);
    setFullName(saved?.fullName ?? settings.fullName ?? "");
    setMobileNumber(saved?.mobileNumber ?? settings.mobileNumber ?? "");
    setBusinessName(saved?.businessName ?? settings.businessName ?? "");
    setAddress(saved?.address ?? settings.address ?? "");
    setContactNumber(saved?.contactNumber ?? settings.contactNumber ?? "");
    setBusinessEmail(saved?.businessEmail ?? settings.businessEmail ?? "");
  }, [settings]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const submit = () => {
    if (!appName.trim()) {
      toast.error("App name is required");
      return;
    }
    const payload = {
      appName: appName.trim(),
      transportationName: transportationName.trim(),
      currency,
      defaultVehicleId: defaultVehicleId === NO_DEFAULT ? null : defaultVehicleId,
      fullName: fullName.trim(),
      mobileNumber: mobileNumber.trim(),
      businessName: businessName.trim(),
      address: address.trim(),
      contactNumber: contactNumber.trim(),
      businessEmail: businessEmail.trim(),
    };
    savedSettingsRef.current = {
      ...payload,
      defaultVehicleId: payload.defaultVehicleId ?? NO_DEFAULT,
    };
    save.mutate(payload, {
      onError: () => {
        savedSettingsRef.current = null;
      },
    });
  };

  const changePassword = async () => {
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmNewPassword) {
      toast.error("Enter a valid new password and confirm it");
      return;
    }
    const { data } = await supabase.auth.getUser();
    const userEmail = data.user?.email;
    if (!userEmail) return;
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
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <AppShell showAddTrip={false}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Settings</h2>
          <p className="text-xs text-muted-foreground">
            Personalise the app and connect your backend
          </p>
        </div>

        <section className="glass-card space-y-4 rounded-2xl p-4">
          <div className="space-y-2">
            <Label htmlFor="appName">Transportation / Company Name</Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => {
                setAppName(e.target.value);
                setTransportationName(e.target.value);
              }}
              className="h-12 rounded-xl text-base"
              placeholder="ABC Transport"
            />
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-12 rounded-xl text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default vehicle</Label>
            <Select value={defaultVehicleId} onValueChange={setDefaultVehicleId}>
              <SelectTrigger className="h-12 rounded-xl text-base">
                <SelectValue placeholder="No default" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NO_DEFAULT}>No default</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    {v.name}
                    {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="glass-card space-y-4 rounded-2xl p-4">
          <h3 className="text-sm font-bold">Profile</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Mobile Number</Label>
              <Input
                id="mobileNumber"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="glass-card space-y-4 rounded-2xl p-4">
          <h3 className="text-sm font-bold">Transport / Business Profile</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessEmail">Business Email</Label>
              <Input
                id="businessEmail"
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="glass-card space-y-4 rounded-2xl p-4">
          <h3 className="text-sm font-bold">Security</h3>
          {[
            ["currentPassword", "Current Password", currentPassword, setCurrentPassword],
            ["newPassword", "New Password", newPassword, setNewPassword],
            [
              "confirmNewPassword",
              "Confirm New Password",
              confirmNewPassword,
              setConfirmNewPassword,
            ],
          ].map(([id, label, value, setter]) => (
            <div key={id as string} className="space-y-2">
              <Label htmlFor={id as string}>{label as string}</Label>
              <div className="relative">
                <Input
                  id={id as string}
                  type={showPasswords ? "text" : "password"}
                  value={value as string}
                  onChange={(e) => (setter as (value: string) => void)(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showPasswords ? "Hide password" : "Show password"}
                  onClick={() => setShowPasswords((shown) => !shown)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground"
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          <Button onClick={changePassword} className="h-11 w-full">
            Change Password
          </Button>
          <Button
            onClick={submit}
            disabled={save.isPending}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Saving…" : "Save settings"}
          </Button>
          <Button variant="outline" onClick={logout} className="h-11 w-full">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </section>

        <section className="glass-card space-y-2 rounded-2xl p-4">
          <h3 className="text-sm font-bold">Database</h3>
          <p className="text-xs text-muted-foreground">
            Your data is stored in this app's built-in cloud database. No external backend URL is
            needed.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
