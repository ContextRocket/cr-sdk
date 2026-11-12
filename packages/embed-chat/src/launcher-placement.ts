export interface PlacementRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Return the smallest upward offset that clears all overlapping page controls. */
export function launcherBottomLift(
  launcher: PlacementRect,
  controls: readonly PlacementRect[],
  gap = 12,
): number {
  if (launcher.bottom <= launcher.top || launcher.right <= launcher.left)
    return 0;

  const height = launcher.bottom - launcher.top;
  let top = launcher.top;
  for (let attempt = 0; attempt <= controls.length; attempt += 1) {
    const collisions = controls.filter(
      (control) =>
        control.bottom > control.top &&
        control.right > launcher.left &&
        control.left < launcher.right &&
        control.bottom > top &&
        control.top < top + height,
    );
    if (!collisions.length) break;
    const nextTop = Math.min(
      ...collisions.map((control) => control.top - height - gap),
    );
    if (nextTop >= top) break;
    top = nextTop;
  }
  return Math.ceil(launcher.top - top);
}
