import React from 'react';

export const Logo = ({ className = "w-8 h-8" }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="2" />
      <line x1="50" y1="2" x2="50" y2="98" stroke="currentColor" strokeWidth="1" />
      <line x1="2" y1="50" x2="98" y2="50" stroke="currentColor" strokeWidth="1" />
      
      {/* Top Left: Fish (Simplified) */}
      <path d="M15 35 Q30 20 45 35 Q30 50 15 35 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      
      {/* Top Right: Mitre (Simplified) */}
      <path d="M55 45 L70 15 L85 45 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      <line x1="70" y1="15" x2="70" y2="45" stroke="currentColor" strokeWidth="1" />
      
      {/* Bottom Left: Axe (Simplified) */}
      <path d="M25 60 L40 60 L40 85 L25 85 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M40 70 L20 65 L20 75 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      
      {/* Bottom Right: Olive Branch (Simplified) */}
      <line x1="60" y1="85" x2="85" y2="60" stroke="currentColor" strokeWidth="1" />
      <circle cx="65" cy="75" r="3" fill="currentColor" />
      <circle cx="75" cy="65" r="3" fill="currentColor" />
      
      <text x="50" y="94" textAnchor="middle" fontSize="6" fill="currentColor" fontFamily="serif">カトリック小岩教会</text>
    </svg>
  );
};
