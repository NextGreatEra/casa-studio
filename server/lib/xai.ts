const apiKey = process.env.XAI_API_KEY;

export function getXaiApiKey(): string | undefined {
  return apiKey;
}

/** xAI is the only model provider. Live calls are not wired in this harness. */
export async function runXai(_prompt: string): Promise<never> {
  void apiKey;
  throw new Error("not wired");
}
