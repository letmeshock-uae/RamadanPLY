'use client';
import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onDone: () => void;
}

export default function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white
                 text-sm px-5 py-2.5 rounded-full shadow-lg animate-fade-in"
    >
      {message}
    </div>
  );
}
