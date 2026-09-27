// Text embeddings with Supabase's built-in gte-small model (§ M6). Runs inside the edge runtime:
// memory text is not sent to any third party for embedding.
declare const Supabase: {
  ai: { Session: new (model: string) => { run(input: string, opts: { mean_pool: boolean; normalize: boolean }): Promise<unknown> } };
};

export const EMBED_DIM = 384;
let session: InstanceType<typeof Supabase.ai.Session> | null = null;

export async function embed(text: string): Promise<number[]> {
  session ??= new Supabase.ai.Session('gte-small');
  return (await session.run(text.slice(0, 2000), { mean_pool: true, normalize: true })) as number[];
}
