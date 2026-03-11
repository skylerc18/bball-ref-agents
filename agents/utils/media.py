from schemas.session import ClipInput


def clip_summary(clip: ClipInput) -> str:
    return f"{clip.clip_id} ({clip.angle_label}) @ {clip.storage_path}"
