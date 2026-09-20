"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

export default function QrScanner({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        scan();
      } catch {
        setError("Camera permission is required to scan a payment QR code.");
      }
    }

    function scan() {
      const video = videoRef.current;
      if (!active || !video || !context) return;
      if (video.readyState >= 2 && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          active = false;
          onScan(code.data);
          return;
        }
      }
      frameRef.current = requestAnimationFrame(scan);
    }

    start();
    return () => {
      active = false;
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#03070d] p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <div><div className="text-sm font-semibold">Scan payment QR</div><div className="mt-0.5 text-xs text-slate-500">Camera frames stay on this device.</div></div>
        <button onClick={onClose} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Close</button>
      </div>
      <div className="relative mt-8 aspect-square overflow-hidden rounded-[2rem] border border-cyan-400/40 bg-black shadow-[0_0_80px_rgba(34,211,238,.12)]">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-8 rounded-2xl border border-cyan-300/70" />
        <div className="scanline pointer-events-none absolute inset-x-8 top-8 h-12 bg-gradient-to-b from-cyan-300/45 to-transparent" />
      </div>
      <p className={`mt-6 text-center text-sm ${error ? "text-rose-300" : "text-slate-400"}`}>{error || "Align the UPI QR code inside the frame."}</p>
    </div>
  );
}
