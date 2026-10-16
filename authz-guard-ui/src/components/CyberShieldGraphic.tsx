import React, { useEffect, useRef } from "react";

interface CyberShieldGraphicProps {
  interactive?: boolean;
}

export const CyberShieldGraphic: React.FC<CyberShieldGraphicProps> = ({ interactive = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetMouseX = x * 30;
      targetMouseY = y * 30;
    };

    const container = containerRef.current;
    if (container && interactive) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", () => {
        targetMouseX = 0;
        targetMouseY = 0;
      });
    }

    // Particle vortex definition
    interface VortexParticle {
      t: number;          // progression along the curve (0 to 1)
      speed: number;
      streamIndex: number;
      offsetRadius: number;
      offsetAngle: number;
      size: number;
      baseAlpha: number;
      color: string;
      shimmerSpeed: number;
      shimmerPhase: number;
    }

    const numStreams = 8;
    const particlesPerStream = 160;
    const totalParticles = numStreams * particlesPerStream;
    const particles: VortexParticle[] = [];

    const cyanPalette = [
      "rgba(0, 240, 255, ",
      "rgba(0, 210, 255, ",
      "rgba(30, 160, 255, ",
      "rgba(70, 215, 255, ",
      "rgba(0, 255, 220, ",
      "rgba(20, 110, 255, ",
      "rgba(140, 230, 255, ",
    ];

    for (let i = 0; i < totalParticles; i++) {
      const streamIndex = i % numStreams;
      particles.push({
        t: Math.random(),
        speed: 0.0006 + Math.random() * 0.0012,
        streamIndex,
        offsetRadius: (Math.random() - 0.5) * 38,
        offsetAngle: (Math.random() - 0.5) * 0.35,
        size: 0.8 + Math.random() * 1.8,
        baseAlpha: 0.3 + Math.random() * 0.65,
        color: cyanPalette[Math.floor(Math.random() * cyanPalette.length)],
        shimmerSpeed: 0.02 + Math.random() * 0.04,
        shimmerPhase: Math.random() * Math.PI * 2,
      });
    }

    // Sparkling background stars / glowing bokeh
    interface Sparkle {
      x: number;
      y: number;
      radius: number;
      alpha: number;
      pulseSpeed: number;
      color: string;
    }

    const sparkles: Sparkle[] = [];
    for (let i = 0; i < 45; i++) {
      sparkles.push({
        x: Math.random(),
        y: Math.random(),
        radius: 1 + Math.random() * 2.2,
        alpha: 0.2 + Math.random() * 0.7,
        pulseSpeed: 0.015 + Math.random() * 0.03,
        color: Math.random() > 0.4 ? "rgba(0, 240, 255, " : "rgba(80, 180, 255, ",
      });
    }

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse follow
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Shield center anchor (around 52% x, 38% y)
      const centerX = width * 0.5 + mouseX * 0.3;
      const centerY = height * 0.38 + mouseY * 0.3;

      // Deep dark blue radial base background
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        20,
        centerX,
        centerY,
        width * 0.85
      );
      bgGrad.addColorStop(0, "#081b36");
      bgGrad.addColorStop(0.35, "#061329");
      bgGrad.addColorStop(0.7, "#030816");
      bgGrad.addColorStop(1, "#02040b");

      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Ambient cyan & blue light glows
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        180
      );
      glowGrad.addColorStop(0, "rgba(0, 220, 255, 0.22)");
      glowGrad.addColorStop(0.5, "rgba(0, 130, 240, 0.12)");
      glowGrad.addColorStop(1, "rgba(0, 40, 120, 0)");

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 200, 0, Math.PI * 2);
      ctx.fill();

      // Lower-right ambient neon burst
      const burstGrad = ctx.createRadialGradient(
        width * 0.65,
        height * 0.68,
        10,
        width * 0.65,
        height * 0.68,
        220
      );
      burstGrad.addColorStop(0, "rgba(0, 230, 220, 0.24)");
      burstGrad.addColorStop(0.4, "rgba(0, 100, 255, 0.14)");
      burstGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = burstGrad;
      ctx.beginPath();
      ctx.arc(width * 0.65, height * 0.68, 220, 0, Math.PI * 2);
      ctx.fill();

      // Draw faint tech radar circles & radial sector lines behind the shield
      ctx.save();
      ctx.strokeStyle = "rgba(0, 210, 255, 0.08)";
      ctx.lineWidth = 1;

      // Radar circles
      const radarRadii = [90, 140, 190, 250, 320];
      radarRadii.forEach((r, idx) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        // Subtle tick marks
        if (idx === 1 || idx === 3) {
          ctx.save();
          ctx.strokeStyle = "rgba(0, 230, 255, 0.18)";
          ctx.setLineDash([4, 16]);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });

      // Radial sector lines radiating outward
      const numRays = 16;
      for (let i = 0; i < numRays; i++) {
        const angle = (i * Math.PI * 2) / numRays + frame * 0.0003;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(centerX + cos * 70, centerY + sin * 70);
        ctx.lineTo(centerX + cos * 340, centerY + sin * 340);
        ctx.stroke();
      }
      ctx.restore();

      // Draw sparkles / bokeh
      sparkles.forEach((s) => {
        const pulse = 0.5 + 0.5 * Math.sin(frame * s.pulseSpeed);
        const alpha = s.alpha * pulse;
        const px = s.x * width + mouseX * 0.1;
        const py = s.y * height + mouseY * 0.1;

        ctx.fillStyle = s.color + alpha + ")";
        ctx.beginPath();
        ctx.arc(px, py, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // Star cross for brighter sparks
        if (s.radius > 2.2) {
          ctx.strokeStyle = s.color + alpha * 0.6 + ")";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(px - 4, py);
          ctx.lineTo(px + 4, py);
          ctx.moveTo(px, py - 4);
          ctx.lineTo(px, py + 4);
          ctx.stroke();
        }
      });

      // Draw particle vortex streams
      // We calculate curved spiral trajectories sweeping from bottom-left up around the shield
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      particles.forEach((p) => {
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;

        // Path math: a sweeping logarithmic spiral with curvature around (centerX, centerY)
        // Stream variation gives distinct bands
        const baseAngle = -1.2 + p.streamIndex * 0.42 + p.offsetAngle;
        const spiralProgress = p.t * 3.8;
        const angle = baseAngle + spiralProgress;
        
        // Radius starts wide at bottom/left, swoops close to shield, and fans outward to the right
        const rBase = 40 + Math.pow(p.t, 1.45) * 280 + p.offsetRadius;

        // Elliptical deformation to match the reference image's wide sweeping arc
        const x = centerX + Math.cos(angle) * rBase * 1.25;
        const y = centerY + Math.sin(angle) * rBase * 0.85 + (1 - p.t) * 40;

        // Alpha envelope: fade in at start, fade out at end
        const edgeFade = Math.sin(p.t * Math.PI);
        const shimmer = 0.7 + 0.3 * Math.sin(frame * p.shimmerSpeed + p.shimmerPhase);
        const finalAlpha = Math.max(0, Math.min(1, p.baseAlpha * edgeFade * shimmer));

        ctx.fillStyle = p.color + finalAlpha + ")";
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Connecting faint lines for adjacent particle clusters to create fiber-optic trails
        if (p.streamIndex % 3 === 0 && p.t > 0.3 && p.t < 0.7 && Math.random() < 0.05) {
          ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12);
          ctx.stroke();
        }
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (container && interactive) {
        container.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, [interactive]);

  return (
    <div
      ref={containerRef}
      className="cyber-shield-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background Particle & HUD Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />

      {/* Cyber Circuit Shield Graphic (Layered SVG with Keyhole & Circuit Traces) */}
      <div className="shield-wrapper" style={{ position: "relative", zIndex: 2 }}>
        <svg
          className="shield-svg"
          viewBox="0 0 240 280"
          width="210"
          height="245"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Outer Glow Filter */}
            <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur1" />
              <feGaussianBlur stdDeviation="18" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Circuit Traces Glow Filter */}
            <filter id="circuit-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Shield Body Gradient */}
            <linearGradient id="shield-grad" x1="120" y1="10" x2="120" y2="270" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#00b4d8" stopOpacity="0.85" />
              <stop offset="65%" stopColor="#0077b6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#023e8a" stopOpacity="0.9" />
            </linearGradient>

            {/* Inner Dark Mask Gradient */}
            <linearGradient id="shield-inner-grad" x1="120" y1="20" x2="120" y2="260" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#001833" stopOpacity="0.92" />
              <stop offset="40%" stopColor="#002447" stopOpacity="0.85" />
              <stop offset="85%" stopColor="#001226" stopOpacity="0.94" />
              <stop offset="100%" stopColor="#000d1c" stopOpacity="0.98" />
            </linearGradient>

            {/* Cyan Circuit Stroke Gradient */}
            <linearGradient id="trace-grad" x1="0" y1="0" x2="240" y2="280" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#00f2fe" />
              <stop offset="100%" stopColor="#00ffff" />
            </linearGradient>

            {/* Shield Outline Path */}
            <clipPath id="shield-clip">
              <path d="M 45 18 L 195 18 C 218 18 226 36 226 72 L 226 128 C 226 195 162 246 120 268 C 78 246 14 195 14 128 L 14 72 C 14 36 22 18 45 18 Z" />
            </clipPath>
          </defs>

          {/* Ambient Outer Aura Drop Shadow */}
          <path
            d="M 45 18 L 195 18 C 218 18 226 36 226 72 L 226 128 C 226 195 162 246 120 268 C 78 246 14 195 14 128 L 14 72 C 14 36 22 18 45 18 Z"
            fill="rgba(0, 229, 255, 0.45)"
            filter="url(#neon-glow)"
          />

          {/* Solid Shield Base */}
          <path
            d="M 45 18 L 195 18 C 218 18 226 36 226 72 L 226 128 C 226 195 162 246 120 268 C 78 246 14 195 14 128 L 14 72 C 14 36 22 18 45 18 Z"
            fill="url(#shield-grad)"
            stroke="#00ffff"
            strokeWidth="2.5"
          />

          {/* Shield Circuit Interior clipped to shield bounds */}
          <g clipPath="url(#shield-clip)">
            {/* Dark Tech Backplane */}
            <path
              d="M 45 18 L 195 18 C 218 18 226 36 226 72 L 226 128 C 226 195 162 246 120 268 C 78 246 14 195 14 128 L 14 72 C 14 36 22 18 45 18 Z"
              fill="url(#shield-inner-grad)"
            />

            {/* Inner Border Inset */}
            <path
              d="M 52 28 L 188 28 C 206 28 214 44 214 76 L 214 126 C 214 186 156 232 120 252 C 84 232 26 186 26 126 L 26 76 C 26 44 34 28 52 28 Z"
              fill="none"
              stroke="#00f2fe"
              strokeWidth="1.2"
              strokeOpacity="0.6"
              strokeDasharray="18 4 6 4"
            />

            {/* Glowing Circuit Board Paths & Solder Pads */}
            <g
              stroke="url(#trace-grad)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#circuit-glow)"
            >
              {/* Top Left Circuits */}
              <path d="M 32 45 L 68 45 L 82 59 L 82 92 L 66 108 L 30 108" />
              <path d="M 48 30 L 78 60 L 105 60" />
              <path d="M 36 78 L 56 78 L 70 92 L 70 120 L 55 135" />

              {/* Top Right Circuits */}
              <path d="M 208 45 L 172 45 L 158 59 L 158 92 L 174 108 L 210 108" />
              <path d="M 192 30 L 162 60 L 135 60" />
              <path d="M 204 78 L 184 78 L 170 92 L 170 120 L 185 135" />

              {/* Center Top Infeed */}
              <path d="M 120 28 L 120 54" />
              <path d="M 112 54 L 128 54" />

              {/* Mid Left & Right horizontal branches */}
              <path d="M 20 120 L 45 120 L 60 135 L 75 135 L 85 145" />
              <path d="M 220 120 L 195 120 L 180 135 L 165 135 L 155 145" />

              {/* Lower Circuit Traces */}
              <path d="M 40 160 L 72 160 L 92 180 L 92 205 L 110 223 L 110 242" />
              <path d="M 200 160 L 168 160 L 148 180 L 148 205 L 130 223 L 130 242" />
              <path d="M 65 185 L 80 200 L 98 200" />
              <path d="M 175 185 L 160 200 L 142 200" />
              <path d="M 58 140 L 78 160 L 78 182" />
              <path d="M 182 140 L 162 160 L 162 182" />

              {/* Central Keyhole Circuit Ring Surround */}
              <path d="M 90 98 C 90 82 103 70 120 70 C 137 70 150 82 150 98" strokeDasharray="5 3" />
              <path d="M 82 125 L 72 135" />
              <path d="M 158 125 L 168 135" />
            </g>

            {/* Circuit Nodes (Solder Pads) */}
            <g fill="#00ffff" filter="url(#circuit-glow)">
              <circle cx="68" cy="45" r="3" />
              <circle cx="172" cy="45" r="3" />
              <circle cx="105" cy="60" r="2.8" />
              <circle cx="135" cy="60" r="2.8" />
              <circle cx="30" cy="108" r="2.5" />
              <circle cx="210" cy="108" r="2.5" />
              <circle cx="85" cy="145" r="3" />
              <circle cx="155" cy="145" r="3" />
              <circle cx="55" cy="135" r="2.5" />
              <circle cx="185" cy="135" r="2.5" />
              <circle cx="92" cy="205" r="3" />
              <circle cx="148" cy="205" r="3" />
              <circle cx="110" cy="242" r="2.5" />
              <circle cx="130" cy="242" r="2.5" />
              <circle cx="98" cy="200" r="2.2" />
              <circle cx="142" cy="200" r="2.2" />
            </g>

            {/* Glowing Digital Cyan Top Crest Highlight */}
            <path
              d="M 52 24 L 188 24"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#neon-glow)"
              opacity="0.85"
            />
          </g>

          {/* Center Cutout: The Keyhole */}
          {/* Keyhole Outer Neon Rim */}
          <path
            d="M 120 90 
               A 22 22 0 0 0 102 122 
               L 106 158 
               A 6 6 0 0 0 112 164 
               L 128 164 
               A 6 6 0 0 0 134 158 
               L 138 122 
               A 22 22 0 0 0 120 90 Z"
            fill="none"
            stroke="#00f2fe"
            strokeWidth="3"
            filter="url(#neon-glow)"
          />

          {/* Keyhole Solid Black Center Void */}
          <path
            d="M 120 92 
               A 20 20 0 0 0 104 121 
               L 108 156 
               A 4 4 0 0 0 112 160 
               L 128 160 
               A 4 4 0 0 0 132 156 
               L 136 121 
               A 20 20 0 0 0 120 92 Z"
            fill="#030712"
          />

          {/* Keyhole Inner Shadow / Rim Gradient */}
          <path
            d="M 120 94 
               A 18 18 0 0 0 105 120 
               L 109 154 
               L 131 154 
               L 135 120 
               A 18 18 0 0 0 120 94 Z"
            fill="#01040a"
          />
        </svg>
      </div>
    </div>
  );
};
