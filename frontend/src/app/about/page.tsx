import type { Metadata } from "next";
import { AboutPage } from "@/features/welcome/MarketingInfoPages";
export const metadata: Metadata = { title: "About Largent", description: "Learn what Largent is, what it helps you do, and how it works." };
export default function Page() { return <AboutPage />; }
