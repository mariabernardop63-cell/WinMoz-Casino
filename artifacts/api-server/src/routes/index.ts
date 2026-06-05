import { Router, type IRouter } from "express";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

router.post("/complete-registration", async (req, res) => {
  try {
    const { user_id, full_name, phone, invite_code_used } = req.body as {
      user_id?: string;
      full_name?: string;
      phone?: string;
      invite_code_used?: string;
    };

    if (!user_id) {
      res.status(400).json({ error: "user_id is required" });
      return;
    }

    res.json({ success: true, user_id, full_name, phone, invite_code_used });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Recharge code validation ── */
router.post("/recharge", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code || code.length !== 15) {
      res.status(400).json({ error: "Código inválido" });
      return;
    }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!supabaseUrl || !supabaseServiceKey) {
      req.log.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
      res.status(500).json({ error: "Serviço indisponível" });
      return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the user JWT and get user id
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      res.status(401).json({ error: "Sessão inválida" });
      return;
    }
    const userId = userData.user.id;

    // Look up the recharge code — must exist, be unused and belong to this platform
    const { data: codeRow, error: codeError } = await supabaseAdmin
      .from("recharge_codes")
      .select("id, amount, used, used_by")
      .eq("code", code)
      .single();

    if (codeError || !codeRow) {
      res.status(400).json({ error: "Código inválido ou não encontrado" });
      return;
    }

    if (codeRow.used) {
      res.status(400).json({ error: "Código já utilizado" });
      return;
    }

    const amount: number = Number(codeRow.amount);
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Código sem valor associado" });
      return;
    }

    // Mark code as used
    const { error: markError } = await supabaseAdmin
      .from("recharge_codes")
      .update({ used: true, used_by: userId, used_at: new Date().toISOString() })
      .eq("id", codeRow.id);

    if (markError) {
      req.log.error({ markError }, "Failed to mark recharge code as used");
      res.status(500).json({ error: "Erro ao processar recarga" });
      return;
    }

    // Credit user balance
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      res.status(500).json({ error: "Erro ao obter saldo do utilizador" });
      return;
    }

    const currentBalance = Number(profileData.balance ?? 0);
    const newBalance = currentBalance + amount;

    const { error: balanceError } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (balanceError) {
      req.log.error({ balanceError }, "Failed to update user balance");
      res.status(500).json({ error: "Erro ao actualizar saldo" });
      return;
    }

    // Record transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "recharge",
      amount,
      description: "Recarga de saldo",
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, amount });
  } catch (err) {
    req.log.error({ err }, "Recharge error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── AI Support Chat (Groq) ── */
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";

const SYSTEM_PROMPT = `Tu és o assistente de suporte da WinMoz, uma plataforma de apostas e jogos online em Moçambique.
Responde SEMPRE em Português de Moçambique.
Sê amigável, profissional e conciso nas respostas.
Ajuda com: depósitos via M-Pesa/e-Mola, levantamentos, apostas, regras dos jogos (Damas, Ludo, Xadrez, Roleta), conta e código promocional.
Nunca inventes saldos, transações ou dados do utilizador.
Se não souberes algo específico, diz que vais encaminhar para a equipa humana de suporte.
Responde em texto simples sem asteriscos, hífens de lista ou markdown.`;

router.post("/support/chat", async (req, res) => {
  try {
    const groqKey = process.env["GROQ_API_KEY"];

    if (!groqKey) {
      res
        .status(200)
        .json({
          reply:
            "O serviço de suporte IA não está disponível de momento. Contacta-nos pelo WhatsApp ou email listados no menu.",
        });
      return;
    }

    const { messages } = req.body as {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Groq API error");
      res
        .status(200)
        .json({
          reply:
            "Ocorreu um erro ao processar a tua mensagem. Por favor tenta novamente.",
        });
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply =
      data.choices?.[0]?.message?.content?.trim() ??
      "Desculpa, não consegui processar a tua pergunta. Tenta novamente.";

    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Support chat error");
    res
      .status(200)
      .json({
        reply: "Ocorreu um erro interno. Por favor tenta novamente em instantes.",
      });
  }
});

/* ── Withdraw ── */
router.post("/withdraw", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { amount, phone } = req.body as { amount?: number; phone?: string };
    if (!amount || amount <= 0) { res.status(400).json({ error: "Valor inválido" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    const { data: profileData, error: profileError } = await admin
      .from("profiles").select("balance, full_name, phone").eq("id", userId).single();
    if (profileError || !profileData) { res.status(500).json({ error: "Erro ao obter perfil" }); return; }

    const currentBalance = parseFloat(String(profileData.balance ?? "0"));
    if (currentBalance < amount) {
      res.status(400).json({ error: "Saldo insuficiente" }); return;
    }

    const newBalance = Math.round((currentBalance - amount) * 100) / 100;
    const { error: balanceError } = await admin
      .from("profiles").update({ balance: newBalance }).eq("id", userId);
    if (balanceError) { res.status(500).json({ error: "Erro ao debitar saldo" }); return; }

    const withdrawalPhone = phone ?? profileData.phone ?? null;
    const withdrawalMeta = JSON.stringify({
      method: "M-Pesa",
      phone: withdrawalPhone,
      userName: profileData.full_name ?? "utilizador",
    });

    const { data: txRow, error: txError } = await admin
      .from("transactions").insert({
        user_id: userId,
        type: "withdrawal",
        amount: -amount,
        description: withdrawalMeta,
        status: "pending",
        created_at: new Date().toISOString(),
      }).select("id").single();

    if (txError) {
      req.log.error({ txError }, "Failed to record withdrawal transaction");
      const { error: restoreError } = await admin
        .from("profiles").update({ balance: currentBalance }).eq("id", userId);
      if (restoreError) req.log.error({ restoreError }, "Failed to restore balance after tx error");
      res.status(500).json({ error: "Erro ao registar levantamento" }); return;
    }

    res.json({ success: true, withdrawalId: txRow.id, newBalance });
  } catch (err) {
    req.log.error({ err }, "Withdraw error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Admin: Approve withdrawal ── */
router.post("/admin/withdraw/approve", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id } = req.body as { id?: string };
    if (!id) { res.status(400).json({ error: "id required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is authenticated
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }

    // Fetch the withdrawal transaction
    const { data: txData, error: txFetchError } = await admin
      .from("transactions").select("id, amount, user_id, status").eq("id", id).single();
    if (txFetchError || !txData) { res.status(404).json({ error: "Levantamento não encontrado" }); return; }
    if (txData.status !== "pending") { res.status(400).json({ error: "Levantamento já processado" }); return; }

    const { error: updateError } = await admin
      .from("transactions").update({ status: "approved" }).eq("id", id);
    if (updateError) { res.status(500).json({ error: "Erro ao aprovar" }); return; }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin approve withdrawal error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Admin: Reject withdrawal ── */
router.post("/admin/withdraw/reject", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id, reason } = req.body as { id?: string; reason?: string };
    if (!id) { res.status(400).json({ error: "id required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const { data: txData, error: txFetchError } = await admin
      .from("transactions").select("id, amount, user_id, status").eq("id", id).single();
    if (txFetchError || !txData) { res.status(404).json({ error: "Levantamento não encontrado" }); return; }
    if (txData.status !== "pending") { res.status(400).json({ error: "Levantamento já processado" }); return; }

    // Mark as rejected
    const { error: updateError } = await admin
      .from("transactions").update({ status: "rejected" }).eq("id", id);
    if (updateError) { res.status(500).json({ error: "Erro ao rejeitar" }); return; }

    // Restore user balance
    const withdrawalAmount = Math.abs(Number(txData.amount ?? 0));
    if (withdrawalAmount > 0 && txData.user_id) {
      const { data: profileData } = await admin
        .from("profiles").select("balance").eq("id", txData.user_id).single();
      if (profileData) {
        const restored = Math.round((Number(profileData.balance ?? 0) + withdrawalAmount) * 100) / 100;
        await admin.from("profiles").update({ balance: restored }).eq("id", txData.user_id);
      }
    }

    res.json({ success: true, reason: reason ?? "" });
  } catch (err) {
    req.log.error({ err }, "Admin reject withdrawal error");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
