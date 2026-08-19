"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { secondaryButtonClass } from "@/components/ui";

export function BlockedStartButton({
  committeeId,
  activeMeeting,
}: {
  committeeId: string;
  activeMeeting: { id: string; title: string };
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={`${secondaryButtonClass} border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100`}
      onClick={() => {
        const openCurrent = window.confirm(
          `“${activeMeeting.title}” is already in progress. Complete or archive it before starting another meeting. Open the current meeting now?`,
        );
        if (openCurrent) {
          router.push(
            `/committees/${committeeId}?tab=meetings&meetingView=in-progress&focus=${activeMeeting.id}#meeting-${activeMeeting.id}`,
          );
        }
      }}
    >
      <AlertTriangle className="size-4" /> Finish current meeting first
    </button>
  );
}
