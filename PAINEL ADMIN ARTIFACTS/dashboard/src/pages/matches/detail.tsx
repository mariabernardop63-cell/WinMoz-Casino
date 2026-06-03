import { useParams, useLocation } from "wouter";
import { useGetMatch, useResolveMatch, getGetMatchQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gamepad2, Trophy, Clock } from "lucide-react";
import { useState } from "react";

export default function MatchDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const id = Number(params.id);
  const { data: match, isLoading } = useGetMatch(id, { query: { enabled: !!id, queryKey: getGetMatchQueryKey(id) } });
  const resolveMatch = useResolveMatch();
  const [winnerId, setWinnerId] = useState<number | null>(null);

  function handleResolve() {
    if (!winnerId) return;
    resolveMatch.mutate({ id, data: { winnerId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(id) });
      }
    });
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse mb-6" />
        <div className="bg-white rounded-2xl p-6 h-64 animate-pulse" />
      </div>
    );
  }

  if (!match) {
    return <div className="p-6 text-gray-500">Partida não encontrada.</div>;
  }

  const statusColors: Record<string, string> = {
    live: "bg-green-100 text-green-700",
    finished: "bg-gray-100 text-gray-600",
    pending: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-6">
      <button data-testid="button-back" onClick={() => setLocation("/matches")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar às partidas
      </button>

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">Partida #{match.id}</span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${statusColors[match.status]}`}>
                    {match.status === "live" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />}
                    {match.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 capitalize">{match.game}</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-600">R$ {match.betAmount.toFixed(2)}</div>
                <div className="text-xs text-gray-400">Valor da aposta</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Jogador 1", name: match.player1Name, isWinner: match.winnerId !== null && match.winnerName === match.player1Name },
                { label: "Jogador 2", name: match.player2Name, isWinner: match.winnerId !== null && match.winnerName === match.player2Name },
              ].map((p) => (
                <div key={p.label} className={`rounded-2xl p-5 border-2 transition-all ${p.isWinner ? "border-yellow-300 bg-yellow-50" : "border-gray-100 bg-gray-50"}`}>
                  <div className="text-xs text-gray-400 font-medium mb-2">{p.label}</div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Gamepad2 className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{p.name}</div>
                      {p.isWinner && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                          <Trophy className="w-3 h-3" /> Vencedor
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {match.durationSeconds && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                Duração: {Math.floor(match.durationSeconds / 60)}m {match.durationSeconds % 60}s
              </div>
            )}
          </div>

          {match.status !== "finished" && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">Encerrar Partida</h3>
              <div className="flex gap-3 mb-4">
                {[
                  { id: 1, name: match.player1Name },
                  { id: 2, name: match.player2Name },
                ].map((p) => (
                  <button
                    key={p.id}
                    data-testid={`button-winner-${p.id}`}
                    onClick={() => setWinnerId(p.id)}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all ${winnerId === p.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-indigo-200"}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <button
                data-testid="button-resolve-match"
                onClick={handleResolve}
                disabled={!winnerId || resolveMatch.isPending}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {resolveMatch.isPending ? "Processando..." : "Confirmar Resultado"}
              </button>
            </div>
          )}
        </div>

        <div className="w-64 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="font-semibold text-gray-800 text-sm mb-3">Informações</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Jogo</span>
                <span className="font-medium text-gray-700 capitalize">{match.game}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className="font-medium text-gray-700 capitalize">{match.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Aposta</span>
                <span className="font-medium text-indigo-600">R$ {match.betAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Criado em</span>
                <span className="font-medium text-gray-700">{new Date(match.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
              {match.winnerId && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Vencedor</span>
                  <span className="font-semibold text-green-600">{match.winnerName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
