import { useEffect, useRef } from "react";

const AD_SCRIPT_INLINE = `atOptions = {
  'key' : 'ee2e54a091a2ed3089fa43f7b0d711a0',
  'format' : 'iframe',
  'height' : 50,
  'width' : 320,
  'params' : {}
};`;

const AD_SCRIPT_SRC = "https://www.highperformanceformat.com/ee2e54a091a2ed3089fa43f7b0d711a0/invoke.js";

export default function AdBanner({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || injectedRef.current) return;
    injectedRef.current = true;
    const container = containerRef.current;

    // 1. Inline script — sets atOptions synchronously
    const inline = document.createElement("script");
    inline.textContent = AD_SCRIPT_INLINE;
    container.appendChild(inline);

    // 2. External script — reads atOptions, creates the ad iframe
    const ext = document.createElement("script");
    ext.src = AD_SCRIPT_SRC;
    ext.async = false;
    container.appendChild(ext);
  }, []);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        minHeight: 50,
      }}
    >
      <div ref={containerRef} />
    </div>
  );
}
