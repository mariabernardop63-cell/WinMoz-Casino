import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 8 }}>
        {title}
      </h2>
      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  );
}

export default function PoliticaPrivacidade() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">

        <div className="flex items-center gap-3 px-5 pt-12 pb-6 border-b border-slate-100">
          <button onClick={() => setLocation("/definicoes")}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors"
            style={{ borderRadius: 0 }}>
            <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
          </button>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: "#0a0a0a" }}>
              Política de Privacidade
            </h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
              Última actualização: 1 de Janeiro de 2026
            </p>
          </div>
        </div>

        <div className="mx-5 mt-5 p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 4 }}>
          <div className="flex items-start gap-2.5">
            <Shield style={{ width: 15, height: 15, color: "#64748b", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              A MozBet está comprometida com a protecção da tua privacidade. Esta política descreve como recolhemos, usamos e protegemos os teus dados pessoais.
            </p>
          </div>
        </div>

        <motion.div
          className="flex-1 px-5 py-5 pb-24 overflow-y-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >

          <Section title="1. Dados que Recolhemos">
            <p>Recolhemos os seguintes tipos de informação quando utilizas a plataforma MozBet:</p>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              <li><strong>Dados de identificação:</strong> nome, endereço de e-mail, número de telefone;</li>
              <li><strong>Dados financeiros:</strong> histórico de depósitos, levantamentos e transacções;</li>
              <li><strong>Dados de jogo:</strong> partidas disputadas, apostas realizadas e resultados;</li>
              <li><strong>Dados de dispositivo:</strong> tipo de dispositivo, sistema operativo e identificadores de sessão.</li>
            </ul>
          </Section>

          <Section title="2. Como Usamos os Teus Dados">
            <p>Os teus dados são utilizados para:</p>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              <li>Gerir a tua conta e processar transacções financeiras;</li>
              <li>Garantir a segurança e integridade da plataforma;</li>
              <li>Cumprir obrigações legais e regulatórias aplicáveis em Moçambique;</li>
              <li>Melhorar a experiência de jogo com base em análises anónimas;</li>
              <li>Enviar notificações relacionadas com a tua conta e actividade.</li>
            </ul>
          </Section>

          <Section title="3. Partilha de Dados">
            <p>
              Os teus dados pessoais <strong>não são vendidos</strong> a terceiros. Podemos partilhar informações
              apenas nas seguintes situações:
            </p>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              <li>Com fornecedores de serviços de pagamento (M-Pesa, e-Mola) para processar transacções;</li>
              <li>Quando exigido por lei ou autoridade competente em Moçambique;</li>
              <li>Para proteger os direitos, propriedade ou segurança da MozBet e dos seus utilizadores.</li>
            </ul>
          </Section>

          <Section title="4. Segurança dos Dados">
            <p>
              Utilizamos medidas técnicas e organizacionais adequadas para proteger os teus dados, incluindo
              encriptação SSL, autenticação segura e armazenamento em servidores protegidos. O acesso aos
              dados é restrito a pessoal autorizado.
            </p>
          </Section>

          <Section title="5. Retenção de Dados">
            <p>
              Conservamos os teus dados enquanto a tua conta estiver activa ou pelo período necessário para
              cumprir obrigações legais e regulatórias. Após o encerramento da conta, os dados são eliminados
              ou anonimizados num prazo máximo de 90 dias, salvo obrigação legal em contrário.
            </p>
          </Section>

          <Section title="6. Os Teus Direitos">
            <p>Tens os seguintes direitos sobre os teus dados pessoais:</p>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              <li><strong>Acesso:</strong> podes solicitar uma cópia dos teus dados em Definições → Privacidade → Exportar dados;</li>
              <li><strong>Rectificação:</strong> podes corrigir dados incorrectos no teu perfil;</li>
              <li><strong>Eliminação:</strong> podes solicitar a eliminação da tua conta e dados pessoais;</li>
              <li><strong>Portabilidade:</strong> podes exportar os teus extratos e histórico de transacções.</li>
            </ul>
          </Section>

          <Section title="7. Cookies e Tecnologias Similares">
            <p>
              Utilizamos armazenamento local (localStorage) para guardar as tuas preferências de aplicação,
              como idioma e métodos de pagamento. Não utilizamos cookies de rastreamento de terceiros.
            </p>
          </Section>

          <Section title="8. Jogo Responsável">
            <p>
              A MozBet promove o jogo responsável. Os dados de jogo podem ser utilizados internamente para
              identificar padrões de uso problemático e oferecer suporte proactivo. Nunca partilhamos
              esta informação com entidades externas sem o teu consentimento.
            </p>
          </Section>

          <Section title="9. Alterações a Esta Política">
            <p>
              Podemos actualizar esta política periodicamente. Quando o fizermos, notificaremos os utilizadores
              através da plataforma. A data da última actualização é indicada no topo desta página.
              A utilização continuada da plataforma após alterações constitui aceitação da política actualizada.
            </p>
          </Section>

          <Section title="10. Contacto">
            <p>
              Para questões relacionadas com a tua privacidade ou para exercer os teus direitos, contacta-nos
              através do Suporte disponível na aplicação ou pelos contactos indicados no rodapé da plataforma.
            </p>
          </Section>

          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16, marginTop: 8 }}>
            <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
              © {new Date().getFullYear()} MozBet. Todos os direitos reservados. +18 · Jogo responsável.
            </p>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
