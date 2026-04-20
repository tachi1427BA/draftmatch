"use client";

import { useState } from "react";
import { Student } from "@/lib/studentLoader";
import Image from "next/image";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StudentGridProps {
  onSelect: (student: Student) => void;
  selectedId?: number;
  disabledIds?: number[];
  round: number;
  students: Student[];
}

export default function StudentGrid({ onSelect, selectedId, disabledIds = [], round, students }: StudentGridProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStudents = students.filter((s) => {
    const nameMatches = s.name.includes(searchTerm);
    const roleMatches = round <= 4 ? s.role === 'striker' : s.role === 'special';
    return nameMatches && roleMatches;
  });

  return (
    <div className="flex flex-col h-full bg-white/10 p-4 rounded-lg backdrop-blur-md">
      <div className="mb-4">
        <input
          type="text"
          placeholder="生徒名で検索..."
          className="w-full p-2 rounded bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 overflow-y-auto max-h-[60vh] p-2">
        {filteredStudents.map((student) => {
          const isDisabled = disabledIds.includes(student.id);
          const isSelected = selectedId === student.id;

          return (
            <button
              key={student.id}
              onClick={() => !isDisabled && onSelect(student)}
              disabled={isDisabled}
              className={cn(
                "block w-full rounded-md border-2 transition-all",
                isSelected ? "border-yellow-400 scale-105 z-10 shadow-lg shadow-yellow-400/50" : "border-transparent hover:border-white/50",
                isDisabled ? "opacity-30 grayscale cursor-not-allowed" : "cursor-pointer"
              )}
              title={student.name}
            >
              <div className="relative aspect-square overflow-hidden rounded-sm group">
                <Image
                  src={student.icon}
                  alt={student.name}
                  fill
                  sizes="100px"
                  className="object-cover object-top"
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] py-0.5 text-center truncate px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {student.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
