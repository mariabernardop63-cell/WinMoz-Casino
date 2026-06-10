/* Reuse the context pre-warmed by Layout's useAudioWarmup() if available,
   otherwise create a fresh one. This ensures the sound plays reliably even
   on strict autoplay-policy browsers (Android Chrome, Safari). */
function getAudioContext(): AudioContext | null {
  try {
    // Prefer the globally pre-warmed context
    const prewarmed: AudioContext | undefined = (window as any).__adminAudioCtx;
    if (prewarmed && prewarmed.state !== "closed") {
      if (prewarmed.state === "suspended") prewarmed.resume().catch(() => {});
      return prewarmed;
    }

    // Fallback: create a new one (requires user gesture to have occurred)
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC() as AudioContext;
    (window as any).__adminAudioCtx = ctx;
    return ctx;
  } catch {
    return null;
  }
}

export function playAdminNotificationSound(type: "deposit" | "withdrawal" = "deposit") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume()
        .then(() => _play(ctx, type))
        .catch(() => {});
    } else {
      _play(ctx, type);
    }
  } catch { /* noop */ }
}

function _play(ctx: AudioContext, type: "deposit" | "withdrawal") {
  const now = ctx.currentTime;

  // Master gain — moderate volume, not too jarring
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.5, now);
  master.connect(ctx.destination);

  if (type === "deposit") {
    // Ascending 3-note chime: pleasant "money in" sound
    _tone(ctx, master, 880,  now,       0.14, "sine");
    _tone(ctx, master, 1100, now + 0.12, 0.13, "sine");
    _tone(ctx, master, 1320, now + 0.24, 0.22, "sine");
  } else {
    // 4-note attention sequence: distinct "action needed" sound
    _tone(ctx, master, 660,  now,        0.13, "sine");
    _tone(ctx, master, 880,  now + 0.13, 0.12, "sine");
    _tone(ctx, master, 1100, now + 0.25, 0.12, "sine");
    _tone(ctx, master, 880,  now + 0.36, 0.20, "sine");
  }
}

function _tone(
  ctx: AudioContext,
  dest: GainNode,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  // Attack → sustain → decay envelope
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.9, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + duration + 0.025);
}
