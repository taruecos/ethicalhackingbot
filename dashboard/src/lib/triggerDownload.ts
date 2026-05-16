/**
 * Trigger a browser download for an in-memory Blob.
 *
 * Why this util exists:
 * Modern browsers (Chrome, Firefox, Safari) silently ignore programmatic
 * `<a>.click()` when the anchor is not part of the live DOM. The pattern
 * `createElement('a') -> click()` without `appendChild` works in some
 * browsers and tab states but fails in others, with no console error.
 *
 * The reliable cross-browser sequence is:
 *   create -> set href + download -> appendChild -> click -> remove -> revoke
 *
 * Call sites:
 *   - FindingDrawer "Generate Report" (markdown export)
 *   - FindingsPage BulkActionsBar (CSV export + markdown report)
 *   - PayoutsTab "Export CSV"
 *
 * @param blob     The Blob to download.
 * @param filename The filename the browser should suggest to the user.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the browser has time to start the download stream.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
