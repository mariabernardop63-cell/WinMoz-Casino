#!/usr/bin/env bash
set -e

ANDROID_DIR="${1:-android}"
SECURITY_DIR="$(dirname "$0")"

echo "📦 Applying Android security patches to: $ANDROID_DIR"

echo "  → ProGuard rules"
cp "$SECURITY_DIR/proguard-rules.pro" "$ANDROID_DIR/app/proguard-rules.pro"

echo "  → Network security config"
mkdir -p "$ANDROID_DIR/app/src/main/res/xml"
cp "$SECURITY_DIR/network_security_config.xml" \
   "$ANDROID_DIR/app/src/main/res/xml/network_security_config.xml"

echo "  → Enabling ProGuard in build.gradle"
python3 - "$ANDROID_DIR/app/build.gradle" << 'PYEOF'
import sys, re
path = sys.argv[1]
with open(path, "r") as f:
    content = f.read()
content = re.sub(r'(buildTypes\s*\{[^}]*release\s*\{[^}]*)minifyEnabled\s+false', r'\1minifyEnabled true', content, flags=re.DOTALL)
content = re.sub(r'(buildTypes\s*\{[^}]*release\s*\{[^}]*)shrinkResources\s+false', r'\1shrinkResources true', content, flags=re.DOTALL)
if 'minifyEnabled' not in content:
    content = re.sub(r'(release\s*\{)', r'\1\n            minifyEnabled true\n            shrinkResources true', content)
with open(path, "w") as f:
    f.write(content)
print("    build.gradle patched")
PYEOF

echo "  → AndroidManifest hardening"
MANIFEST="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
python3 - "$MANIFEST" << 'PYEOF'
import sys, re
path = sys.argv[1]
with open(path, "r") as f:
    content = f.read()
attrs_to_add = {
    'android:allowBackup': '"false"',
    'android:networkSecurityConfig': '"@xml/network_security_config"',
    'android:usesCleartextTraffic': '"false"',
}
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
print("    AndroidManifest.xml patched")
PYEOF

echo "  → WebView debug disabled"
MAIN_ACTIVITY=$(find "$ANDROID_DIR/app/src/main/java" -name "MainActivity.java" 2>/dev/null | head -1)
if [ -n "$MAIN_ACTIVITY" ]; then
    if ! grep -q "setWebContentsDebuggingEnabled" "$MAIN_ACTIVITY"; then
        python3 - "$MAIN_ACTIVITY" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path, "r") as f:
    content = f.read()
if "android.webkit.WebView" not in content:
    content = content.replace("import android.os.Bundle;", "import android.os.Bundle;\nimport android.webkit.WebView;")
if "setWebContentsDebuggingEnabled" not in content:
    content = content.replace("super.onCreate(savedInstanceState);", "WebView.setWebContentsDebuggingEnabled(false);\n        super.onCreate(savedInstanceState);")
with open(path, "w") as f:
    f.write(content)
print(f"    MainActivity patched: {path}")
PYEOF
    fi
fi

echo ""
echo "✅ All security patches applied successfully!"
