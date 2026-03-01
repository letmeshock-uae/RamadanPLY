'use client';
import { useEffect, useRef } from 'react';

interface ParticleBgProps {
    pointerX: number; // -0.5 to 0.5
    pointerY: number;
}

const PARTICLE_COUNT = 180;

interface Particle {
    x: number; // 0–1 normalised
    y: number;
    size: number;
    baseOpacity: number;
    color: string;
}

const COLORS = ['#ffffff', '#7eb8d4', '#a8d8ea', '#5ba3c9', '#c8e6f5'];

export default function ParticleBg({ pointerX, pointerY }: ParticleBgProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pointerRef = useRef({ x: pointerX, y: pointerY });

    // keep pointer ref in sync without triggering re-renders
    pointerRef.current = { x: pointerX, y: pointerY };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // generate particles once
        const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
            x: Math.random(),
            y: Math.random(),
            size: Math.random() * 1.4 + 0.4,
            baseOpacity: Math.random() * 0.12 + 0.02,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
        }));

        function resize() {
            if (!canvas) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        }
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        let animId = 0;
        function draw() {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const mx = (pointerRef.current.x + 0.5) * canvas.width;
            const my = (pointerRef.current.y + 0.5) * canvas.height;
            const maxDist = Math.min(canvas.width, canvas.height) * 0.38;

            for (const p of particles) {
                const px = p.x * canvas.width;
                const py = p.y * canvas.height;
                const dist = Math.hypot(px - mx, py - my);
                const proximity = Math.max(0, 1 - dist / maxDist);
                const opacity = p.baseOpacity + proximity * 0.42;

                ctx.globalAlpha = Math.min(opacity, 0.55);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(px, py, p.size, 0, Math.PI * 2);
                ctx.fill();
            }

            animId = requestAnimationFrame(draw);
        }
        draw();

        return () => {
            ro.disconnect();
            cancelAnimationFrame(animId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }}
        />
    );
}
