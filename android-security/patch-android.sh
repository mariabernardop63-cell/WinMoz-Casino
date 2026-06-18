#!/usr/bin/env bash
# ============================================================
#  MozBet — Android Security Patcher
#  Applies security hardening to the generated Capacitor
#  Android project. Run AFTER `npx cap add android`.
# ============================================================

set -e

ANDROID_DIR="${1:-android}"
SECURITY_DIR="$(dirname "$0")"

echo "📦 Applying Android security patches to: $ANDROID_DIR"

# ── 1. ProGuard rules ──────────────────────────────────────
echo "  → ProGuard rules"
cp "$SECURITY_DIR/proguard-rules.pro" "$ANDROID_DIR/app/proguard-rules.pro"

# ── 2. Network security config ────────────────────────────
echo "  → Network security config"
mkdir -p "$ANDROID_DIR/app/src/main/res/xml"
cp "$SECURITY_DIR/network_security_config.xml" \
   "$ANDROID_DIR/app/src/main/res/xml/network_security_config.xml"

# ── 3. Signing + build hardening (apply from) ─────────────
echo "  → Signing & build config"
SIGNING_LINE='apply from: "../../../android-security/signing.gradle"'
if ! grep -qF "$SIGNING_LINE" "$ANDROID_DIR/app/build.gradle"; then
    echo "" >> "$ANDROID_DIR/app/build.gradle"
    echo "$SIGNING_LINE" >> "$ANDROID_DIR/app/build.gradle"
fi

# ── 4. Harden AndroidManifest.xml ─────────────────────────
echo "  → AndroidManifest hardening"
MANIFEST="$ANDROID_DIR/app/src/main/AndroidManifest.xml"

python3 - "$MANIFEST" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, "r") as f:
    content = f.read()

attrs_to_add = {
    'android:allowBackup':           '"false"',
    'android:networkSecurityConfig': '"@xml/network_security_config"',
    'android:usesCleartextTraffic':  '"false"',
}

# Find the <application tag and add/replace attrs
def patch_application_tag(m):
    tag = m.group(0)
    for attr, val in attrs_to_add.items():
        existing = re.search(rf'{re.escape(attr)}="[^"]*"', tag)
        if existing:
            tag = tag.replace(existing.group(0), f'{attr}={val}')
        else:
            tag = tag.replace('<application', f'<application\n        {attr}={val}', 1)
    return tag

content = re.sub(r'<application\b[^>]*>', patch_application_tag, content, flags=re.DOTALL)

with open(path, "w") as f:
    f.write(content)

print("    AndroidManifest.xml patched successfully")
PYEOF

# ── 5. Disable WebView debugging in MainActivity ──────────
echo "  → WebView debug disabled"
MAIN_ACTIVITY=$(find "$ANDROID_DIR/app/src/main/java" -name "MainActivity.java" 2>/dev/null | head -1)
if [ -n "$MAIN_ACTIVITY" ]; then
    # Add WebView.setWebContentsDebuggingEnabled(false) before super.onCreate if not present
    if ! grep -q "setWebContentsDebuggingEnabled" "$MAIN_ACTIVITY"; then
        python3 - "$MAIN_ACTIVITY" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, "r") as f:
    content = f.read()

# Add import
if "android.webkit.WebView" not in content:
    content = content.replace(
        "import android.os.Bundle;",
        "import android.os.Bundle;\nimport android.webkit.WebView;"
    )

# Add WebView debug disable before super.onCreate
if "setWebContentsDebuggingEnabled" not in content:
    content = content.replace(
        "super.onCreate(savedInstanceState);",
        "// Disable WebView remote debugging in production\n        WebView.setWebContentsDebuggingEnabled(false);\n        super.onCreate(savedInstanceState);"
    )

with open(path, "w") as f:
    f.write(content)

print(f"    MainActivity patched: {path}")
PYEOF
    fi
fi

echo ""
echo "✅ All security patches applied successfully!"
