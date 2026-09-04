/* Per-user in-process locks: serialise balance mutations to prevent
   parallel-request double-spend (read-modify-write races). */
const userLocks = new Map<string, Promise<void>>();

export async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  userLocks.set(userId, prev.then(() => gate));
  await prev.catch(() => { /* previous op failed — continue */ });
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === gate) userLocks.delete(userId);
  }
}
