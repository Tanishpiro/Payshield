"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import { requestCameraPermission } from '@/lib/native';
import './qr-scanner.css';

export default function QrScanner({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const [error, setError] = useState("");
  const [attempt,setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      try {
        setError('');
        await requestCameraPermission();
        if(!active)return;
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera requires a secure browser or the PayShield Android app.');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        scan();
      } catch (e) {
        if(!active)return;
        streamRef.current?.getTracks().forEach(track=>track.stop());
        setError(e instanceof DOMException ? e.name==='NotAllowedError' ? 'Camera access denied. Enable camera permission in app or browser settings, then retry.' : e.name==='NotReadableError' ? 'Camera is busy. Close other camera apps and retry.' : 'Camera could not start. Retry or enter the receiver manually.' : e instanceof Error ? e.message : 'Camera could not start. Please retry.');
      }
    }

    function scan() {
      const video = videoRef.current;
      if (!active || !video || !context) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const scale=Math.min(1,720/video.videoWidth);
        canvas.width = Math.round(video.videoWidth*scale);
        canvas.height = Math.round(video.videoHeight*scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
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
      document.body.style.overflow=oldOverflow;
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onScan,attempt]);

  return createPortal(
    <div className="ps-scanner-overlay" role="dialog" aria-modal="true" aria-label="Scan payment QR">
      <div className="flex items-center justify-between">
        <div><div className="text-sm font-semibold">Scan payment QR</div><div className="mt-0.5 text-xs text-slate-500">Camera frames stay on this device.</div></div>
        <button autoFocus onClick={onClose} className="ps-scanner-close">Close</button>
      </div>
      <div className="ps-scanner-preview">
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="pointer-events-none absolute inset-8 rounded-2xl border border-cyan-300/70" />
        <div className="scanline pointer-events-none absolute inset-x-8 top-8 h-12 bg-gradient-to-b from-cyan-300/45 to-transparent" />
      </div>
      <p className={`mt-6 text-center text-sm ${error ? "text-rose-300" : "text-slate-400"}`}>{error || "Align the UPI QR code inside the frame."}</p>
      {error&&<button className="ps-scanner-close" onClick={()=>setAttempt(n=>n+1)}>Retry camera</button>}
    </div>, document.body
  );
}
