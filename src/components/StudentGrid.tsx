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

type RoleFilter = "all" | "striker" | "special";

export default function StudentGrid({ onSelect, selectedId, disabledIds = [], round, students }: StudentGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.includes(searchTerm);
    const matchesRole = roleFilter === "all" || s.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex flex-col h-full bg-white/10 p-4 rounded-lg backdrop-blur-md">
      <div className="mb-4 flex flex-col gap-3">
        <input
          type="text"
          placeholder="生徒名で検索..."
          className="w-full p-2 rounded bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all" as const, label: "すべて" },
            { value: "striker" as const, label: "ストライカー" },
            { value: "special" as const, label: "スペシャル" },
          ].map((option) => {
            const isActive = roleFilter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRoleFilter(option.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-500 text-white"
                    : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                )}
                aria-pressed={isActive}
              >
                {option.label}
              </button>
            );
          })}
        </div>
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
                <div className="absolute top-1 left-1 rounded-full bg-black/70 text-[9px] uppercase px-2 py-0.5 text-white">
                  {student.role === 'striker' ? 'ST' : 'SP'}
                </div>
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
