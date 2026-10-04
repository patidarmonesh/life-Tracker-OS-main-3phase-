import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar as CalendarIcon,
  Plus,
  IndianRupee,
  CreditCard,
  Receipt,
  PieChart as PieChartIcon,
  Target
} from 'lucide-react';
import {
  Page, Card, StatCard, Tabs, Button, EmptyState, ProgressBar, Chips, Ring, Sheet
} from '../ui/index';
import HeatCalendar from '../ui/calendar/HeatCalendar';
import YearHeatmap from '../ui/calendar/YearHeatmap';
import DateNavigator from '../ui/calendar/DateNavigator';
import { heatColor } from '../ui/calendar/calendarMath';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { useLocalPref } from '../ui/hooks';
import { fmtDate } from '../ui/format';
import { localDate } from '../domain/metrics/dates';
import { isFixedRecord } from '../domain/finance';
import { useAppState, useAppActions } from '../context/appHooks';

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'bills', label: 'Bills & Recurring' }
];

export default function Finance() {
  const state = useAppState();
  const [activeTab, setActiveTab] = useLocalPref('finance_tab', 'today');
  const [selectedDate, setSelectedDate] = useLocalPref('finance_date', localDate());
  
  const expenses = state.finance?.expenses || [];
  const monthlyBudget = state.settings?.preferences?.monthlyBudget || 30000;
  
  const today = localDate();
  
  return (
    <Page title="Money" className="pb-24 max-md:pb-24">
      <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'today' && (
            <TodayTab expenses={expenses} today={today} />
          )}
          {activeTab === 'month' && (
            <MonthTab expenses={expenses} selectedDate={selectedDate} onDateChange={setSelectedDate} budget={monthlyBudget} />
          )}
          {activeTab === 'year' && (
            <YearTab expenses={expenses} />
          )}
          {activeTab === 'bills' && (
            <BillsTab expenses={expenses} />
          )}
        </motion.div>
      </AnimatePresence>
      <div className="pb-24 h-24 min-h-[6rem] mb-12"></div>
    </Page>
  );
}

function TodayTab({ expenses, today }) {
  const todayExpenses = expenses.filter(e => e.date === today);
  const totalSpent = todayExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
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
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="ui-grid gap-4 mt-4">
      <Card className="p-4 bg-zinc-900 text-white rounded-none flex flex-col gap-1">
        <div className="text-zinc-400 text-sm">Spent Today</div>
        <div className="text-3xl font-semibold">₹{totalSpent.toLocaleString('en-IN')}</div>
      </Card>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="primary" icon={Plus} onClick={() => alert("Add Manual not implemented")}>Add Manual</Button>
        <Button variant="secondary" icon={Receipt} onClick={() => fileRef.current?.click()} disabled={loading}>
          {loading ? 'AI Extracting...' : 'Upload Receipt'}
        </Button>
        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} ref={fileRef} onChange={handleUpload} />
      </div>
      
      <Card title="Transactions" className="mt-4">
        {todayExpenses.length === 0 ? (
          <EmptyState
            emoji="💳"
            title="No expenses today"
            text="You haven't logged any expenses yet."
          />
        ) : (
          <div className="ui-col gap-2">
            {todayExpenses.map(exp => (
              <div key={exp.id} className="ui-row justify-between items-center p-3 rounded-none bg-zinc-50 dark:bg-zinc-800/50">
                <div className="ui-row items-center gap-3">
                  <div className="text-xl">{exp.billOCRText ? '🧾' : (exp.categoryEmoji || '💸')}</div>
                  <div>
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{exp.title}</div>
                    <div className="text-xs text-zinc-500">{exp.category} {exp.billOCRText ? '· AI Extracted' : ''}</div>
                  </div>
                </div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  ₹{Number(exp.amount).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
            <Button variant="ghost" className="mt-2 w-full" onClick={() => alert("Confirmed")}>Confirm no more spending</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function MonthTab({ expenses, selectedDate, onDateChange, budget }) {
  const currentMonth = selectedDate.substring(0, 7);
  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
  const totalSpent = monthExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const dailyBudget = budget / 30; // Approximation
  
  const daysInMonth = new Date(selectedDate.substring(0, 4), selectedDate.substring(5, 7), 0).getDate();
  const today = localDate();
  const currentDay = today.startsWith(currentMonth) ? parseInt(today.substring(8, 10)) : daysInMonth;
  const remainingDays = Math.max(1, daysInMonth - currentDay);
  const safeToSpend = Math.max(0, budget - totalSpent) / remainingDays;
  
  const getDay = (dateStr) => {
    if (dateStr > today) return { status: 'future' };
    const dayExpenses = expenses.filter(e => e.date === dateStr);
    const daySpend = dayExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    
    if (dayExpenses.length === 0 && dateStr < today) {
      return { status: 'unknown' };
    }
    
    const hasFixed = dayExpenses.some(isFixedRecord);
    return {
      value: '₹' + daySpend,
      cellBg: heatColor('#EF4444', daySpend / (dailyBudget * 2)),
      status: daySpend / (dailyBudget * 2) > 0.8 ? 'bad' : 'good', badges: hasFixed ? ['??'] : []
    };
  };

  const categories = useMemo(() => {
    const cats = {};
    monthExpenses.forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    return Object.entries(cats)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  return (
    <div className="ui-grid gap-4 mt-4">
      <div className="ui-row justify-between items-center">
        <DateNavigator
          value={selectedDate}
          onChange={onDateChange}
          unit="month" today={localDate()}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-zinc-900 text-white rounded-none flex flex-col gap-1">
          <div className="text-zinc-400 text-sm">Monthly Spend</div>
          <div className="text-2xl font-semibold">₹{totalSpent.toLocaleString('en-IN')}</div>
          <div className="text-xs text-zinc-500">of ₹{budget.toLocaleString('en-IN')}</div>
        </Card>
        <Card className="p-4 bg-zinc-900 text-white rounded-none flex flex-col gap-1">
          <div className="text-zinc-400 text-sm">Safe to Spend</div>
          <div className="text-2xl font-semibold text-blue-400">₹{Math.round(safeToSpend).toLocaleString('en-IN')}</div>
          <div className="text-xs text-zinc-500">per day remaining</div>
        </Card>
      </div>

      <Card title="Daily Spending">
        <HeatCalendar
          month={selectedDate.slice(0, 7)}
          getDay={getDay}
        />
      </Card>
      
      <Card title="Category Breakdown">
        {categories.length === 0 ? (
          <EmptyState emoji="📊" title="No data" text="Log expenses to see breakdown" />
        ) : (
          <div className="ui-col gap-6">
            <div style={{ height: 250, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="amount"
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4'][index % 7]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => '₹' + value.toLocaleString('en-IN')} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ height: 200, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: 'var(--text-3)', fontSize: 12}} />
                  <RechartsTooltip cursor={{fill: 'transparent'}} formatter={(value) => '₹' + value.toLocaleString('en-IN')} />
                  <Bar dataKey="amount" fill="#6366F1" radius={[0, 4, 4, 0]} animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function YearTab({ expenses }) {
  const today = localDate();
  const getDay = (dateStr) => {
    if (dateStr > today) return { status: 'future' };
    const dayExpenses = expenses.filter(e => e.date === dateStr);
    const daySpend = dayExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    if (daySpend === 0 && dateStr < today) return { status: 'unknown' };
    return {
      value: daySpend,
      cellBg: heatColor('#EF4444', daySpend / 2000)
    };
  };

  return (
    <div className="ui-grid gap-4 mt-4">
      <Card title="Yearly Spending Heatmap">
        <YearHeatmap
          year={parseInt(localDate().substring(0, 4))}
          getDay={getDay}
        />
      </Card>
    </div>
  );
}

function BillsTab({ expenses }) {
  const fixedExpenses = expenses.filter(isFixedRecord);
  
  return (
    <div className="ui-grid gap-4 mt-4">
      <Card title="Subscriptions & Recurring">
        {fixedExpenses.length === 0 ? (
          <EmptyState emoji="🧾" title="No recurring bills" text="You don't have any fixed expenses recorded." />
        ) : (
          <div className="ui-col gap-2">
            {fixedExpenses.map(exp => (
              <div key={exp.id} className="ui-row justify-between items-center p-3 rounded-none border border-zinc-200 dark:border-zinc-800">
                <div className="ui-row items-center gap-3">
                  <Receipt className="w-5 h-5 text-zinc-400" />
                  <div>
                    <div className="font-medium text-sm">{exp.title}</div>
                    <div className="text-xs text-zinc-500">{fmtDate(exp.date)}</div>
                  </div>
                </div>
                <div className="font-semibold">
                  ₹{Number(exp.amount).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

