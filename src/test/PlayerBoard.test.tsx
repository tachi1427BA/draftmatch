import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlayerBoard from "@/components/PlayerBoard";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

describe("PlayerBoard", () => {
  const students = [
    { id: 1, name: "Alice", icon: "/alice.png", role: "striker" as const },
    { id: 2, name: "Beth", icon: "/beth.png", role: "striker" as const },
    { id: 3, name: "Cara", icon: "/cara.png", role: "striker" as const },
    { id: 4, name: "Dina", icon: "/dina.png", role: "striker" as const },
    { id: 5, name: "Erin", icon: "/erin.png", role: "special" as const },
    { id: 6, name: "Faye", icon: "/faye.png", role: "special" as const },
  ];

  const player = {
    id: "player-1",
    name: "たち",
    isHost: true,
    team: {
      strikers: [1, 2, 3, 4],
      specials: [5, 6],
    },
    lastPickStatus: "pending",
  };

  it("renders the compact board with a full-width slot row", () => {
    render(<PlayerBoard player={player} students={students} compact />);

    expect(screen.getByTestId("compact-player-board")).toHaveClass("min-w-[220px]");
    expect(screen.getByTestId("compact-slot-row")).toHaveClass("w-full", "min-w-0");
  });

  it("accepts a custom compact width class", () => {
    render(
      <PlayerBoard
        player={player}
        students={students}
        compact
        compactWidthClassName="min-w-[320px] basis-[320px]"
      />
    );

    expect(screen.getByTestId("compact-player-board")).toHaveClass("min-w-[320px]", "basis-[320px]");
  });

  it("renders all six compact slots inside the board", () => {
    render(<PlayerBoard player={player} students={students} compact />);

    const board = screen.getByTestId("compact-player-board");

    expect(within(board).getByTestId("compact-slot-st-0")).toBeInTheDocument();
    expect(within(board).getByTestId("compact-slot-st-1")).toBeInTheDocument();
    expect(within(board).getByTestId("compact-slot-st-2")).toBeInTheDocument();
    expect(within(board).getByTestId("compact-slot-st-3")).toBeInTheDocument();
    expect(within(board).getByTestId("compact-slot-sp-0")).toBeInTheDocument();
    expect(within(board).getByTestId("compact-slot-sp-1")).toBeInTheDocument();
  });
});
