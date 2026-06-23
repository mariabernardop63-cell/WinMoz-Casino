const AD_SRCDOC = `<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; overflow: hidden; }
html, body { width: 320px; height: 50px; background: transparent; }
</style>
</head>
<body>
<script>
atOptions = {
  'key' : 'ee2e54a091a2ed3089fa43f7b0d711a0',
  'format' : 'iframe',
  'height' : 50,
  'width' : 320,
  'params' : {}
};
</script>
<script src="https://www.highperformanceformat.com/ee2e54a091a2ed3089fa43f7b0d711a0/invoke.js"></script>
</body>
</html>`;

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
        overflow: "visible",
      }}
    >
      <iframe
        srcDoc={AD_SRCDOC}
        width={320}
        height={50}
        frameBorder={0}
        scrolling="no"
        style={{ border: "none", display: "block", overflow: "hidden" }}
        title="Anúncio"
      />
    </div>
  );
}
