import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders a QR code locally on a canvas.
 *
 * Previously these were fetched as <img> from api.qrserver.com, which sent
 * every room and file share link to a third party — directly at odds with the
 * privacy promise, and an external dependency for something that runs fine in
 * the browser.
 */
export default function QrCode({
  value,
  size = 200,
  className = "",
  alt = "QR code",
}) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    let cancelled = false;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2, // quiet zone; phone cameras often fail to lock on without it
      color: { dark: "#ef4444", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(() => {
        if (!cancelled) setFailed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("QR generation failed:", err);
        setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 text-[10px] font-medium rounded-lg p-2 text-center ${className}`}
        style={{ width: size, height: size }}
      >
        Could not render QR code — use the link instead
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className={className}
    />
  );
}
