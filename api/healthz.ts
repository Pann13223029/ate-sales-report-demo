export default async function handler(
  _: unknown,
  res: {
    status: (code: number) => { json: (value: Record<string, unknown>) => void };
  }
): Promise<void> {
  res.status(200).json({
    ok: true,
    status: 'healthy',
    runtime: 'vercel-function'
  });
}
