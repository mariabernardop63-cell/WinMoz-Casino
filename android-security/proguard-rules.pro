# ============================================================
#  MozBet — ProGuard / R8 rules
#  Applied to the release APK to obfuscate code and
#  make reverse-engineering significantly harder.
# ============================================================

# ── Capacitor core (must be kept) ──
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.mozbet.app.** { *; }

# ── Supabase / network libs ──
-keep class io.github.jan.supabase.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# ── WebView bridge ──
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Prevent stripping of enums ──
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Serialization ──
-keepclassmembers class * implements java.io.Serializable {
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ── General hardening ──
# Remove log calls in release (reduces attack surface)
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# ── Aggressive obfuscation ──
-repackageclasses 'mz.bet'
-allowaccessmodification
-optimizationpasses 5
-dontpreverify

# ── Keep crash reporting attributes ──
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
