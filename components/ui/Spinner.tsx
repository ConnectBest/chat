import React from 'react';

export function Spinner({ size=24 }: { size?: number }) {
  return <div style={{ width: size, height: size }} className="animate-spin rounded-full border-2 border-white border-t-transparent" />;
}
