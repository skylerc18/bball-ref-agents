"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_VIDEO_ANGLES } from "@/lib/constants";
import type { CameraAngle } from "@/types/domain";

function toAngle(index: number, file: File): CameraAngle {
  return {
    id: `angle-${index + 1}`,
    label: `Angle ${index + 1}`,
    file,
    fileName: file.name,
    fileSize: file.size,
    srcUrl: URL.createObjectURL(file),
  };
}

type RemoteAngleInput = {
  id: string;
  label: string;
  srcUrl: string;
};

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

  const setFromRemote = useCallback((remoteAngles: RemoteAngleInput[]) => {
    const next = remoteAngles.slice(0, MAX_VIDEO_ANGLES).map((angle, index) => {
      const fileName = angle.srcUrl.split("/").at(-1) || `angle_${index + 1}.mp4`;
      return {
        id: angle.id || `angle-${index + 1}`,
        label: angle.label || `Angle ${index + 1}`,
        fileName,
        fileSize: 0,
        srcUrl: angle.srcUrl,
      } satisfies CameraAngle;
    });

    setAngles((prev) => {
      prev.forEach((angle) => {
        if (angle.file) {
          URL.revokeObjectURL(angle.srcUrl);
        }
      });
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setAngles((prev) => {
      prev.forEach((angle) => {
        if (angle.file) {
          URL.revokeObjectURL(angle.srcUrl);
        }
      });
      return [];
    });
  }, []);

  useEffect(() => clear, [clear]);

  return {
    angles,
    setFromFiles,
    setFromRemote,
    clear,
  };
}
