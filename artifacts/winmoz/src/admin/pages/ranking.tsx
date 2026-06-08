import { useState } from "react";
import { useGetRanking } from "@/admin/lib/supabase-api";
import { Trophy, Medal } from "lucide-react";

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shadow-md"><Trophy className="w-4 h-4 text-white" /></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center shadow-md"><Medal className="w-4 h-4 text-white" /></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center shadow-md"><Medal className="w-4 h-4 text-white" /></div>;
  return <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">#{rank}</div>;
}

export default function Ranking() {
  const [gameFilter, setGameFilter] = useState("all");
  const { data: ranking, isLoading } = useGetRanking({ game: gameFilter as "dama" | "ludo" | "all" });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ranking</h1>
        <p className="text-sm text-gray-500 mt-0.5">Classificação geral dos jogadores</p>
      </div>

      {/* Top 3 podium */}
      {!isLoading && (ranking ?? []).length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[ranking![1], ranking![0], ranking![2]].map((entry, idx) => {
            if (!entry) return null;
            const heights = ["h-28", "h-36", "h-28"];
            const gradients = [
              "from-gray-200 to-gray-300",
              "from-yellow-400 to-yellow-500",
              "from-orange-300 to-orange-400"
            ];
            return (
              <div key={entry.playerId} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-end ${heights[idx]}`}>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradients[idx]} flex items-center justify-center text-white text-lg font-bold mb-2 shadow-md`}>
                  {((entry.username || "?")[0] ?? "?").toUpperCase()}
                </div>
                <div className="font-semibold text-gray-800 text-sm">{entry.username}</div>
                <div className="text-xs text-gray-400">{entry.wins}V · {entry.winRate}%</div>
                <div className="text-xs font-bold text-indigo-600 mt-1">MT {entry.totalEarnings.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          {["all", "dama", "ludo"].map(g => (
            <button
              key={g}
              data-testid={`filter-ranking-${g}`}
              onClick={() => setGameFilter(g)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${gameFilter === g ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {g === "all" ? "Todos" : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        <div className="divide-y divide-gray-50">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="px-5 py-4 h-16 animate-pulse bg-gray-50 m-2 rounded-xl" />)
          ) : (ranking ?? []).length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Sem dados de ranking</div>
          ) : (
            (ranking ?? []).map((entry) => (
              <div key={entry.playerId} data-testid={`rank-row-${entry.playerId}`} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                <RankIcon rank={entry.rank} />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {((entry.username || "?")[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">{entry.username}</div>
                  <div className="text-xs text-gray-400">{entry.wins}V / {entry.losses}D</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-indigo-600">{entry.winRate}%</div>
                  <div className="text-xs text-gray-400">Win Rate</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">MT {entry.totalEarnings.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">Ganhos</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
