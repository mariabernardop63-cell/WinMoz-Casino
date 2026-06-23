export default function AdBanner({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 50,
      }}
    >
      <iframe
        src="/ad-banner.html"
        width={320}
        height={50}
        frameBorder={0}
        scrolling="no"
        style={{ border: "none", display: "block" }}
        title="Anúncio"
      />
    </div>
  );
}
