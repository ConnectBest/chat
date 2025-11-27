// components/ui/card.tsx
"use client";

import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({
  className = "",
  children,
  ...props
}) => {
  return (
    <div
      className={
        "rounded-xl border border-white/10 bg-slate-900/80 p-6 shadow-lg " +
        className
      }
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({
  className = "",
  children,
  ...props
}) => {
  return (
    <div className={"mb-4 " + className} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<CardProps> = ({
  className = "",
  children,
  ...props
}) => {
  return (
    <h2
      className={"text-2xl font-semibold text-slate-50 " + className}
      {...props}
    >
      {children}
    </h2>
  );
};

export const CardDescription: React.FC<CardProps> = ({
  className = "",
  children,
  ...props
}) => {
  return (
    <p className={"text-sm text-slate-300 " + className} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<CardProps> = ({
  className = "",
  children,
  ...props
}) => {
  return (
    <div className={"space-y-4 " + className} {...props}>
      {children}
    </div>
  );
};
