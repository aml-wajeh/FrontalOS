import { Providers } from "../providers";

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-canvas">{children}</div>
    </Providers>
  );
}
