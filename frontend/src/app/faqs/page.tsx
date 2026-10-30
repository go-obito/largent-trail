import type { Metadata } from "next";
import { FaqsPage } from "@/features/welcome/MarketingInfoPages";
export const metadata: Metadata = { title: "FAQs", description: "Answers to common questions about using and installing Largent." };
export default function Page() { return <FaqsPage />; }
