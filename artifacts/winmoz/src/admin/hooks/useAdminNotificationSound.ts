let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playAdminNotificationSound(type: "deposit" | "withdrawal" = "deposit") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().then(() => _play(ctx, type)).catch(() => {});
    } else {
      _play(ctx, type);
    }
  } catch {
  }
}

function _play(ctx: AudioContext, type: "deposit" | "withdrawal") {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.55, now);
  master.connect(ctx.destination);

  if (type === "deposit") {
    _tone(ctx, master, 880, now,        0.12, "sine");
    _tone(ctx, master, 1100, now + 0.1, 0.12, "sine");
    _tone(ctx, master, 1320, now + 0.2, 0.18, "sine");
  } else {
    _tone(ctx, master, 660, now,        0.12, "sine");
    _tone(ctx, master, 880, now + 0.12, 0.12, "sine");
    _tone(ctx, master, 1100, now + 0.22, 0.12, "sine");
    _tone(ctx, master, 880, now + 0.32, 0.18, "sine");
  }
}

function _tone(
  ctx: AudioContext,
  dest: GainNode,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.9, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}
