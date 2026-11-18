import type { Metadata } from "next";
import { DoctorLayoutClient } from "@/components/doctor/DoctorGate";

export const metadata: Metadata = {
  title: "Clinical Portal — FrontalOS",
  description:
    "Review patient behavioral analytics, MRI-based inference, and clinical notes in the FrontalOS Clinical Portal.",
};

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <DoctorLayoutClient>{children}</DoctorLayoutClient>;
}
