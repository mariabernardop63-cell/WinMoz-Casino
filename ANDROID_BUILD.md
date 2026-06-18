# MozBet — Android APK Build Guide

## Arquitectura

O APK é gerado automaticamente pelo **GitHub Actions** em cada push para `main`.  
Não precisas de instalar o Android Studio.

```
push para main
     │
     ▼
GitHub Actions (ubuntu-latest)
     │
     ├─ pnpm install + vite build
     ├─ npx cap add android (geração automática)
     ├─ npx cap sync android
     ├─ Patches de segurança (ProGuard, HTTPS, assinatura)
     ├─ Keystore decode (do secret KEYSTORE_BASE64)
     ├─ ./gradlew assembleRelease
     │
     ▼
MozBet-release-#N.apk  (disponível em Actions → Artifacts)
```

---

## Passo 1 — Gerar o Keystore (UMA VEZ APENAS)

O keystore é a "assinatura digital" do teu APK. **Guarda-o em local seguro.**  
Se o perderes, nunca mais podes publicar actualizações para o mesmo APK.

```bash
# Instala o JDK (se não tiveres)
# Windows: https://adoptium.net/
# Mac: brew install --cask temurin

# Gerar keystore (corre isto uma única vez)
keytool -genkey -v \
  -keystore mozbet-release.keystore \
  -alias mozbet \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -storetype PKCS12

# Preenche os dados:
# - "What is your first and last name?" → MozBet
# - "What is the name of your organization?" → MozBet
# - "What is the name of your City or Locality?" → Maputo
# - "What is the name of your State or Province?" → Maputo
# - "What is the two-letter country code?" → MZ
```

---

## Passo 2 — Converter para Base64

```bash
# macOS / Linux
base64 -i mozbet-release.keystore | tr -d '\n'

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("mozbet-release.keystore"))
```

Copia o output — vais precisar no próximo passo.

---

## Passo 3 — Adicionar os Secrets no GitHub

No teu repositório GitHub:  
**Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Valor |
|---|---|
| `KEYSTORE_BASE64` | O base64 do keystore (do Passo 2) |
| `KEYSTORE_PASSWORD` | A password que definiste no keytool |
| `KEY_ALIAS` | `mozbet` |
| `KEY_PASSWORD` | A key password (igual à KEYSTORE_PASSWORD se usaste a mesma) |
| `VITE_SUPABASE_URL` | A tua URL do Supabase (ex: `https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | A tua anon key do Supabase |
| `VERCEL_PRODUCTION_URL` | URL do teu deploy Vercel (ex: `https://mozbet.vercel.app`) |

---

## Passo 4 — Fazer o primeiro build

```bash
git add .
git commit -m "feat: add Android APK build"
git push origin main
```

O GitHub Actions inicia automaticamente. Vai a:  
**Actions → Build Android APK → (último workflow) → Artifacts**

Descarrega o ficheiro `MozBet-release-#N.zip`, extrai e instala o `.apk` no Android.

---

## Como instalar no Android

1. No telemóvel: **Definições → Segurança → Instalar apps de fontes desconhecidas** (ON)
2. Copia o APK para o telemóvel (Bluetooth, Drive, WhatsApp, etc.)
3. Abre o ficheiro `.apk` e confirma a instalação
4. Após publicar na Play Store, este passo deixa de ser necessário

---

## Segurança implementada

| Camada | Descrição |
|---|---|
| **APK Signing** (keystore RSA 4096) | Impede modificação e redistribuição |
| **ProGuard / R8** | Ofusca e minimiza o código Java e JS |
| **Network Security Config** | Bloqueia todo o tráfego HTTP (apenas HTTPS) |
| **WebView debug desactivado** | `setWebContentsDebuggingEnabled(false)` |
| **allowBackup=false** | Impede backup não autorizado dos dados da app |
| **Servidor live (Vercel)** | Toda a lógica crítica corre no servidor, nunca no cliente |
| **RLS + Service Role API** | Validação server-side de apostas e saldos |

---

## Publicar na Google Play Store (opcional)

Para distribuir a utilizadores sem precisarem de instalar manualmente:

1. Cria conta de developer: https://play.google.com/console (25 USD, uma vez)
2. Cria nova app → Upload o APK gerado
3. Preenche ficha da app (screenshots, descrição, política de privacidade)
4. Nota: apps de apostas precisam de verificação especial na Play Store (categoria "gambling")

---

## Perguntas frequentes

**P: O site fica afectado?**  
R: Não. O site Vercel continua igual. O APK é uma camada nativa em cima.

**P: Se actualizar o site, o APK actualiza automaticamente?**  
R: Sim! O APK carrega o site a partir da URL do Vercel em tempo real.

**P: Posso ter versões diferentes do site e do APK?**  
R: Sim, mas como o APK carrega sempre do Vercel, vês sempre a versão mais recente.

**P: O keystore pode ser regenerado?**  
R: Não. Se perderes o keystore, tens de criar uma nova app na Play Store.
