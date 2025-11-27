"use client";

import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({
  className = "",
  ...props
}) => {
  return (
    <input
      className={
        "w-full rounded-md border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 " +
        className
      }
      {...props}
    />
  );
};