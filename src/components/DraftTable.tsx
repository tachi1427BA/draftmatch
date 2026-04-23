"use client";

import { useEffect, useRef, useState } from "react";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { Student } from "@/lib/studentLoader";
import StudentGrid from "./StudentGrid";
import PlayerBoard from "./PlayerBoard";
import { Timer } from "lucide-react";
import Image from "next/image";

interface DraftTableProps {
  roomCode: string;
  playerName: string;
  isHost: boolean;
  students: Student[];
  onLeave: () => void;
}

const BATTLE_DURATION_SECONDS = 10 * 60;
const DEFAULT_BATTLE_DURATION_MINUTES = 10;

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function playTimeUpSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.6);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.6);
  oscillator.onended = () => {
    void audioContext.close();
  };
}

/** Full-screen lottery animation shown while currentPhase === 'resolving'. */
function LotteryOverlay({ conflictStudentIds, room, students }: {
  conflictStudentIds: number[];
  room: any;
  students: Student[];
}) {
  const conflictStudents = conflictStudentIds
    .map(id => students.find(s => s.id === id))
    .filter(Boolean) as Student[];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
      <h2 className="text-4xl sm:text-5xl font-black text-yellow-400 mb-2 animate-pulse tracking-wider">
        ⚔️ 抽選中...
      </h2>
      <p className="text-white/50 text-sm mb-10">同じ生徒を複数人が選択しました</p>

      <div className="flex flex-wrap justify-center gap-10">
        {conflictStudents.map(student => {
          const competing = room.draftHistory
            .filter((h: any) => h.studentId === student.id && h.round === room.currentRound && !h.isReplacement)
            .map((h: any) => room.players.find((p: any) => p.id === h.playerId)?.name)
            .filter(Boolean) as string[];

          return (
            <div key={student.id} className="flex flex-col items-center gap-4">
              {/* Icon with spinning rainbow border */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 overflow-hidden animate-lottery-spin animate-lottery-glow">
                <Image src={student.icon} alt={student.name} fill className="object-cover object-top" />
              </div>
              <span className="font-bold text-xl text-white">{student.name}</span>
              <div className="flex gap-2 flex-wrap justify-center">
                {competing.map(name => (
                  <span key={name} className="bg-white/15 border border-white/20 px-3 py-1 rounded-full text-sm text-white/90">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DraftTable({ roomCode, playerName, isHost, students, onLeave }: DraftTableProps) {
  const [room, setRoom] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [battleSecondsLeft, setBattleSecondsLeft] = useState(BATTLE_DURATION_SECONDS);
  const [battleStartedAt, setBattleStartedAt] = useState<number | null>(null);
  const [battleDurationSeconds, setBattleDurationSeconds] = useState(BATTLE_DURATION_SECONDS);
  const [battleDurationMinutesInput, setBattleDurationMinutesInput] = useState(String(DEFAULT_BATTLE_DURATION_MINUTES));
  const [connectionError, setConnectionError] = useState(false);
  const hasPlayedTimeUpSound = useRef(false);

  useEffect(() => {
    let mounted = true;
    let activeSocket = getSocket();

    const handleRoomUpdated = (updatedRoom: any) => {
      if (!mounted) return;
      setRoom(updatedRoom);
      setConnectionError(false);
    };

    const handleBattleTimerStarted = ({ startedAt, durationSeconds }: { startedAt: number; durationSeconds: number }) => {
      if (!mounted) return;
      setBattleStartedAt(startedAt);
      setBattleDurationSeconds(durationSeconds);
      setBattleDurationMinutesInput(String(Math.max(1, Math.floor(durationSeconds / 60))));
      hasPlayedTimeUpSound.current = false;
    };

    const handleRoomExpired = () => {
      if (!mounted) return;
      alert("一定時間操作がなかったためルームを終了しました");
      disconnectSocket();
      onLeave();
    };

    async function setupSocket() {
      try {
        activeSocket = await connectSocket();
        if (!mounted) return;

        activeSocket.on("room-updated", handleRoomUpdated);
        activeSocket.on("battle-timer-started", handleBattleTimerStarted);
        activeSocket.on("room-expired", handleRoomExpired);
        activeSocket.emit("get-room", roomCode);
      } catch {
        if (!mounted) return;
        setConnectionError(true);
      }
    }

    void setupSocket();

    return () => {
      mounted = false;
      activeSocket?.off("room-updated", handleRoomUpdated);
      activeSocket?.off("battle-timer-started", handleBattleTimerStarted);
      activeSocket?.off("room-expired", handleRoomExpired);
    };
  }, [onLeave, roomCode]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnectSocket();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (room?.status !== "battling") {
      setBattleSecondsLeft(BATTLE_DURATION_SECONDS);
      setBattleStartedAt(null);
      setBattleDurationSeconds(BATTLE_DURATION_SECONDS);
      setBattleDurationMinutesInput(String(DEFAULT_BATTLE_DURATION_MINUTES));
      hasPlayedTimeUpSound.current = false;
      return;
    }

    if (battleStartedAt == null) {
      setBattleSecondsLeft(battleDurationSeconds);
      return;
    }

    const updateCountdown = () => {
      const elapsedSeconds = Math.floor((Date.now() - battleStartedAt) / 1000);
      const remainingSeconds = Math.max(0, battleDurationSeconds - elapsedSeconds);
      setBattleSecondsLeft(remainingSeconds);
    };

    updateCountdown();
    const timerId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [battleDurationSeconds, battleStartedAt, room?.status]);

  useEffect(() => {
    if (room?.status !== "battling" || battleStartedAt == null || battleSecondsLeft > 0 || hasPlayedTimeUpSound.current) {
      return;
    }

    hasPlayedTimeUpSound.current = true;
    playTimeUpSound();
  }, [battleSecondsLeft, battleStartedAt, room?.status]);

  const currentPlayer = room?.players.find((p: any) => p.name === playerName);
  const canManageRoom = currentPlayer?.isHost ?? isHost;

  const handlePick = () => {
    if (!selectedStudent || !currentPlayer) return;
    getSocket()?.emit("submit-pick", {
      roomCode,
      playerId: currentPlayer.id,
      student: selectedStudent,
    });
    setSelectedStudent(null);
  };

  const handleAbandon = (abandon: boolean) => {
    if (!currentPlayer) return;
    getSocket()?.emit("abandon-choice", { roomCode, playerId: currentPlayer.id, abandon });
  };

  const startDraft = () => {
    if (canManageRoom) getSocket()?.emit("start-draft", roomCode);
  };

  const nextRound = () => {
    if (canManageRoom) getSocket()?.emit("next-round", roomCode);
  };

  const startBattleTimer = () => {
    if (canManageRoom && room?.status === "battling" && battleStartedAt == null) {
      const parsedMinutes = parseInt(battleDurationMinutesInput, 10);
      const safeMinutes = Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : DEFAULT_BATTLE_DURATION_MINUTES;
      const durationSeconds = safeMinutes * 60;
      setBattleDurationSeconds(durationSeconds);
      setBattleDurationMinutesInput(String(safeMinutes));
      getSocket()?.emit("start-battle-timer", { roomCode, durationSeconds });
    }
  };

  const handleLeave = () => {
    disconnectSocket();
    onLeave();
  };

  if (connectionError) {
    return (
      <div className="flex flex-col items-center gap-4 text-white">
        <div>サーバーへの接続に失敗しました</div>
        <button onClick={handleLeave} className="rounded-lg bg-white/10 px-4 py-2 text-white hover:bg-white/20">
          トップに戻る
        </button>
      </div>
    );
  }

  if (!room || !currentPlayer) return <div className="text-white">読み込み中...</div>;

  // Students definitively on someone's team or abandoned.
  const teamStudentIds: number[] = room.players.flatMap((p: any) => [
    ...p.team.strikers,
    ...p.team.specials,
  ]);
  const activeDisabledIds = [...teamStudentIds, ...(room.abandonedStudentIds ?? [])];

  // Student submitted this round (shown in waiting bar).
  const pendingPickStudentId: number | undefined = room.draftHistory.find(
    (h: any) => h.playerId === currentPlayer.id && h.round === room.currentRound && !h.isReplacement
  )?.studentId;
  const pendingPickStudent = pendingPickStudentId != null
    ? students.find(s => s.id === pendingPickStudentId) ?? null
    : null;

  const showStudentGrid =
    room.currentPhase === 'picking' ||
    (room.currentPhase === 'abandoning' && currentPlayer.lastPickStatus === 'abandoned');

  const showConfirmBar =
    room.currentPhase === 'picking' ||
    currentPlayer.lastPickStatus === 'abandoned';

  return (
    <div className="flex flex-col h-screen bg-[#0a192f] text-white p-3 gap-3 overflow-hidden">
      {/* Lottery overlay */}
      {room.currentPhase === 'resolving' && (room.conflictStudentIds ?? []).length > 0 && (
        <LotteryOverlay
          conflictStudentIds={room.conflictStudentIds}
          room={room}
          students={students}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 flex-shrink-0">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold flex items-center gap-2">
            DraftMach
            <span className="text-xs font-normal text-white/50">Room: {roomCode}</span>
          </h1>
          <div className="text-xs text-blue-400">
            {room.status === 'waiting' && "待機中... プレイヤーを待っています"}
            {room.status === 'drafting' && `Round ${room.currentRound} — ${room.currentPhase === 'picking' ? '指名フェーズ' : room.currentPhase === 'resolving' ? '⚔️ 抽選中' : '獲得確認フェーズ'}`}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {room.status === 'waiting' && canManageRoom && (
            <button
              onClick={startDraft}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg font-bold text-sm transition-all"
            >
              ドラフト開始
            </button>
          )}
          <div className="flex -space-x-2">
            {room.players.map((p: any) => (
              <div
                key={p.id}
                className="w-7 h-7 rounded-full bg-blue-500 border-2 border-[#0a192f] flex items-center justify-center text-[10px] font-bold"
                title={p.name}
              >
                {p.name[0]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main area (flex-1) */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
        {room.status === 'drafting' ? (
          <>
            {/* Draft content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {room.currentPhase === 'abandoning' && currentPlayer.lastPickStatus !== 'abandoned' ? (
                <div className="h-full flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-white/10 p-8 text-center">
                  <h2 className="text-3xl font-bold mb-4 text-yellow-400">獲得確定！</h2>
                  {currentPlayer.lastPickStatus === 'won' ? (
                    <>
                      <p className="text-base text-white/70 mb-8">
                        獲得した生徒を「放棄」して別の生徒を選び直せます。<br />
                        放棄された生徒は今後誰も指名できなくなります。
                      </p>
                      <div className="flex gap-4">
                        <button onClick={() => handleAbandon(true)} className="bg-red-500 hover:bg-red-600 px-8 py-3 rounded-xl font-bold text-lg transition-all">放棄する</button>
                        <button onClick={() => handleAbandon(false)} className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-xl font-bold text-lg transition-all">キープ</button>
                      </div>
                    </>
                  ) : (
                    <p className="text-lg text-white/60">他のプレイヤーの選択を待っています...</p>
                  )}

                  {canManageRoom && room.players.every((p: any) => ['abandoned', 'finished_round'].includes(p.lastPickStatus)) && (
                    <button onClick={nextRound} className="mt-8 bg-blue-600 hover:bg-blue-700 px-12 py-4 rounded-xl font-black text-2xl animate-bounce">
                      次の巡目へ進む
                    </button>
                  )}
                </div>
              ) : (
                <StudentGrid
                  onSelect={setSelectedStudent}
                  selectedId={selectedStudent?.id}
                  disabledIds={activeDisabledIds}
                  round={room.currentRound}
                  students={students}
                />
              )}
            </div>

            {/* Confirm bar */}
            {showConfirmBar && (
              <div className="bg-white/5 px-4 py-3 rounded-xl border border-white/10 flex items-center justify-between flex-shrink-0">
                <div>
                  {selectedStudent ? (
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded border border-blue-400 overflow-hidden">
                        <Image src={selectedStudent.icon} alt={selectedStudent.name} fill className="object-cover object-top" />
                        <div className="absolute top-1 left-1 rounded-full bg-black/70 text-[9px] uppercase px-2 py-0.5 text-white">
                          {selectedStudent.role === 'striker' ? 'ST' : 'SP'}
                        </div>
                      </div>
                      <div>
                        <div className="font-bold">{selectedStudent.name} を選択中</div>
                        <div className="text-xs text-white/60">{selectedStudent.role === 'striker' ? 'ストライカー' : 'スペシャル'}</div>
                      </div>
                    </div>
                  ) : pendingPickStudent && currentPlayer.lastPickStatus === 'pending' ? (
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded border border-white/30 overflow-hidden">
                        <Image src={pendingPickStudent.icon} alt={pendingPickStudent.name} fill className="object-cover object-top" />
                      </div>
                      <span className="text-white/70">{pendingPickStudent.name} — 他のプレイヤーを待機中</span>
                    </div>
                  ) : (
                    <span className="text-white/40">生徒を選択してください</span>
                  )}
                </div>
                {pendingPickStudent && currentPlayer.lastPickStatus === 'pending' && !selectedStudent ? (
                  <button disabled className="bg-white/10 px-6 py-2 rounded-xl font-bold text-white/40 cursor-not-allowed">
                    待機中...
                  </button>
                ) : (
                  <button
                    disabled={!selectedStudent || !['pending', 'lost', 'abandoned'].includes(currentPlayer.lastPickStatus)}
                    onClick={handlePick}
                    className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 px-6 py-2 rounded-xl font-bold transition-all"
                  >
                    確定
                  </button>
                )}
              </div>
            )}
          </>
        ) : room.status === 'battling' ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-white/20 p-12">
            <h2 className="text-5xl font-black mb-8 text-blue-500">BATTLE START!</h2>
            {battleStartedAt == null ? (
              <div className="flex flex-col items-center gap-6 mb-12 text-center">
                <div className="flex items-center justify-center gap-4 text-6xl font-mono text-white">
                  <Timer size={48} className="text-blue-500" />
                  <span>{formatCountdown(battleDurationSeconds)}</span>
                </div>
                {canManageRoom ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-3">
                      <label htmlFor="battle-duration" className="text-white/70 text-sm">
                        タイマー分数
                      </label>
                      <input
                        id="battle-duration"
                        type="number"
                        min="1"
                        step="1"
                        value={battleDurationMinutesInput}
                        onChange={(event) => setBattleDurationMinutesInput(event.target.value)}
                        className="w-24 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-center text-white"
                      />
                      <span className="text-white/70">分</span>
                    </div>
                    <button
                      onClick={startBattleTimer}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-xl font-bold text-xl transition-all"
                    >
                      タイマー開始
                    </button>
                  </div>
                ) : (
                  <p className="text-white/60">ホストがタイマーを開始するのを待っています...</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 text-6xl font-mono text-white mb-12">
                <Timer size={48} className="text-blue-500" />
                <span>{formatCountdown(battleSecondsLeft)}</span>
              </div>
            )}
            <button onClick={handleLeave} className="text-white/30 hover:text-white">
              トップに戻る
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white/5 rounded-2xl border border-dashed border-white/20 text-white/40">
            ホストが開始するのを待っています...
          </div>
        )}
      </div>

      {/* Bottom strip: Player Boards (horizontal scroll) */}
      <div className="flex gap-3 overflow-x-auto pb-1 flex-shrink-0">
        {room.players.map((p: any) => (
          <PlayerBoard key={p.id} player={p} students={students} compact />
        ))}
      </div>
    </div>
  );
}
