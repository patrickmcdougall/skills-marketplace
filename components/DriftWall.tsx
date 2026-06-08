"use client";

import { SkillCard } from "@/components/SkillCard";
import type { Skill } from "@/lib/data";

interface DriftWallProps {
  skills: Skill[];
}

export function DriftWall({ skills }: DriftWallProps) {
  // Double the set for seamless infinite scroll
  const track = [...skills, ...skills];

  return (
    <div className="lp-wall" aria-label="Drifting wall of recently-verified skills">
      <div className="lp-wall-track">
        {track.map((s, i) => (
          <SkillCard key={`${s.id}-${i}`} skill={s} context="wall" trust="verified" />
        ))}
      </div>
    </div>
  );
}
