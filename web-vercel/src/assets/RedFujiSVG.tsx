export function RedFujiSVG() {
  return (
    <svg className="art" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5e7baa" />
          <stop offset="55%" stopColor="#8aa3c8" />
          <stop offset="100%" stopColor="#bfd0e3" />
        </linearGradient>
        <linearGradient id="fuji" x1="0.2" x2="0.8" y1="0" y2="1">
          <stop offset="0%" stopColor="#7c2a18" />
          <stop offset="55%" stopColor="#9c3b21" />
          <stop offset="100%" stopColor="#5e2716" />
        </linearGradient>
        <linearGradient id="base" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#324a26" />
          <stop offset="100%" stopColor="#1a2c14" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#sky)" />
      <g fill="#f4ede0" opacity="0.92">
        <path d="M40,60 q40,-20 110,0 q60,18 140,-2 q60,-18 130,8 q70,16 150,-6 q60,-14 130,4 q40,8 80,4 v18 q-60,12 -130,-2 q-60,-12 -130,2 q-60,12 -140,-6 q-70,-16 -140,4 q-60,18 -130,-4 q-40,-14 -70,-6 z" />
        <path d="M80,110 q60,-14 130,0 q70,14 140,-4 q80,-18 170,2 q80,16 160,-6 q40,-10 80,-2 v14 q-60,8 -130,-4 q-60,-12 -140,4 q-70,14 -160,-4 q-70,-14 -140,4 q-60,12 -120,-2 z" />
      </g>
      <path d="M-20,520 L380,170 L420,170 L820,520 Z" fill="url(#fuji)" />
      <g fill="#f8efd9" opacity="0.95">
        <path d="M380,170 L420,170 L470,235 Q450,225 430,232 Q410,238 395,228 Q380,220 360,235 L335,235 Z" />
        <path d="M350,250 Q335,260 320,250 Q305,240 290,255 L320,290 Q335,278 350,290 L370,260 Z" />
        <path d="M445,255 Q460,245 478,260 Q495,275 478,290 L455,275 Q445,265 445,255 Z" />
        <path d="M310,310 Q295,318 285,310 L270,325 L295,338 Q305,330 315,335 Z" />
      </g>
      <g fill="#5a1c10" opacity="0.55">
        <path d="M400,180 L420,170 L820,520 L760,520 Z" />
      </g>
      <path d="M-20,520 L820,520 L820,600 L-20,600 Z" fill="url(#base)" />
      <g stroke="#0e1a09" strokeWidth="1" opacity="0.55">
        {Array.from({ length: 120 }).map((_, i) => (
          <line key={i} x1={i * 7} y1={520 + (i % 5) * 4} x2={i * 7} y2={540 + (i % 7) * 6} />
        ))}
      </g>
    </svg>
  );
}
