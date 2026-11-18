import { Providers } from "../providers";
import { Logo } from "@/components/ui/Logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="mesh-light relative min-h-screen bg-canvas flex flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-secondary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
        />
        <header className="relative px-6 py-6 sm:px-10">
          <Link href="/" aria-label="FrontalOS home">
            <Logo theme="dark" height={28} />
          </Link>
        </header>
        <main id="main-content" className="relative flex-1 flex items-center justify-center px-6 pb-16">
          {children}
        </main>
      </div>
    </Providers>
  );
}
