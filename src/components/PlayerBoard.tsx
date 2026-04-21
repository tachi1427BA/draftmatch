"use client";

import { Student } from "@/lib/studentLoader";
import Image from "next/image";

interface PlayerBoardProps {
  player: {
    id: string;
    name: string;
    isHost: boolean;
    team: {
      strikers: number[];
      specials: number[];
    };
    lastPickStatus?: string;
  };
  students: Student[];
  compact?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  won: "✅ 獲得済",
  lost: "❌ 抽選敗退",
  pending: "⏳ 選択中",
  abandoned: "🔄 選び直し",
  finished_round: "✔ 完了",
};

export default function PlayerBoard({ player, students, compact = false }: PlayerBoardProps) {
  const renderSlot = (id: number | null, label: string, key: string) => {
    const student = id ? students.find((s) => s.id === id) : null;
    const size = compact ? "w-10 h-10 sm:w-12 sm:h-12" : "w-full aspect-square";

    return (
      <div key={key} className={compact ? "flex flex-col items-center" : "flex flex-col items-center gap-1"}>
        <div className={`${size} bg-black/30 border border-white/20 rounded-lg overflow-hidden relative flex-shrink-0`}>
          {student ? (
            <>
              <Image
                src={student.icon}
                alt={student.name}
                fill
                sizes={compact ? "48px" : "(max-width: 640px) 15vw, 10vw"}
                className="object-cover object-top"
              />
              <div className="absolute top-1 left-1 rounded-full bg-black/70 text-[8px] uppercase px-2 py-0.5 text-white">
                {student.role === 'striker' ? 'ST' : 'SP'}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              <span className="text-[8px]">{label}</span>
            </div>
          )}
        </div>
        {!compact && student && (
          <span className="text-[9px] text-white truncate w-full text-center leading-tight">
            {student.name}
          </span>
        )}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex-shrink-0 p-3 bg-white/5 border border-white/10 rounded-xl min-w-[220px]">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-white text-sm truncate">{player.name}</span>
            {player.isHost && (
              <span className="flex-shrink-0 text-[9px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 px-1 py-0.5 rounded">
                HOST
              </span>
            )}
          </div>
          <span className="flex-shrink-0 text-[10px] text-white/60">
            {player.lastPickStatus ? STATUS_LABEL[player.lastPickStatus] ?? "" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => renderSlot(player.team.strikers[i] || null, `S${i + 1}`, `st-${i}`))}
          </div>
          <div className="w-px h-8 bg-white/20 mx-0.5" />
          <div className="flex gap-1">
            {[0, 1].map((i) => renderSlot(player.team.specials[i] || null, `P${i + 1}`, `sp-${i}`))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{player.name}</span>
          {player.isHost && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 px-1.5 py-0.5 rounded">
              HOST
            </span>
          )}
        </div>
        <div className="text-xs text-white/60">
          {player.lastPickStatus ? STATUS_LABEL[player.lastPickStatus] ?? "" : ""}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[0, 1, 2, 3].map((i) => renderSlot(player.team.strikers[i] || null, `ST ${i + 1}`, `st-${i}`))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1].map((i) => renderSlot(player.team.specials[i] || null, `SP ${i + 1}`, `sp-${i}`))}
      </div>
    </div>
  );
}
