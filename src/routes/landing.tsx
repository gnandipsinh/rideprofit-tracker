import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/landing";

export const Route = createFileRoute("/landing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "RideProfit Tracker — Modern Fleet Accounting & Real Profit" },
      {
        name: "description",
        content:
          "Manage vehicles, trips, income, expenses and get real profit insights — all in one simple and powerful platform for transport business.",
      },
      {
        property: "og:title",
        content: "RideProfit Tracker — Modern Fleet Accounting & Real Profit",
      },
      {
        property: "og:description",
        content:
          "Track vehicle trips, diesel expenses, driver payments, and net profit with automated professional reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
