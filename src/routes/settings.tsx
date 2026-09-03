import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { useSaveSettings } from "@/lib/queries";

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

  useEffect(() => {
    if (!settings) return;
    setAppName(settings.appName);
    setCurrency(settings.currency || "INR");
    setDefaultVehicleId(settings.defaultVehicleId ?? NO_DEFAULT);
  }, [settings]);

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

        <section className="glass-card space-y-2 rounded-2xl p-4">
          <h3 className="text-sm font-bold">Database</h3>
          <p className="text-xs text-muted-foreground">
            Your data is stored in this app's built-in cloud database. No external backend URL is needed.
          </p>
        </section>

      </div>
    </AppShell>
  );
}
