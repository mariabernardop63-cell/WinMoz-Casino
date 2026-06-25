import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, Shield, Scale, AlertTriangle, CreditCard, Lock, Users, Globe, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBrand } from "@/lib/brand-context";

function PokerLogo() {
  const { brandName, brandSubtitle } = useBrand();
  return (
    <svg viewBox="0 0 190 46" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D" />
      <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18" />
      <text x="23" y="27" fontFamily="'Syne', sans-serif" fontWeight="800" fontSize="22" letterSpacing="0.5" fill="#0D0D0D">{brandName}</text>
      <text x="23" y="41" fontFamily="'Syne', sans-serif" fontWeight="300" fontSize="11" letterSpacing="3" fill="#0D0D0D">{brandSubtitle}</text>
    </svg>
  );
}

const DEFAULT_CONTENT = `
## 1. Aceitação dos Termos

Ao aceder e utilizar a plataforma WinMoz, o utilizador declara ter lido, compreendido e aceite na íntegra os presentes Termos e Condições de Utilização. Caso não concorde com qualquer disposição, deverá abster-se de utilizar a plataforma.

## 2. Elegibilidade e Registo

2.1. A utilização da WinMoz está restrita a indivíduos com idade igual ou superior a 18 anos, residentes em Moçambique.

2.2. O registo na plataforma implica a criação de uma conta pessoal e intransmissível. O utilizador é inteiramente responsável pela confidencialidade das suas credenciais de acesso.

2.3. É proibido criar múltiplas contas. Em caso de deteção de contas duplicadas, a plataforma reserva-se o direito de suspender ou encerrar todas as contas associadas, sem reembolso de saldos.

2.4. As informações fornecidas no momento do registo devem ser verdadeiras, completas e atualizadas. A WinMoz pode solicitar documentos comprovativos de identidade a qualquer momento.

## 3. Jogos e Apostas

3.1. A WinMoz oferece jogos de entretenimento com apostas reais, incluindo Damas, Ludo, Xadrez, Roleta e Bilhar.

3.2. Todas as apostas são definitivas após confirmação. Não são aceites cancelamentos após o início da partida.

3.3. As apostas são processadas em Metical Moçambicano (MZN). Conversões para outras moedas são meramente indicativas.

3.4. O utilizador reconhece que os jogos envolvem risco de perda do valor apostado. A WinMoz não garante ganhos.

3.5. Qualquer tentativa de manipulação dos resultados, uso de software de assistência não autorizado, ou comportamento fraudulento resultará na suspensão imediata da conta e possível reporte às autoridades competentes.

## 4. Depósitos e Levantamentos

4.1. Os depósitos são processados via e-Mola (M-Pesa em breve), através do gateway seguro Debito Pay.

4.2. Os levantamentos estão sujeitos a verificação de identidade e podem demorar até 24 horas úteis a ser processados.

4.3. O valor mínimo de levantamento é de 100 MT. Podem aplicar-se taxas de processamento conforme indicado na plataforma.

4.4. A WinMoz reserva-se o direito de suspender levantamentos em caso de suspeita de fraude ou atividade irregular.

4.5. Saldos inativos por mais de 12 meses podem estar sujeitos a taxas de inatividade, conforme política vigente.

## 5. Jogo Responsável

5.1. A WinMoz promove práticas de jogo responsável. Encorajamos os utilizadores a estabelecerem limites de apostas diárias e a contactarem suporte caso sintam que o jogo está a afetar negativamente a sua vida.

5.2. Os utilizadores podem auto-excluir-se temporariamente ou permanentemente através das definições da conta.

5.3. É expressamente proibido jogar sob influência de substâncias que comprometam o julgamento.

## 6. Bónus e Promoções

6.1. Bónus e promoções estão sujeitos a termos e condições específicos divulgados no momento da oferta.

6.2. O uso abusivo de promoções ou bónus poderá resultar na anulação dos mesmos e suspensão da conta.

## 7. Propriedade Intelectual

7.1. Todo o conteúdo da plataforma WinMoz, incluindo logótipos, designs, textos e software, é propriedade exclusiva da WinMoz e está protegido por leis de propriedade intelectual.

7.2. É proibida a reprodução, distribuição ou modificação de qualquer conteúdo da plataforma sem autorização expressa por escrito.

## 8. Limitação de Responsabilidade

8.1. A WinMoz não se responsabiliza por perdas decorrentes de falhas técnicas, interrupções de serviço, ou erros de terceiros.

8.2. A plataforma é fornecida "tal como está", sem garantias implícitas de disponibilidade contínua ou ausência de erros.

8.3. A responsabilidade máxima da WinMoz perante qualquer utilizador fica limitada ao saldo disponível na conta do utilizador à data do incidente.

## 9. Alterações aos Termos

A WinMoz reserva-se o direito de alterar os presentes Termos a qualquer momento. As alterações serão notificadas com antecedência mínima de 7 dias. A continuação do uso da plataforma após as alterações constitui aceitação dos novos termos.

## 10. Lei Aplicável e Foro

Os presentes Termos são regidos pela legislação moçambicana. Qualquer litígio será submetido à jurisdição exclusiva dos tribunais de Maputo, Moçambique.

## 11. Contactos

Para esclarecimentos sobre os presentes Termos, contacte-nos através do suporte integrado na plataforma ou pelo endereço eletrónico indicado nas informações da empresa.
`;

interface Section {
  icon: React.ElementType;
  title: string;
  content: string;
}

function parseSections(text: string): Section[] {
  const icons: React.ElementType[] = [Scale, Users, CreditCard, Shield, Lock, Globe, FileText, AlertTriangle, Phone, FileText, Scale, Phone];
  const chunks = text.trim().split(/\n## /);
  return chunks.map((chunk, i) => {
    const lines = chunk.replace(/^## /, "").split("\n");
    const title = lines[0].trim();
    const content = lines.slice(1).join("\n").trim();
    return { icon: icons[i % icons.length], title, content };
  }).filter(s => s.title);
}

export default function TermosServico() {
  const [, setLocation] = useLocation();
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "terms_of_service_content")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setContent(data.value);
        setLoading(false);
      }, () => setLoading(false));
  }, []);

  const sections = parseSections(content);

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">

        <div className="flex items-center gap-3 px-5 pt-12 pb-6 border-b border-slate-100">
          <button onClick={() => setLocation("/definicoes")}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors"
            style={{ borderRadius: 0 }}>
            <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
          </button>
          <div className="flex-1">
            <h1 className="font-syne font-bold text-xl text-[#0a0a0a]">Termos de Serviço</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Leia atentamente antes de utilizar</p>
          </div>
          <PokerLogo />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid #e5e7eb", borderTopColor: "#000" }} className="animate-spin" />
          </div>
        ) : (
          <div className="flex-1 px-5 py-5 pb-24 overflow-y-auto">

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-6 p-4"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div className="flex items-start gap-3">
                <Shield style={{ width: 16, height: 16, color: "#64748b", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                  Estes Termos de Serviço regem a utilização da plataforma WinMoz. Ao criar uma conta, confirma ter 18 anos ou mais e aceitar estes termos.
                </p>
              </div>
            </motion.div>

            {sections.map(({ icon: Icon, title, content: secContent }, idx) => (
              <motion.div key={idx} className="mb-3"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}>
                <button
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  className="w-full flex items-center gap-3 py-3.5 px-4 text-left transition-colors hover:bg-slate-50"
                  style={{ border: "1px solid #e5e7eb", background: expandedIdx === idx ? "#f8fafc" : "#fff" }}>
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                    style={{ background: expandedIdx === idx ? "#000" : "#f8fafc", border: "1px solid #e5e7eb", transition: "all 0.2s" }}>
                    <Icon style={{ width: 14, height: 14, color: expandedIdx === idx ? "#fff" : "#374151" }} />
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#111", flex: 1 }}>{title}</span>
                  <motion.span
                    animate={{ rotate: expandedIdx === idx ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ fontSize: 16, color: "#9ca3af", lineHeight: 1 }}>
                    ▾
                  </motion.span>
                </button>
                {expandedIdx === idx && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ borderLeft: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", padding: "14px 16px", background: "#fafafa" }}>
                    {secContent.split("\n").filter(Boolean).map((line, li) => (
                      <p key={li} style={{ fontSize: 12.5, color: "#4b5563", lineHeight: 1.7, marginBottom: 6 }}>
                        {line}
                      </p>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ))}

            <div className="mt-6 p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div className="flex items-start gap-2.5">
                <FileText style={{ width: 14, height: 14, color: "#9ca3af", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
                  Última actualização: 1 de Junho de 2025. Para dúvidas, contacte o suporte através da aplicação.
                </p>
              </div>
            </div>

          </div>
        )}

        <div className="px-5 pb-8 border-t border-slate-100 pt-4">
          <button
            onClick={() => setLocation("/definicoes")}
            style={{
              width: "100%", padding: "15px", background: "#000", color: "#fff",
              fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
              fontFamily: "'Syne', sans-serif", borderRadius: 0,
            }}>
            Li e Aceito os Termos
          </button>
        </div>
      </div>
    </div>
  );
}
