#!/usr/bin/env bash
# Arranca o DeepSeek Harness web + proxy se ainda não estiverem a correr.
# Usado pelo workflow do Replit (.replit) no arranque do workspace.
set -u

DSH_BIN="$HOME/.config/npm/node_global/lib/node_modules/@deepseek-ai/dsh/lib/bin.js"
NODE22="$HOME/node22/bin/node"
PROXY="$HOME/workspace/tools/dsh-proxy.js"
WORKDIR="$HOME/workspace/artifacts/winmoz"

# Se ~/node22 não existir (workspace restaurado sem a pasta), tentar recriar
# a partir do bun/node disponível não é possível — avisar e sair.
if [ ! -x "$NODE22" ]; then
  echo "[dsh] AVISO: Node 22 não encontrado em $NODE22 — o Harness precisa dele."
  exit 0
fi

if ! curl -s -m 2 -o /dev/null "http://127.0.0.1:3999"; then
  echo "[dsh] A iniciar DeepSeek Harness (127.0.0.1:3999)..."
  cd "$WORKDIR" || exit 0
  nohup "$NODE22" "$DSH_BIN" --profile web --host 127.0.0.1 --port 3999 --no-open \
    > /tmp/dsh-web.log 2>&1 &
  echo "[dsh] arranque enviado (token/log: /tmp/dsh-web.log)"
else
  echo "[dsh] Harness já está a correr."
fi

if ! curl -s -m 2 -o /dev/null "http://127.0.0.1:3000"; then
  echo "[dsh] A iniciar proxy (0.0.0.0:3000)..."
  nohup "$NODE22" "$PROXY" > /tmp/dsh-proxy.log 2>&1 &
  echo "[dsh] proxy arranque enviado"
else
  echo "[dsh] Proxy já está a correr."
fi
