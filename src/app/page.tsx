"use client";

import { useState, useEffect } from "react";
import RoomSetup from "@/components/RoomSetup";
import DraftTable from "@/components/DraftTable";
import { fetchStudents, Student } from "@/lib/studentLoader";
import { disconnectSocket } from "@/lib/socket";

export default function Home() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomData, setRoomData] = useState<{
    roomCode: string;
    playerName: string;
    isHost: boolean;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      const data = await fetchStudents();
      setStudents(data);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleJoin = (roomCode: string, playerName: string, isHost: boolean) => {
    setRoomData({ roomCode, playerName, isHost });
  };

  const handleLeave = () => {
    disconnectSocket();
    setRoomData(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050b16] flex flex-col items-center justify-center p-4">
        <div className="animate-pulse text-white text-xl font-bold">データを読み込み中...</div>
      </main>
    );
  }

  return (
    <main className={roomData ? "h-dvh overflow-hidden bg-[#050b16]" : "min-h-screen bg-[#050b16] flex items-center justify-center p-4"}>
      {roomData ? (
        <DraftTable
          roomCode={roomData.roomCode}
          playerName={roomData.playerName}
          isHost={roomData.isHost}
          students={students}
          onLeave={handleLeave}
        />
      ) : (
        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-6xl font-black text-white tracking-tighter mb-2">
              DRAFT<span className="text-blue-500">MACH</span>
            </h1>
            <p className="text-white/40 text-sm uppercase tracking-widest">
              Blue Archive Raid Draft Battle System
            </p>
          </div>
          <RoomSetup onJoin={handleJoin} />
        </div>
      )}
    </main>
  );
}
