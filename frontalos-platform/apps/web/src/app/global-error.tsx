"use client";

/**
 * app/global-error.tsx — only triggers if the ROOT layout.tsx itself throws
 * (error.tsx can't catch that, since it renders inside the layout). Must
 * render its own <html>/<body> since the real root layout never mounted.
 * Kept deliberately dependency-free (no design-token/Tailwind class that
 * could itself be the thing that failed) — plain inline styles only.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#F5F7FB",
          color: "#10172A",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>Something went wrong</h1>
        <p style={{ fontSize: "14px", color: "#6B7280", maxWidth: "360px", marginBottom: "24px" }}>
          The app hit an unexpected error. Please try reloading the page.
        </p>
        <button
          onClick={reset}
          style={{
            backgroundColor: "#00C2A8",
            color: "#1B2340",
            border: "none",
            borderRadius: "9999px",
            padding: "10px 24px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
