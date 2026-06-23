export default function AdBanner({ className, compact }: { className?: string; compact?: boolean }) {
  const height = compact ? 44 : 50;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: height,
      }}
    >
      <iframe
        src="/ad-banner.html"
        width={320}
        height={height}
        frameBorder={0}
        scrolling="no"
        style={{ border: "none", display: "block" }}
        title="Anúncio"
      />
    </div>
  );
}
