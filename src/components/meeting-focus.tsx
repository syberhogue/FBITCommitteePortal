"use client";

import { useEffect } from "react";

export function MeetingFocus({ meetingId }: { meetingId: string }) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const meeting = document.getElementById(`meeting-${meetingId}`);
      if (!meeting) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      meeting.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      meeting.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [meetingId]);

  return null;
}
