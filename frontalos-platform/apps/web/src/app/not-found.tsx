import { Compass, Home } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary-light text-secondary">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 font-display text-xl font-semibold text-primary-dark">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
      </p>
      <div className="mt-6">
        <ButtonLink href="/" variant="primary" size="md">
          <Home className="h-4 w-4" aria-hidden="true" />
          Go home
        </ButtonLink>
      </div>
    </main>
  );
}
