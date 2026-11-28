/** Build the reviewed-revision handoff without performing a Finalization command. */
export function finalizationHandoffHref(projectId: string, reviewedProjectVersion: number): string {
  if (!projectId || !Number.isSafeInteger(reviewedProjectVersion) || reviewedProjectVersion < 1) {
    throw new Error('A Project ID and a positive reviewed revision are required.');
  }
  return `/projects/${encodeURIComponent(projectId)}/finalize?reviewedProjectVersion=${reviewedProjectVersion}`;
}
