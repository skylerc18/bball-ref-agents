"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_VIDEO_ANGLES } from "@/lib/constants";
import type { CameraAngle } from "@/types/domain";

function toAngle(index: number, file: File): CameraAngle {
  return {
    id: `angle-${index + 1}`,
    label: `Angle ${index + 1}`,
    fileName: file.name,
    fileSize: file.size,
    srcUrl: URL.createObjectURL(file),
  };
}

export function useClipUpload() {
  const [angles, setAngles] = useState<CameraAngle[]>([]);

  const setFromFiles = useCallback((files: FileList | null) => {
    if (!files) {
      return;
    }

    const next = Array.from(files)
      .slice(0, MAX_VIDEO_ANGLES)
      .map((file, index) => toAngle(index, file));

    setAngles((prev) => {
      prev.forEach((angle) => URL.revokeObjectURL(angle.srcUrl));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setAngles((prev) => {
      prev.forEach((angle) => URL.revokeObjectURL(angle.srcUrl));
      return [];
    });
  }, []);

  useEffect(() => clear, [clear]);

  return {
    angles,
    setFromFiles,
    clear,
  };
}
