"use client";

import { useEffect } from "react";

export function useDisableContextMenuAndShortcuts() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.shiftKey && key === "i") {
        event.preventDefault();
        return;
      }

      if (modifier && !event.shiftKey && !event.altKey && key === "u") {
        event.preventDefault();
      }
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);
}
