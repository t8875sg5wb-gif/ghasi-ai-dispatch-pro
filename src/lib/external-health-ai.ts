export function externalHealthAiAllowed(
  configuredValue: string | undefined,
  externalProcessingApproved: boolean | undefined,
): boolean {
  return configuredValue === "true" && externalProcessingApproved === true;
}
