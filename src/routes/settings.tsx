import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Save, Server } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { useSaveSettings } from "@/lib/queries";
import { DEFAULT_API_BASE_URL, getApiBaseUrl, setApiBaseUrl } from "@/lib/api";

const CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — Pound (£)" },
  { value: "AED", label: "AED — Dirham" },
];

const NO_DEFAULT = "none";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — App Name, Currency & Backend" },
      {
        name: "description",
        content: "Configure the app name, currency, default vehicle and the backend API URL for your fleet accounting.",
      },
      { property: "og:title", content: "Settings — App Name, Currency & Backend" },
      { property: "og:description", content: "Change app name, currency, default vehicle and backend connection." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, vehicles } = useApp();
  const save = useSaveSettings();

  const [appName, setAppName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [defaultVehicleId, setDefaultVehicleId] = useState(NO_DEFAULT);
  const [apiUrl, setApiUrl] = useState("");

  useEffect(() => {
    if (!settings) return;
    setAppName(settings.appName);
    setCurrency(settings.currency || "INR");
    setDefaultVehicleId(settings.defaultVehicleId ?? NO_DEFAULT);
  }, [settings]);

  useEffect(() => {
    setApiUrl(getApiBaseUrl());
  }, []);

  const submit = () => {
    if (!appName.trim()) {
      toast.error("App name is required");
      return;
    }
    save.mutate({
      appName: appName.trim(),
      currency,
      defaultVehicleId: defaultVehicleId === NO_DEFAULT ? null : defaultVehicleId,
    });
  };

  const saveBackend = () => {
    setApiBaseUrl(apiUrl);
    toast.success("Backend URL saved");
    window.location.reload();
  };

  return (
    <AppShell showAddTrip={false}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Settings</h2>
          <p className="text-xs text-muted-foreground">Personalise the app and connect your backend</p>
        </div>

        <section className="glass-card space-y-4 rounded-2xl p-4">
          <div className="space-y-2">
            <Label htmlFor="appName">App name</Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="h-12 rounded-xl text-base"
              placeholder="Eicher Calculation"
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

          <Button
            onClick={submit}
            disabled={save.isPending}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </section>

        <section className="glass-card space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Backend connection</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            URL of your Express + MongoDB API (the code in <span className="font-mono">/server</span>). Default:{" "}
            <span className="font-mono break-all">{DEFAULT_API_BASE_URL}</span>
          </p>
          <Input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="h-12 rounded-xl font-mono text-sm"
            placeholder="https://your-api.example.com/api"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Button onClick={saveBackend} variant="secondary" className="h-12 w-full rounded-xl font-semibold">
            Save backend URL
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
