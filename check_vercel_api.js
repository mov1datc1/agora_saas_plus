async function check() {
  const res = await fetch('https://agora-saas-plus.vercel.app/api/metrics/firms');
  const data = await res.json();
  
  // The data contains multiple rows per transaction if multiple advisors were involved, 
  // so we need to deduplicate by transactionId
  const uniqueTx = new Map();
  for (const item of data) {
    if (item.transactionId && !uniqueTx.has(item.transactionId)) {
      uniqueTx.set(item.transactionId, item);
    }
  }

  const transactions = Array.from(uniqueTx.values());
  console.log("Total unique transactions mapped in Firm API:", transactions.length);

  const byYear = {};
  for (const tx of transactions) {
    if (!tx.fecha) continue;
    const year = new Date(tx.fecha).getFullYear();
    byYear[year] = (byYear[year] || 0) + 1;
  }
  console.log("Transactions by year:", byYear);
}
check().catch(console.error);
