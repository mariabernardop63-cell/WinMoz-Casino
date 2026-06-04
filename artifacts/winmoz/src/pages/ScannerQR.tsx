import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { X, Zap, ZapOff, Image as ImageIcon, MoreVertical, CheckCircle2, Copy, Share2, RefreshCw } from "lucide-react";

const CYAN = "#00D4B4";

type Mode = "qr" | "barcode";

type ScanResult = {
  type: string;
  value: string;
  label: string;
};

const DEMO_RESULTS: ScanResult[] = [
  { type: "qr", value: "WINMOZ-RECARGA-XK9P2Q", label: "Código de Recarga" },
  { type: "qr", value: "WINMOZ-CONVITE-ABC123", label: "Código de Convite" },
  { type: "qr", value: "WINMOZ-SALA-WM-4821", label: "Código de Sala" },
  { type: "barcode", value: "9781234567897", label: "EAN-13" },
];

export default function ScannerQR() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("qr");
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [flash, setFlash] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanLine, setScanLine] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const animRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (scanning && !result) {
      const interval = setInterval(() => {
        setScanLine(p => (p + 1) % 100);
      }, 16);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [scanning, result]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setHasCamera(true);
      setScanning(true);
      startDetection(stream);
    } catch (err) {
      setHasCamera(false);
    }
  };

  const stopCamera = () => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startDetection = async (stream: MediaStream) => {
    scanningRef.current = true;
    if ("BarcodeDetector" in window) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code", "ean_13", "code_128", "data_matrix"] });
        detectorRef.current = detector;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const video = videoRef.current;
        const detect = async () => {
          if (!scanningRef.current || !video || video.readyState < 2) {
            if (scanningRef.current) requestAnimationFrame(detect);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          try {
            const codes = await detector.detect(canvas);
            if (codes.length > 0 && scanningRef.current) {
              const code = codes[0];
              scanningRef.current = false;
              handleScanResult({ type: code.format, value: code.rawValue, label: code.format === "qr_code" ? "Código QR" : "Código de Barras" });
              return;
            }
          } catch {}
          if (scanningRef.current) requestAnimationFrame(detect);
        };
        requestAnimationFrame(detect);
      } catch {}
    }
  };

  const handleScanResult = (res: ScanResult) => {
    setScanning(false);
    setResult(res);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const simulateScan = () => {
    const pool = DEMO_RESULTS.filter(r => mode === "qr" ? r.type === "qr" : r.type === "barcode");
    const pick = pool[Math.floor(Math.random() * pool.length)];
    handleScanResult(pick);
  };

  const resetScan = () => {
    setResult(null);
    setScanning(true);
    scanningRef.current = true;
    if (streamRef.current) startDetection(streamRef.current);
  };

  const handleImportImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMenuOpen(false);
    setTimeout(() => {
      const pick = DEMO_RESULTS[Math.floor(Math.random() * DEMO_RESULTS.length)];
      handleScanResult(pick);
    }, 1200);
    e.target.value = "";
  };

  const copyResult = () => {
    if (result) navigator.clipboard.writeText(result.value).catch(() => {});
  };

  const frameW = mode === "qr" ? 220 : 260;
  const frameH = mode === "qr" ? 220 : 110;

  return (
    <div className="w-full flex justify-center" style={{ background: "#000", minHeight: "100svh" }}>
      <div className="w-full max-w-[430px] flex flex-col relative" style={{ height: "100svh" }}>

        {/* Header overlay */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, paddingTop: 52, paddingBottom: 14, paddingLeft: 16, paddingRight: 16, background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}>
          <div className="flex items-center justify-between">
            <button onClick={() => { stopCamera(); setLocation("/perfil"); }} style={{ width: 38, height: 38, borderRadius: 999, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X style={{ width: 17, height: 17, color: "#fff" }} />
            </button>
            <div className="text-center">
              <p style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>
                {mode === "qr" ? "Scan QR" : "Scan Código de Barras"}
              </p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>
                {mode === "qr" ? "Aponta a câmara para o código QR" : "Aponta a câmara para o código de barras"}
              </p>
            </div>
            <div className="relative">
              <button onClick={() => setMenuOpen(v => !v)} style={{ width: 38, height: 38, borderRadius: 999, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <MoreVertical style={{ width: 17, height: 17, color: "#fff" }} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div initial={{ opacity: 0, scale: 0.88, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88 }} style={{ position: "absolute", top: 44, right: 0, background: "rgba(28,28,30,0.96)", backdropFilter: "blur(16px)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: "8px 0", width: 200, zIndex: 50, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <input ref={fileRef as any} type="file" accept="image/*" onChange={handleImportImage} style={{ display: "none" }} />
                    {[
                      { label: "Importar imagem", icon: ImageIcon, action: () => { setMenuOpen(false); fileRef.current?.click(); } },
                      { label: flash ? "Desligar flash" : "Ligar flash", icon: flash ? ZapOff : Zap, action: () => { setFlash(v => !v); setMenuOpen(false); } },
                      { label: "Reiniciar scanner", icon: RefreshCw, action: () => { setMenuOpen(false); resetScan(); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        <item.icon style={{ width: 16, height: 16, color: "#9ca3af" }} />
                        <span style={{ fontSize: 13, color: "#e2e8f0" }}>{item.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Camera view */}
        <div className="flex-1 relative overflow-hidden" onClick={() => setMenuOpen(false)}>
          {hasCamera === false ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4" style={{ background: "#111" }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ImageIcon style={{ width: 28, height: 28, color: "#52525b" }} />
              </div>
              <p style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: "0 32px" }}>
                Câmara não disponível. Permite o acesso nas definições do browser.
              </p>
              <button onClick={() => { fileRef.current?.click(); }} style={{ background: CYAN, border: "none", borderRadius: 12, padding: "12px 24px", color: "#000", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Importar imagem
              </button>
              <input ref={fileRef as any} type="file" accept="image/*" onChange={handleImportImage} style={{ display: "none" }} />
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} />
              {/* Dark overlay with cutout */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
                {/* Scan frame */}
                <div style={{ position: "relative", zIndex: 2, width: frameW, height: frameH }}>
                  {/* Clear window */}
                  <div style={{ position: "absolute", inset: 0, background: "transparent", boxShadow: "0 0 0 2000px rgba(0,0,0,0.55)", borderRadius: mode === "qr" ? 20 : 10 }} />
                  {/* Corner brackets */}
                  {[
                    { top: 0, left: 0, borderTop: `3px solid ${CYAN}`, borderLeft: `3px solid ${CYAN}`, borderRadius: mode === "qr" ? "20px 0 0 0" : "10px 0 0 0" },
                    { top: 0, right: 0, borderTop: `3px solid ${CYAN}`, borderRight: `3px solid ${CYAN}`, borderRadius: mode === "qr" ? "0 20px 0 0" : "0 10px 0 0" },
                    { bottom: 0, left: 0, borderBottom: `3px solid ${CYAN}`, borderLeft: `3px solid ${CYAN}`, borderRadius: mode === "qr" ? "0 0 0 20px" : "0 0 0 10px" },
                    { bottom: 0, right: 0, borderBottom: `3px solid ${CYAN}`, borderRight: `3px solid ${CYAN}`, borderRadius: mode === "qr" ? "0 0 20px 0" : "0 0 10px 0" },
                  ].map((style, i) => (
                    <div key={i} style={{ position: "absolute", width: 28, height: 28, ...style }} />
                  ))}
                  {/* Scanning line */}
                  {scanning && !result && (
                    <motion.div
                      animate={{ y: [0, frameH - 4, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      style={{ position: "absolute", left: 8, right: 8, height: 2, background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`, borderRadius: 2, boxShadow: `0 0 8px ${CYAN}` }}
                    />
                  )}
                </div>
              </div>

              {/* Scan label */}
              {scanning && !result && (
                <div style={{ position: "absolute", bottom: "30%", left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>A procurar código...</p>
                </div>
              )}

              {/* Simulate scan button (if BarcodeDetector not available) */}
              {scanning && !result && !("BarcodeDetector" in window) && (
                <div style={{ position: "absolute", bottom: "20%", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 10 }}>
                  <motion.button whileTap={{ scale: 0.94 }} onClick={simulateScan} style={{ background: CYAN, border: "none", borderRadius: 14, padding: "12px 28px", color: "#000", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: `0 4px 20px ${CYAN}88` }}>
                    Simular Leitura
                  </motion.button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom tabs */}
        <div style={{ background: "rgba(10,10,12,0.95)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", paddingBottom: "max(24px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 4, gap: 4 }}>
            {(["qr", "barcode"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); resetScan(); }} style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, transition: "all 0.2s",
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "#000" : "rgba(255,255,255,0.5)",
              }}>
                {m === "qr" ? "Leitura QR" : "Códigos de Barras"}
              </button>
            ))}
          </div>
        </div>

        {/* Result modal */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", zIndex: 60 }}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} style={{ width: "100%", background: "#18181b", borderRadius: "28px 28px 0 0", padding: "28px 24px", paddingBottom: "max(36px, env(safe-area-inset-bottom))", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex flex-col items-center gap-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", damping: 16 }} style={{ width: 60, height: 60, borderRadius: 999, background: `linear-gradient(135deg, ${CYAN}33, ${CYAN}66)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle2 style={{ width: 30, height: 30, color: CYAN }} />
                  </motion.div>
                  <div className="text-center">
                    <p style={{ color: CYAN, fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", marginBottom: 6 }}>CÓDIGO LIDO COM SUCESSO</p>
                    <p style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>{result.label}</p>
                  </div>
                  <div style={{ background: "#27272a", borderRadius: 16, padding: "14px 18px", width: "100%", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ color: "#9ca3af", fontSize: 10, fontWeight: 600, letterSpacing: "0.5px", marginBottom: 6 }}>CONTEÚDO</p>
                    <p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, fontFamily: "monospace", wordBreak: "break-all" }}>{result.value}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10, width: "100%" }}>
                    <motion.button whileTap={{ scale: 0.94 }} onClick={copyResult} style={{ flex: 1, padding: "13px 0", borderRadius: 14, background: "#27272a", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Copy style={{ width: 15, height: 15 }} /> Copiar
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.94 }} onClick={resetScan} style={{ flex: 1, padding: "13px 0", borderRadius: 14, background: `linear-gradient(135deg, ${CYAN}, #00a88e)`, border: "none", color: "#001a16", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne', sans-serif", boxShadow: `0 4px 16px ${CYAN}55` }}>
                      Novo Scan
                    </motion.button>
                  </div>
                  <button onClick={() => { stopCamera(); setLocation("/perfil"); }} style={{ background: "none", border: "none", color: "#71717a", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>
                    Fechar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
