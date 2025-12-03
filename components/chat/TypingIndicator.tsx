"use client";

import React from "react";

export type TypingIndicatorProps = {
  users?: string[]; // 讓 ChannelView 傳進來的 typingUsers 可以對到這裡
};

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users = [] }) => {
  if (!users.length) return null; // 沒有人在打字就不要顯示

  let text: string;
  if (users.length === 1) {
    text = `${users[0]} is typing…`;
  } else if (users.length === 2) {
    text = `${users[0]} and ${users[1]} are typing…`;
  } else {
    text = `${users[0]}, ${users[1]} and others are typing…`;
  }

  return (
    <div className="px-4 py-2 text-xs text-white/60">
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        {text}
      </span>
    </div>
  );
};

export default TypingIndicator;