import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Clock, IndianRupee, Moon, Plus, Target, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { Page, Card, StatCard, Button, Ring, EmptyState } from '../ui/index';
import { useLiveNow } from '../ui/hooks';
import { fmtMinutes, fmtDate, greeting } from '../ui/format';
import { localDate } from '../domain/metrics/dates';
import { useAppState } from '../context/appHooks';
import { computeDaySync } from '../domain/planning/sync';
import { compactMoney, spendOf } from '../domain/finance';

const EMPTY_ARRAY = [];
const EMPTY_PLANNING = { drafts: {}, checkins: {} };

export default function Home() {
  const navigate = useNavigate();
  const state = useAppState();
  const today = localDate();
  const now = useLiveNow();

  const expenses = state.finance?.expenses || EMPTY_ARRAY;
  const timeflow = state.timeflow?.entries || EMPTY_ARRAY;
  const planning = state.planning || EMPTY_PLANNING;
  const sleepLogs = state.health?.sleepLogs || EMPTY_ARRAY;

  const todayExpenses = expenses.filter(e => e.date === today);
  const spentToday = todayExpenses.length > 0 ? spendOf(todayExpenses) : null;

  const todayTime = timeflow.filter(t => (t.startAt || '').startsWith(today));
  const focusTime = todayTime.filter(t => t.category === 'Focus' || t.bucket === 'Focus').reduce((acc, t) => {
    if (t.duration) return acc + t.duration;
    if (t.startAt && t.endAt) {
      const s = new Date(t.startAt).getTime();
      const e = new Date(t.endAt).getTime();
      return acc + (e - s) / 60000;
    }
    return acc;
  }, 0);

  const lastSleep = sleepLogs.find(s => s.date === today) || sleepLogs[sleepLogs.length - 1];

  const syncResult = useMemo(() => {
    try {
      return computeDaySync(today, planning, timeflow, now);
    } catch {
      return { score: null, maxScore: null, currentBlock: null, pendingCheckins: [] };
    }
  }, [today, planning, timeflow, now]);

  const score = syncResult?.score ?? syncResult?.value ?? null;
  const maxScore = syncResult?.maxScore ?? syncResult?.upper ?? 100;
  const currentBlock = syncResult?.currentBlock;
  const pendingCheckins = syncResult?.pendingCheckins || [];

  return (
    <Page className="ui-page max-w-4xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-none bg-slate-900 p-8 mb-6 border border-slate-800 shadow-none">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
           <motion.div 
             animate={{ x: [0, 20, 0], y: [0, -20, 0], opacity: [0.3, 0.5, 0.3] }}
             transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
             className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/20 rounded-none blur-3xl"
           />
           <motion.div 
             animate={{ x: [0, -30, 0], y: [0, 30, 0], opacity: [0.2, 0.4, 0.2] }}
             transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
             className="absolute top-10 -right-10 w-72 h-72 bg-purple-500/20 rounded-none blur-3xl"
           />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-transparent   mb-2">
            {greeting()}, Mayan
          </h1>
          <p className="text-slate-400 text-lg">{fmtDate(today, 'long')}</p>
        </div>
      </div>

      {/* NOW / NEXT */}
      <Card className="mb-6 bg-slate-900/50 border-indigo-500/20">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Zap className="w-6 h-6 text-indigo-400" />
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Right Now</p>
              {currentBlock ? (
                <div>
                  <p className="text-lg font-medium text-slate-200">{currentBlock.title}</p>
                </div>
              ) : (
                <p className="text-lg font-medium text-slate-400">No plan for today</p>
              )}
            </div>
          </div>
          {!currentBlock && (
            <Button variant="ghost" onClick={() => navigate('/plan')}>
              View Plan <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </Card>

      {/* Quick Stats */}
            <div className="ui-grid cols-4 mb-8">
        <Card className="p-4 bg-slate-900/50 border border-slate-800 rounded-none cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => navigate(`/plan?date=${today}`)}>
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-slate-400">Plan Sync</div>
            <Target className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl font-semibold text-slate-200 mt-2">
            {score !== null && score !== undefined ? (
              <div className="flex items-center gap-3">
                <Ring value={score} max={maxScore} size={36} className="text-indigo-500" />
                <span className="text-lg">{score}/{maxScore}</span>
              </div>
            ) : <span className="text-slate-500 text-sm font-normal">+ Log today</span>}
          </div>
        </Card>
        
        <Card className="p-4 bg-slate-900/50 border border-slate-800 rounded-none cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => navigate('/capture?type=expense')}>
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-slate-400">Spent Today</div>
            <IndianRupee className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-semibold text-slate-200 mt-2">
            {spentToday !== null ? compactMoney(spentToday) : <span className="text-slate-500 text-sm font-normal">+ Log today</span>}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/50 border border-slate-800 rounded-none cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => navigate('/capture?type=time')}>
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-slate-400">Focus Time</div>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-semibold text-slate-200 mt-2">
            {focusTime > 0 ? fmtMinutes(focusTime) : <span className="text-slate-500 text-sm font-normal">+ Log today</span>}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/50 border border-slate-800 rounded-none cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => navigate('/capture?type=sleep')}>
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-slate-400">Sleep</div>
            <Moon className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-semibold text-slate-200 mt-2">
            {lastSleep ? fmtMinutes(lastSleep.durationMinutes || 0) : <span className="text-slate-500 text-sm font-normal">+ Log today</span>}
          </div>
        </Card>
      </div>

      {/* Pending Check-ins */}
      {pendingCheckins && pendingCheckins.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-400" />
            Pending Check-ins
          </h3>
          <div className="space-y-3">
            {pendingCheckins.map((block, idx) => (
              <Card key={block.id || idx} className="p-4 flex items-center justify-between hover:border-indigo-500/30 transition-colors">
                <div>
                  <p className="font-medium text-slate-200">{block.title || 'Untitled Block'}</p>
                  {block.timeStr && <p className="text-sm text-slate-400">{block.timeStr}</p>}
                </div>
                <Button size="sm" onClick={() => navigate(`/plan?date=${today}&checkin=${block.id || idx}`)}>
                  Check In
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <Button onClick={() => navigate('/capture?type=expense')} className="bg-slate-800 hover:bg-slate-700">
            <Plus className="w-4 h-4 mr-2" /> Expense
          </Button>
          <Button onClick={() => navigate('/capture?type=time')} className="bg-slate-800 hover:bg-slate-700">
            <Plus className="w-4 h-4 mr-2" /> Time Log
          </Button>
          <Button onClick={() => navigate('/plan')} className="bg-indigo-600 hover:bg-indigo-500 text-white">
            Write Plan
          </Button>
        </div>
      </div>
      <div className="pb-24 h-24 min-h-[6rem] mb-12"></div>
    </Page>
  );
}
