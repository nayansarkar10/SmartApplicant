import React, { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = "Processing..." }) => {
  const [progress, setProgress] = useState(0);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let interval: number;

    if (isVisible) {
      setShouldRender(true);
      setProgress(0);
      
      // Update loop
      interval = window.setInterval(() => {
        setProgress((prev) => {
          // Slow down as we approach 99%
          // Target is 99, we move a fraction of the distance remaining
          const target = 99;
          const distance = target - prev;
          // Move faster initially, slower at end. 
          // Min increment ensures it doesn't stall completely.
          const increment = Math.max(distance * 0.05, 0.2); 
          
          const next = prev + increment;
          return next > 99 ? 99 : next;
        });
      }, 100);

    } else {
      // When visibility turns off, jump to 100% and then hide
      if (shouldRender) {
        setProgress(100);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setProgress(0);
        }, 600); // Keep showing 100% for 600ms
        return () => clearTimeout(timer);
      }
    }

    return () => clearInterval(interval);
  }, [isVisible, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-md transition-opacity duration-300">
      <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
        <div className="relative">
          <span className="text-8xl font-bold text-gray-900 tracking-tighter tabular-nums">
            {Math.floor(progress)}
          </span>
          <span className="text-4xl font-bold text-gray-400 absolute top-2 -right-8">%</span>
        </div>
        
        <div className="mt-8 h-1 w-64 bg-gray-200 rounded-full overflow-hidden">
            <div 
                className="h-full bg-black transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
            />
        </div>

        <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-gray-500 animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
};