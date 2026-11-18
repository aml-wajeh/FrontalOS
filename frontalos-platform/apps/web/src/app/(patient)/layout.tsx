import { Providers } from "../providers";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-canvas">{children}</div>
    </Providers>
  );
}
