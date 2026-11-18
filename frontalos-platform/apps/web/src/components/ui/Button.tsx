import { forwardRef } from "react";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark " +
  "disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0";

const variants: Record<Variant, string> = {
  primary: "bg-secondary text-primary-dark hover:bg-secondary/90 shadow-[0_8px_24px_-8px_rgba(0,194,168,0.55)]",
  secondary: "bg-white text-primary border border-primary/10 hover:bg-canvas",
  ghost: "bg-transparent text-inherit hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-6 text-sm",
  lg: "h-13 px-8 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
);
Button.displayName = "Button";

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => (
    <a ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </a>
  )
);
ButtonLink.displayName = "ButtonLink";
