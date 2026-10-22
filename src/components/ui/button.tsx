import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 tap-scale",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-[0_4px_20px_-2px_rgba(6,182,212,0.45)] hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_6px_25px_-1px_rgba(6,182,212,0.65)] hover:brightness-105 border-0",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-cyan-500/25 bg-slate-900/60 text-slate-200 backdrop-blur-md shadow-sm hover:border-cyan-400/60 hover:bg-slate-800/80 hover:text-white",
        secondary:
          "border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white shadow-sm",
        ghost: "text-slate-300 hover:bg-slate-800/80 hover:text-white",
        link: "text-cyan-400 hover:text-cyan-300 underline-offset-4 hover:underline",
        gold: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-[0_4px_20px_-2px_rgba(6,182,212,0.45)] hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_6px_25px_-1px_rgba(6,182,212,0.65)] hover:brightness-105 border-0",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6",
        xl: "h-14 rounded-xl px-8 text-base",
        icon: "h-11 w-11",
        iconSm: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
