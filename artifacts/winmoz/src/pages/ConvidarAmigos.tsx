import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Check, Share2, MessageSquare, Mail, Users, Gift, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

function fmtMZN(val: number) {
  return `${Number(val.toFixed(2)).toLocaleString("pt-PT")} MT`;
}

export default function ConvidarAmigos() {
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    if (profile?.my_invite_code) {
      setCode(profile.my_invite_code);
    }
    if (profile?.id) {
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", profile.id)
        .then(({ count }) => {
          if (count !== null) setReferralCount(count);
        });
    }
  }, [profile]);

  const earned = referralCount * 5;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareText = `Junta-te ao WinMoz e ganha bónus! Usa o meu código: ${code} — https://winmoz.app`;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "WinMoz — Convite", text: shareText }); } catch {}
    } else {
      handleCopy();
    }
  };

  const STEPS = [
    { icon: Share2,     label: "Convida um amigo",   desc: "Partilha o teu código único" },
    { icon: Users,      label: "O amigo regista-se", desc: "Com o teu código de convite" },
    { icon: TrendingUp, label: "Ele faz uma aposta", desc: "Qualquer valor, qualquer jogo" },
    { icon: Gift,       label: "Tu ganhas 5 MT",     desc: "Creditado automaticamente" },
  ];

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#0f0f0f" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen relative overflow-x-hidden">

        <div className="relative px-5 pt-12 pb-8 overflow-hidden"
          style={{ background: "linear-gradient(145deg, #c0392b 0%, #e74c3c 40%, #922b21 100%)" }}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10" style={{ background: "#fff" }} />
          <div className="absolute top-16 -left-6 w-24 h-24 rounded-full opacity-10" style={{ background: "#fff" }} />

          <button onClick={() => setLocation("/perfil")}
            className="flex items-center gap-2 mb-6 opacity-80 hover:opacity-100 transition-opacity">
            <ArrowLeft style={{ width: 20, height: 20, color: "#fff" }} />
            <span className="text-white text-sm font-medium">Voltar</span>
          </button>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Programa de Convites</p>
            <h1 className="font-syne font-bold text-white leading-tight mb-2" style={{ fontSize: "1.75rem" }}>
              Ganha bónus grátis<br />sem limites!
            </h1>
            <div className="flex items-center gap-2 mt-3">
              <div className="bg-white/20 backdrop-blur rounded-full px-4 py-2">
                <span className="text-white font-bold text-lg">1 Convite = 5 MT</span>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="flex" style={{ background: "#1a1a1a" }}>
          {[
            { label: "Amigos convidados", val: referralCount.toString() },
            { label: "Total ganho",       val: fmtMZN(earned) },
            { label: "Por convite",       val: "5 MT" },
          ].map(({ label, val }, i) => (
            <div key={label} className={`flex-1 flex flex-col items-center py-3 ${i < 2 ? "border-r border-white/10" : ""}`}>
              <p className="text-white font-bold text-lg font-syne">{val}</p>
              <p className="text-white/40 text-[10px] font-medium mt-0.5 text-center leading-tight">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 px-5 py-5 pb-10 overflow-y-auto">

          <div className="mb-6">
            <p className="text-white font-syne font-bold mb-3" style={{ fontSize: 15 }}>Como funciona</p>
            <div className="flex flex-col gap-2.5">
              {STEPS.map(({ icon: Icon, label, desc }, i) => (
                <motion.div key={label}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.32 }}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl"
                  style={{ background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(231,76,60,0.15)", border: "1px solid rgba(231,76,60,0.3)" }}>
                    <Icon style={{ width: 18, height: 18, color: "#e74c3c" }} />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{label}</p>
                    <p className="text-white/40 text-xs mt-0.5">{desc}</p>
                  </div>
                  <div className="ml-auto flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "#2a2a2a" }}>
                    <span style={{ fontSize: 10, color: "#e74c3c", fontWeight: 700 }}>{i + 1}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div className="mb-5"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.35 }}>
            <p className="text-white font-syne font-bold mb-3" style={{ fontSize: 15 }}>O teu código único</p>
            {code ? (
              <div className="rounded-2xl overflow-hidden" style={{ border: "2px dashed #e74c3c", background: "#1c1c1c" }}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-white/40 text-xs mb-1 uppercase tracking-widest">Código de Convite</p>
                    <p className="font-syne font-bold text-white" style={{ fontSize: "1.8rem", letterSpacing: "0.12em" }}>
                      {code}
                    </p>
                  </div>
                  <motion.button onClick={handleCopy} whileTap={{ scale: 0.92 }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                    style={{
                      background: copied ? "rgba(34,197,94,0.15)" : "rgba(231,76,60,0.15)",
                      border: copied ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(231,76,60,0.4)",
                      color: copied ? "#22c55e" : "#e74c3c",
                    }}>
                    {copied
                      ? <><Check style={{ width: 14, height: 14 }} /> Copiado</>
                      : <><Copy style={{ width: 14, height: 14 }} /> Copiar</>
                    }
                  </motion.button>
                </div>
                <div className="px-5 pb-3">
                  <p className="text-white/30 text-xs">Partilha este código com os teus amigos para ganhar 5 MT por cada aposta que eles fizerem</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-5 flex items-center justify-center" style={{ background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
                <p className="text-white/30 text-sm">Inicia sessão para ver o teu código</p>
              </div>
            )}
          </motion.div>

          <div className="p-4 rounded-2xl mb-5 flex items-start gap-3"
            style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.2)" }}>
            <Gift style={{ width: 16, height: 16, color: "#e74c3c", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-white font-semibold text-sm mb-1">Como ganhas 5 MT</p>
              <p className="text-white/50 text-xs leading-relaxed">
                O teu amigo regista-se com o teu código e faz pelo menos uma aposta. Os 5 MT são creditados automaticamente na tua carteira.
              </p>
            </div>
          </div>

          <p className="text-white font-syne font-bold mb-3" style={{ fontSize: 15 }}>Partilhar com amigos</p>
          <div className="flex flex-col gap-2.5 mb-6">
            {[
              { icon: MessageSquare, label: "SMS",   desc: "Envia por mensagem de texto",     color: "#22c55e" },
              { icon: Mail,          label: "Email",  desc: "Partilha por correio eletrónico",  color: "#3b82f6" },
            ].map(({ icon: Icon, label, desc, color }) => (
              <motion.button key={label} whileTap={{ scale: 0.97 }} onClick={handleShare}
                className="flex items-center gap-4 p-4 rounded-2xl text-left w-full transition-all hover:opacity-80"
                style={{ background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: color + "20", border: `1px solid ${color}40` }}>
                  <Icon style={{ width: 18, height: 18, color }} />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{label}</p>
                  <p className="text-white/40 text-xs mt-0.5">{desc}</p>
                </div>
                <span className="text-white/20 text-lg">›</span>
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {[
              { label: "WhatsApp", color: "#25D366", letter: "W" },
              { label: "Facebook", color: "#1877F2", letter: "f" },
              { label: "X",        color: "#000",    letter: "𝕏" },
              { label: "Mais",     color: "#6b7280", letter: "…" },
            ].map(({ label, color, letter }) => (
              <motion.button key={label} whileTap={{ scale: 0.92 }} onClick={handleShare}
                className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                  style={{ background: color, fontSize: label === "Mais" ? 18 : 16 }}>
                  {letter}
                </div>
                <span className="text-white/40 text-[9px]">{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
