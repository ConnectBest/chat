"use client";

import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline";
  size?: "sm" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  className = "",
  children,
  variant = "solid",
  size = "lg",
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors";

  const sizeClasses =
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";

  const variantClasses =
    variant === "outline"
      ? "border border-slate-600 bg-slate-900/60 hover:bg-slate-800 text-slate-50"
      : "bg-indigo-500 hover:bg-indigo-600 text-white";

  return (
    <button
      className={`${base} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};