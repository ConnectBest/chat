"use client";

import * as React from "react";

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const Separator: React.FC<SeparatorProps> = ({
  className = "",
  ...props
}) => {
  // 簡單畫一條線；如果需要可以再加 "OR" 文字
  return (
    <div className={"h-px w-full bg-slate-700 " + className} {...props} />
  );
};