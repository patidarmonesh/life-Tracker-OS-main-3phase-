const fs = require('fs');
let code = fs.readFileSync('src/pages/Finance.jsx', 'utf8');

const replacement = `function TodayTab({ expenses, today }) {
  const todayExpenses = expenses.filter(e => e.date === today);
  const totalSpent = spendOf(todayExpenses);
  const { updateModule } = useAppActions();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64 = evt.target.result.split(',')[1];
        try {
          const res = await fetch('/ai/extract-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, purpose: 'bill' })
          });
          const data = await res.json();
          updateModule('finance', prev => ({
            ...prev,
            expenses: [...(prev.expenses || []), {
              id: crypto.randomUUID(),
              amount: data.total || 0,
              title: data.merchant || 'Uploaded Receipt',
              date: today,
              category: data.category || 'Miscellaneous',
              billOCRText: JSON.stringify(data.items || []),
            }]
          }));
        } catch (err) {
          console.error(err);
          alert("OCR extraction requires Gemini keys in your env to work locally!");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch(err) {
      setLoading(false);
    }
  };

  return (
    <div className="ui-grid gap-4 mt-4">
      <StatCard
        title="Spent Today"
        value={formatMoney(totalSpent)}
        icon={<IndianRupee className="w-5 h-5" />}
        trend={totalSpent > 0 ? 'down' : 'up'}
      />
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="primary" icon={<Plus />}>Add Manual</Button>
        <Button variant="secondary" icon={<Receipt />} onClick={() => fileRef.current?.click()} disabled={loading}>
          {loading ? 'AI Extracting...' : 'Upload Receipt'}
        </Button>
        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} ref={fileRef} onChange={handleUpload} />
      </div>
      
      <Card title="Transactions" className="mt-4">
        {todayExpenses.length === 0 ? (
          <EmptyState
            icon={<Wallet />}
            title="No expenses today"
            message="You haven't logged any expenses yet."
          />
        ) : (
          <div className="ui-col gap-2">
            {todayExpenses.map(exp => (
              <div key={exp.id} className="ui-row justify-between items-center p-3 rounded bg-zinc-50 dark:bg-zinc-800/50">
                <div className="ui-row items-center gap-3">
                  <div className="text-xl">{exp.billOCRText ? '🧾' : (exp.categoryEmoji || '💸')}</div>
                  <div>
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{exp.title}</div>
                    <div className="text-xs text-zinc-500">{exp.category} {exp.billOCRText ? '· AI Extracted' : ''}</div>
                  </div>
                </div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {compactMoney(exp.amount)}
                </div>
              </div>
            ))}
            <Button variant="ghost" className="mt-2 w-full">Confirm no more spending</Button>
          </div>
        )}
      </Card>
    </div>
  );
}`;

code = code.replace(/function TodayTab\(\{ expenses, today \}\) \{[\s\S]*?<\/Card>\s*<\/div>\s*\);\s*\}/, replacement);
fs.writeFileSync('src/pages/Finance.jsx', code);
