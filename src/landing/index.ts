/**
 * Public Landing Page Module (Isolated from User Dashboard)
 * Components, sections, and marketing styles for RideProfit Tracker
 */

export interface LandingFeature {
  title: string;
  description: string;
  iconName: string;
}

export const LANDING_META = {
  title: "RideProfit Tracker — Modern Fleet Accounting & Profit Tracking",
  subtitle:
    "Track vehicle trips, diesel expenses, driver payments, and net profit with automated professional reports.",
  ctaText: "Get Started Free",
  ctaLink: "/auth",
};
