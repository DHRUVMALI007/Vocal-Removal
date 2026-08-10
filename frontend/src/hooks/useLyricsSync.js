import { useEffect, useMemo, useRef } from "react";

export function useLyricsSync(lines, currentTime) {
  const activeRef = useRef(null);

  const activeIndex = useMemo(() => {
    if (!lines?.length) return -1;
    return lines.findIndex((l) => currentTime >= l.start && currentTime < l.end);
  }, [lines, currentTime]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  return { activeIndex, activeRef };
}
