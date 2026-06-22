import { useEffect, useRef, useState } from "react";

export default function AdBanner({ className }: { className?: string }) {
  const [script, setScript] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    fetch("/api/ad-script")
      .then(r => r.json())
      .then((data: { script?: string | null }) => {
        if (data?.script?.trim()) setScript(data.script.trim());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!script || !containerRef.current || injectedRef.current) return;
    injectedRef.current = true;
    const container = containerRef.current;
    container.innerHTML = "";

    const temp = document.createElement("div");
    temp.innerHTML = script;

    Array.from(temp.childNodes).forEach(node => {
      if (node instanceof HTMLScriptElement) {
        const s = document.createElement("script");
        if (node.src) {
          s.src = node.src;
          s.async = true;
        } else {
          s.textContent = node.textContent;
        }
        Array.from(node.attributes).forEach(attr => {
          if (attr.name !== "src") s.setAttribute(attr.name, attr.value);
        });
        container.appendChild(s);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    });
  }, [script]);

  if (!script) return null;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        minHeight: 50,
        maxHeight: 60,
        borderRadius: 10,
        background: "rgba(0,0,0,0.03)",
      }}
    >
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", justifyContent: "center" }} />
    </div>
  );
}
