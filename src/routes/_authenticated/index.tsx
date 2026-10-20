import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/user/pages/DashboardPage";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Vehicle Calculation System" },
      {
        name: "description",
        content:
          "Vehicle-wise trip accounting dashboard: track daily income, diesel, driver payments, EMI share and net profit.",
      },
      { property: "og:title", content: "Dashboard — Vehicle Calculation System" },
      {
        property: "og:description",
        content: "Track daily trip income, expenses and profit for every vehicle in your fleet.",
      },
    ],
  }),
  component: DashboardPage,
});
