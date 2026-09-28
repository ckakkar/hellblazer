/**
 * Hands a card the site drew (a PNG) to the share sheet: the iPhone app's
 * own (Save Image, Messages, Instagram), else the browser's when it can
 * share files, else a download. Resolves quietly when the lifter cancels.
 */
export async function shareImage(blob: Blob, fileName: string, text: string): Promise<void> {
  const { shareNatively } = await import("@/lib/native-plugins");
  if (await shareNatively(blob, fileName)) return;
  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Fatty", text });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") throw e;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
