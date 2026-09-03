import fs from 'node:fs';

const workerPath = '.worker-build/worker.js';
if (!fs.existsSync(workerPath)) throw new Error(`Missing ${workerPath}. Run build-worker first.`);

let source = fs.readFileSync(workerPath, 'utf8');
const start = source.indexOf('async function billingDebitCredits(');
const end = source.indexOf('\nasync function billingUsage(', start);
if (start < 0 || end < 0) throw new Error('Unable to locate billingDebitCredits in generated worker.');

const replacement = `async function billingDebitCredits(e, { userId, amount, toolId, reference }) {
  const credits = Math.floor(Number(amount));
  if (!Number.isFinite(credits) || credits <= 0) throw new Error('Invalid credit amount.');
  const now = Math.floor(Date.now() / 1000);

  // Credits are authoritative in the main Nexauren DB (DB). The cached
  // credit_balances row is synchronized from the transaction ledger before
  // checking the balance, so stale cached values cannot reject a valid user.
  const balance = await e.DB.prepare('SELECT COALESCE(SUM(amount),0) AS balance FROM credit_transactions WHERE user_id=?1').bind(userId).first();
  const currentBalance = Number(balance?.balance || 0);
  if (currentBalance < credits) return { applied: false, idempotent: false, insufficient: true, balance: currentBalance };

  const existing = await e.DB.prepare('SELECT id,amount,tool_id,created_at FROM credit_transactions WHERE user_id=?1 AND reference=?2 LIMIT 1').bind(userId, reference).first();
  if (existing) return { applied: false, idempotent: true, transaction: existing, balance: currentBalance };

  const result = await e.DB.batch([
    e.DB.prepare("INSERT INTO credit_transactions (id,user_id,amount,type,description,reference,payment_id,tool_id,created_at) VALUES(?1,?2,?3,'usage',?4,?5,NULL,?6,?7)").bind(uuid(), userId, -credits, \`Tool usage: \${clean(toolId).slice(0, 120)}\`, reference, toolId, now),
    e.DB.prepare('INSERT OR IGNORE INTO credit_balances(user_id,balance,updated_at) VALUES(?1,0,?2)').bind(userId, now),
    e.DB.prepare('UPDATE credit_balances SET balance=(SELECT COALESCE(SUM(amount),0) FROM credit_transactions WHERE user_id=?1),updated_at=?2 WHERE user_id=?1').bind(userId, now),
  ]);
  const applied = Number(result?.[0]?.meta?.changes || 0) > 0;
  if (!applied) {
    const retry = await e.DB.prepare('SELECT id,amount,tool_id,created_at FROM credit_transactions WHERE user_id=?1 AND reference=?2 LIMIT 1').bind(userId, reference).first();
    if (retry) return { applied: false, idempotent: true, transaction: retry, balance: currentBalance };
    const latest = await e.DB.prepare('SELECT COALESCE(SUM(amount),0) AS balance FROM credit_transactions WHERE user_id=?1').bind(userId).first();
    return { applied: false, idempotent: false, insufficient: Number(latest?.balance || 0) < credits, balance: Number(latest?.balance || 0) };
  }

  await e.DB.prepare("INSERT INTO tool_usage(id,user_id,tool_id,credits,status,reference,created_at) SELECT ?1,?2,?3,?4,'consumed',?5,?6 FROM credit_transactions WHERE user_id=?2 AND reference=?5 LIMIT 1").bind(uuid(), userId, toolId, credits, reference, now).run();
  return { applied: true, idempotent: false, balance: currentBalance - credits };
}
`;

source = source.slice(0, start) + replacement + source.slice(end + 1);
fs.writeFileSync(workerPath, source);
console.log('Billing credit semantics patched: DB transaction ledger is authoritative.');
