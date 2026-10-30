import type { Metadata } from "next";
import { InstallPage } from "@/features/welcome/MarketingInfoPages";
export const metadata: Metadata = { title: "Install Largent", description: "Learn how to add Largent to your iPhone, iPad, Android or desktop Home Screen." };
export default function Page() { return <InstallPage />; }
