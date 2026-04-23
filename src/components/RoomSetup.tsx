"use client";

import { useState } from "react";
import { connectSocket } from "@/lib/socket";

interface RoomSetupProps {
  onJoin: (roomCode: string, playerName: string, isHost: boolean) => void;
}

export default function RoomSetup({ onJoin }: RoomSetupProps) {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createRoom = async () => {
    if (!playerName) return alert("名前を入力してください");
    setIsLoading(true);

    try {
      const socket = await connectSocket();
      socket.emit("create-room", playerName, ({ roomCode, player }: any) => {
        onJoin(roomCode, playerName, true);
        setIsLoading(false);
      });
    } catch {
      alert("サーバーへの接続に失敗しました");
      setIsLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!roomCode || !playerName) return alert("部屋コードと名前を入力してください");
    setIsLoading(true);

    try {
      const socket = await connectSocket();
      socket.emit("join-room", { roomCode: roomCode.toUpperCase(), playerName }, ({ player, error }: any) => {
        if (error) {
          alert(error);
          setIsLoading(false);
          return;
        }
        onJoin(roomCode.toUpperCase(), playerName, false);
        setIsLoading(false);
      });
    } catch {
      alert("サーバーへの接続に失敗しました");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-md p-8 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20 shadow-2xl">
      <h2 className="text-2xl font-bold text-center text-white">DraftMach 入室</h2>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">あなたの名前</label>
          <input
            type="text"
            className="w-full p-3 rounded-lg bg-black/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="シャーレの先生"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>

        <div className="pt-4 border-t border-white/10">
          <button
            onClick={createRoom}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            新しくルームを作成
          </button>
        </div>

        <div className="relative py-4 flex items-center">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink mx-4 text-white/30 text-xs">または</span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">部屋コード</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-grow p-3 rounded-lg bg-black/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              placeholder="ABCD12"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
            />
            <button
              onClick={joinRoom}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              参加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
