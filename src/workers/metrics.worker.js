// LifeOS Web Worker for Background Metric Processing
// Relieves the main thread from heavy year-in-review mapping

self.addEventListener('message', async (e) => {
  const { type, payload, jobId } = e.data;
  
  if (type === 'CALCULATE_YEAR_REVIEW') {
    const { state, year } = payload;
    
    try {
      // Expensive looping over 365 days of data
      const expenses = (state.finance?.expenses || []).filter(ex => ex.date?.startsWith(year));
      const totalSpent = expenses.reduce((acc, ex) => acc + (ex.amount || 0), 0);
      
      const timeflow = (state.timeflow?.entries || []).filter(t => t.startAt?.startsWith(year));
      const focusMinutes = timeflow
        .filter(t => t.category === 'Focus' || t.category === 'Study')
        .reduce((acc, t) => acc + (t.duration || 0), 0);
        
      const routines = state.habits?.dailyLogs || [];
      const totalCompletedRoutines = routines.filter(r => r.date?.startsWith(year) && r.status === 'done').length;

      self.postMessage({
        type: 'YEAR_REVIEW_COMPLETE',
        jobId,
        payload: {
          year,
          totalSpent,
          focusHours: Math.round(focusMinutes / 60),
          totalCompletedRoutines
        }
      });
    } catch (err) {
      self.postMessage({ type: 'YEAR_REVIEW_ERROR', jobId, error: err.message });
    }
  }
});
