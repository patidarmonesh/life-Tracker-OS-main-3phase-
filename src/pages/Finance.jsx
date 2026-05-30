import { useState, useRef, useEffect, useMemo } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Plus, Pencil } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/ToastContext'
import { extractBillWithGemini, getGeminiApiKey } from '../services/geminiService'
import {
  ensureBillsFolder,
  getBillsFolderId,
  uploadBase64FileToDrive,
  deleteDriveFile,
  fetchDriveFileAsObjectUrl,
} from '../services/driveService'
import { formatCurrencyAmount, getCurrencySymbol, normalizeCurrency } from '../utils/currency'
import { getTodayDateKey } from '../utils/dateTime'

// --- HEIC (iPhone) support ---
function isHeic(file) {
  const name = (file.name || '').toLowerCase()
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

async function normalizeImageFile(file) {
  if (!isHeic(file)) return file
  const { default: heic2any } = await import('heic2any') // lazy — only loads on HEIC
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
  const jpegBlob = Array.isArray(converted) ? converted[0] : converted
  return new File(
    [jpegBlob],
    (file.name || 'bill').replace(/\.(heic|heif)$/i, '.jpg'),
    { type: 'image/jpeg' }
  )
}

const CATEGORY_COLORS = {
  'Food & Drinks': '#F97316',
  'Groceries': '#10B981',
  'Transport': '#06B6D4',
  'Gym & Fitness': '#EC4899',
  'Study & Education': '#3B82F6',
  'Shopping': '#8B5CF6',
  'Bills & Utilities': '#F59E0B',
  'Entertainment': '#EF4444',
  'Subscriptions': '#6366F1',
  'Personal Care': '#84CC16',
  'Miscellaneous': '#6B7280',
}

const CATEGORY_EMOJI = {
  'Food & Drinks': '🍜',
  'Groceries': '🛒',
  'Transport': '🚗',
  'Gym & Fitness': '💪',
  'Study & Education': '📚',
  'Shopping': '🛍️',
  'Bills & Utilities': '💡',
  'Entertainment': '🎬',
  'Subscriptions': '📱',
  'Personal Care': '✂️',
  'Miscellaneous': '📦',
}

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Net Banking', 'Other']

export default function Finance() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const timezone = state.settings?.profile?.timezone
  const currencyCode = normalizeCurrency(state.settings?.profile?.currency)
  const currencySymbol = getCurrencySymbol(currencyCode)
  const today = getTodayDateKey(timezone)
  const [activeTab, setActiveTab] = useState('today')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [selectedBill, setSelectedBill] = useState(null)
  const [pendingBillForExpense, setPendingBillForExpense] = useState(null)
  const [uploadingBill, setUploadingBill] = useState(false)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    amount: '',
    category: 'Food & Drinks',
    description: '',
    date: today,
    time: format(new Date(), 'HH:mm'),
    paymentMethod: 'UPI',
    isImpulsive: false,
    subcategory: '',
  })

  const expenses = state.finance?.expenses || []
  const bills = state.finance?.bills || []

  const monthlyBudget = state.settings?.preferences?.monthlyBudget || 8000
  const dailyBudget = Math.max(1, Math.round(monthlyBudget / 30))
  const categories = state.settings?.preferences?.expenseCategories?.length
    ? state.settings.preferences.expenseCategories
    : Object.keys(CATEGORY_COLORS)

  const geminiApiKey = getGeminiApiKey()

  const {
    todayExpenses,
    todayTotal,
    monthTotal,
    donutData,
    dailyData,
    monthlyData,
  } = useMemo(() => {
    const now = new Date()
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
    const totalsByDate = new Map()
    const totalsByCategory = {}
    const monthlyBuckets = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(now, 5 - i)
      const key = format(date, 'yyyy-MM')
      return { key, month: format(date, 'MMM'), total: 0 }
    })
    const monthlyBucketByKey = new Map(monthlyBuckets.map(bucket => [bucket.key, bucket]))
    const todaysExpenses = []
    let todaysTotal = 0
    let currentMonthTotal = 0

    expenses.forEach(expense => {
      const amount = Number(expense.amount || 0)
      const date = expense.date || ''

      totalsByDate.set(date, (totalsByDate.get(date) || 0) + amount)

      if (date === today) {
        todaysExpenses.push(expense)
        todaysTotal += amount
      }

      if (date >= monthStart && date <= monthEnd) {
        currentMonthTotal += amount
        totalsByCategory[expense.category] = (totalsByCategory[expense.category] || 0) + amount
      }

      const monthKey = date.slice(0, 7)
      const bucket = monthlyBucketByKey.get(monthKey)
      if (bucket) bucket.total += amount
    })

    const days = eachDayOfInterval({ start: startOfMonth(now), end: now })

    return {
      todayExpenses: todaysExpenses,
      todayTotal: todaysTotal,
      monthTotal: currentMonthTotal,
      donutData: Object.entries(totalsByCategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      dailyData: days.map(d => {
        const key = format(d, 'yyyy-MM-dd')
        return { day: format(d, 'd'), total: totalsByDate.get(key) || 0 }
      }),
      monthlyData: monthlyBuckets.map(({ month, total }) => ({ month, total })),
    }
  }, [expenses, today])

  const pct = Math.min(100, (todayTotal / dailyBudget) * 100)
  const monthPct = Math.min(100, (monthTotal / monthlyBudget) * 100)

  function resetForm() {
    setForm({
      amount: '',
      category: 'Food & Drinks',
      description: '',
      date: today,
      time: format(new Date(), 'HH:mm'),
      paymentMethod: 'UPI',
      isImpulsive: false,
      subcategory: '',
    })
  }

  function saveBills(newBills) {
    setModule('finance', {
      ...state.finance,
      expenses,
      bills: newBills,
    })
  }

  function closeExpenseModal() {
    setShowAddModal(false)
    setPendingBillForExpense(null)
    setEditingEntry(null)
    resetForm()
  }

  function startEdit(expense) {
    setEditingEntry(expense)
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      description: expense.description || '',
      date: expense.date,
      time: expense.time || format(new Date(), 'HH:mm'),
      paymentMethod: expense.paymentMethod || 'UPI',
      isImpulsive: !!expense.isImpulsive,
      subcategory: expense.subcategory || '',
    })
    setShowAddModal(true)
  }

  function handleSave() {
    if (!form.amount || isNaN(Number(form.amount))) return

    const linkedBill = pendingBillForExpense || null

    if (editingEntry) {
      const updatedExpense = {
        ...editingEntry,
        amount: Number(form.amount),
        category: form.category,
        subcategory: form.subcategory,
        description: form.description || linkedBill?.fileName || '',
        date: form.date,
        time: form.time,
        paymentMethod: form.paymentMethod,
        isImpulsive: form.isImpulsive,
        billDriveFileId: linkedBill?.driveFileId || editingEntry.billDriveFileId || null,
        billOCRText: linkedBill?.extractedText || editingEntry.billOCRText || null,
        updatedAt: new Date().toISOString(),
      }

      let updatedBills = bills
      if (linkedBill) {
        updatedBills = bills.map(b =>
          b.id === linkedBill.id ? { ...b, linkedExpenseId: editingEntry.id } : b
        )
      }

      setModule('finance', {
        ...state.finance,
        expenses: expenses.map(e => (e.id === editingEntry.id ? updatedExpense : e)),
        bills: updatedBills,
      })
      showToast('Expense updated ✓', 'success')
      closeExpenseModal()
      return
    }

    const newExpense = {
      id: uuid(),
      amount: Number(form.amount),
      currency: currencyCode,
      category: form.category,
      subcategory: form.subcategory,
      description: form.description || linkedBill?.fileName || '',
      date: form.date,
      time: form.time,
      paymentMethod: form.paymentMethod,
      isImpulsive: form.isImpulsive,
      isRecurring: false,
      tags: [],
      billDriveFileId: linkedBill?.driveFileId || null,
      billOCRText: linkedBill?.extractedText || null,
      createdAt: new Date().toISOString(),
    }

    const updatedExpenses = [newExpense, ...expenses]
    let updatedBills = bills

    if (linkedBill) {
      updatedBills = bills.map(b =>
        b.id === linkedBill.id ? { ...b, linkedExpenseId: newExpense.id } : b
      )
    }

    setModule('finance', {
      ...state.finance,
      expenses: updatedExpenses,
      bills: updatedBills,
    })

    showToast('Expense saved ✓', 'success')
    closeExpenseModal()
  }

  function handleDelete(id) {
    const removed = expenses.find(e => e.id === id)
    if (!removed) return

    const prevExpenses = expenses
    const prevBills = bills
    const updatedBills = bills.map(b =>
      b.linkedExpenseId === id ? { ...b, linkedExpenseId: null } : b
    )

    setModule('finance', {
      ...state.finance,
      expenses: expenses.filter(e => e.id !== id),
      bills: updatedBills,
    })

    showToast('Expense deleted', 'warning', {
      undo: () => {
        setModule('finance', {
          ...state.finance,
          expenses: prevExpenses,
          bills: prevBills,
        })
      },
    })
  }

 async function handleBillUpload(e) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setUploadingBill(true)
    try {
      let file
      try {
        file = await normalizeImageFile(rawFile)
      } catch (convErr) {
        console.error('HEIC conversion failed:', convErr)
        showToast?.('Could not read this image. Try saving it as JPG.', 'error')
        file = rawFile // fall back so the receipt isn't lost
      }

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })


      const fallbackCategory = categories.includes('Miscellaneous')
        ? 'Miscellaneous'
        : categories[0] || 'Miscellaneous'

      let extractedText = 'AI extraction requires Gemini API key in Settings.'
      let suggestedAmount = null
      let suggestedCategory = fallbackCategory
      let suggestedDescription = file.name

      if (geminiApiKey) {
        try {
          const base64Data = String(base64).split(',')[1]

          const { rawResponse, parsed } = await extractBillWithGemini({
            apiKey: geminiApiKey,
            base64Data,
            mimeType: file.type || 'image/jpeg',
            allowedCategories: categories,
          })

          if (parsed) {
            extractedText = parsed.rawText || rawResponse || 'No readable text found'
            suggestedAmount =
              parsed.totalAmount !== null &&
              parsed.totalAmount !== undefined &&
              !isNaN(Number(parsed.totalAmount))
                ? Number(parsed.totalAmount)
                : null

            suggestedCategory = categories.includes(parsed.category)
              ? parsed.category
              : fallbackCategory

            suggestedDescription = parsed.description || parsed.merchant || file.name
          } else {
            extractedText = rawResponse || 'No readable text found'
          }
        } catch (error) {
          extractedText = error.message || 'Could not extract text. Check your Gemini API key.'
        }
      }

      await ensureBillsFolder()
      const billsFolderId = getBillsFolderId()

      let driveFileId = null
      let driveFileUrl = null
      let driveDownloadUrl = null
      let driveSyncStatus = 'failed'

      try {
        const base64Data = String(base64).split(',')[1]

        const uploaded = await uploadBase64FileToDrive({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
          parentFolderId: billsFolderId,
        })

        driveFileId = uploaded.id || null
        driveFileUrl = uploaded.webViewLink || null
        driveDownloadUrl = uploaded.webContentLink || null
        driveSyncStatus = 'synced'
      } catch (driveError) {
        console.error('Drive upload failed:', driveError)
        driveSyncStatus = 'failed'
      }

      const newBill = {
        id: uuid(),
        fileName: file.name,
        fileType: file.type,
        extractedText,
        suggestedAmount,
        suggestedCategory,
        suggestedDescription,
        uploadedAt: new Date().toISOString(),
        linkedExpenseId: null,
        driveFileId,
        driveFileUrl,
        driveDownloadUrl,
        driveSyncStatus,
      }

      const updatedBills = [newBill, ...bills]
      saveBills(updatedBills)
      setSelectedBill(newBill)

      if (suggestedAmount) {
        setPendingBillForExpense(newBill)
        setForm(f => ({
          ...f,
          amount: String(suggestedAmount),
          category: suggestedCategory,
          description: suggestedDescription || '',
        }))
        setShowAddModal(true)
      }
    } catch (error) {
      console.error('Bill upload failed:', error)
      alert('Could not read this file.')
    } finally {
      setUploadingBill(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const hasGemini = !!geminiApiKey

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
  }

  const labelStyle = {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontWeight: '600',
    marginBottom: '4px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const tabStyle = active => ({
    padding: '8px 18px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--accent-emerald)' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400',
    fontSize: '14px',
    fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid var(--accent-emerald)' : '2px solid transparent',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem' }}>💸 Finance</h1>
        <Button
          onClick={() => {
            setPendingBillForExpense(null)
            setEditingEntry(null)
            resetForm()
            setShowAddModal(true)
          }}
        >
          <Plus size={16} /> Add Expense
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {[
          { key: 'today', label: 'Today' },
          { key: 'month', label: 'This Month' },
          { key: 'yearly', label: 'Yearly' },
          { key: 'bills', label: '🧾 Bills' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={tabStyle(activeTab === key)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeTab === 'today' && (
          <>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '36px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: todayTotal > dailyBudget ? '#F43F5E' : '#10B981' }}>
                    {formatCurrencyAmount(todayTotal, currencyCode)}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>spent today</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: todayTotal > dailyBudget ? '#F43F5E' : 'var(--text-primary)' }}>
                    {formatCurrencyAmount(Math.max(0, dailyBudget - todayTotal), currencyCode)} left
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>of {formatCurrencyAmount(dailyBudget, currencyCode)} daily budget</div>
                </div>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: pct >= 100 ? '#F43F5E' : pct >= 80 ? '#F59E0B' : '#10B981',
                    borderRadius: '4px',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatCurrencyAmount(0, currencyCode)}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{Math.round(pct)}% of daily budget</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatCurrencyAmount(dailyBudget, currencyCode)}</span>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px' }}>Today's Transactions</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{todayExpenses.length} items</span>
              </div>
              {todayExpenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>No spending today!</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Stay strong 💪</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {todayExpenses.map(e => (
                    <ExpenseRow key={e.id} expense={e} onDelete={handleDelete} onEdit={startEdit} defaultCurrency={currencyCode} />
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {activeTab === 'month' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Total Spent', value: formatCurrencyAmount(monthTotal, currencyCode), color: '#F43F5E' },
                { label: 'Monthly Budget', value: formatCurrencyAmount(monthlyBudget, currencyCode), color: '#3B82F6' },
                {
                  label: monthTotal <= monthlyBudget ? '✅ Saved' : '⚠️ Overspent',
                  value: formatCurrencyAmount(Math.abs(monthlyBudget - monthTotal), currencyCode),
                  color: monthTotal <= monthlyBudget ? '#10B981' : '#F43F5E',
                },
              ].map(({ label, value, color }) => (
                <Card key={label} style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color }}>{value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
                </Card>
              ))}
            </div>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Monthly Budget Usage</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{Math.round(monthPct)}%</span>
              </div>
              <div style={{ height: '10px', background: 'var(--bg-secondary)', borderRadius: '5px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${monthPct}%`,
                    background: monthPct >= 100 ? '#F43F5E' : monthPct >= 80 ? '#F59E0B' : '#10B981',
                    borderRadius: '5px',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </Card>

            {donutData.length > 0 && (
              <Card>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>Spending by Category</h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                        {donutData.map((entry, i) => (
                          <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#6B7280'} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={v => formatCurrencyAmount(v, currencyCode)}
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {donutData.slice(0, 6).map(({ name, value }) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: CATEGORY_COLORS[name] || '#6B7280', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', flex: 1, color: 'var(--text-secondary)' }}>{name}</span>
                        <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrencyAmount(value, currencyCode)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>Daily Spending This Month</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={v => [formatCurrencyAmount(v, currencyCode), 'Spent']}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px' }}>All Transactions</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{monthExpenses.length} items</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {[...monthExpenses]
                  .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                  .map(e => (
                    <ExpenseRow key={e.id} expense={e} onDelete={handleDelete} onEdit={startEdit} showDate defaultCurrency={currencyCode} />
                  ))}
              </div>
            </Card>
          </>
        )}

        {activeTab === 'yearly' && (
          <>
            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>Last 6 Months</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={v => [formatCurrencyAmount(v, currencyCode), 'Spent']}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="total" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {[
                {
                  label: 'Monthly Average',
                  value: formatCurrencyAmount(Math.round(monthlyData.reduce((a, m) => a + m.total, 0) / 6), currencyCode),
                },
                {
                  label: '6-Month Total',
                  value: formatCurrencyAmount(monthlyData.reduce((a, m) => a + m.total, 0), currencyCode),
                },
                {
                  label: 'Best Month (lowest)',
                  value:
                    monthlyData
                      .filter(m => m.total > 0)
                      .reduce((a, m) => (m.total < a.total ? m : a), monthlyData.find(m => m.total > 0) || monthlyData[0])?.month || '-',
                },
                {
                  label: 'Worst Month (highest)',
                  value: monthlyData.reduce((a, m) => (m.total > a.total ? m : a), monthlyData[0])?.month || '-',
                },
              ].map(({ label, value }) => (
                <Card key={label} style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-indigo)' }}>{value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
                </Card>
              ))}
            </div>
          </>
        )}

        {activeTab === 'bills' && (
          <>
            <Card>
              <div
                onClick={() => !uploadingBill && fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-focus)',
                  borderRadius: '12px',
                  padding: '40px 24px',
                  textAlign: 'center',
                  cursor: uploadingBill ? 'wait' : 'pointer',
                  background: 'rgba(99,102,241,0.04)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (!uploadingBill) e.currentTarget.style.background = 'rgba(99,102,241,0.1)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.04)'
                }}
              >
                {uploadingBill ? (
                  <>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>⏳</div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--accent-indigo)' }}>Extracting with AI...</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Please wait</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>🧾</div>
                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>Upload a Bill or Receipt</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Click to upload image (JPG, PNG) or PDF</div>
                    <div
                      style={{
                        marginTop: '12px',
                        fontSize: '12px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        display: 'inline-block',
                        background: hasGemini ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: hasGemini ? '#10B981' : '#F59E0B',
                      }}
                    >
                      {hasGemini ? '✨ AI extraction enabled' : '⚠️ Add Gemini API key in Settings for AI extraction'}
                    </div>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,application/pdf" style={{ display: 'none' }} onChange={handleBillUpload} />
            </Card>

            {bills.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📂</div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>No bills uploaded yet</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Upload receipts above to keep track</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {bills.map(bill => (
                  <Card key={bill.id} onClick={() => setSelectedBill(bill)} style={{ padding: '12px', cursor: 'pointer' }}>
                    <BillPreview bill={bill} height={100} />
                    <div style={{ fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bill.fileName}</div>
                    {bill.suggestedAmount ? (
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#10B981', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px' }}>
                        {formatCurrencyAmount(bill.suggestedAmount, currencyCode)}
                      </div>
                    ) : null}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date(bill.uploadedAt).toLocaleDateString('en-IN')}</div>
                    {bill.linkedExpenseId ? (
                      <div style={{ fontSize: '11px', color: '#10B981', marginTop: '6px', fontWeight: '700' }}>Linked to expense</div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Not linked yet</div>
                    )}
                    <button
                      onClick={async e => {
                        e.stopPropagation()
                        if (window.confirm('Delete this bill?')) {
                          try {
                            await deleteDriveFile(bill.driveFileId)
                          } catch (error) {
                            console.error('Failed to delete bill from Drive:', error)
                          }
                          saveBills(bills.filter(b => b.id !== bill.id))
                          if (selectedBill?.id === bill.id) setSelectedBill(null)
                          if (pendingBillForExpense?.id === bill.id) setPendingBillForExpense(null)
                        }
                      }}
                      style={{ marginTop: '8px', background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: '12px', padding: '0' }}
                    >
                      🗑 Delete
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={closeExpenseModal}
        title={editingEntry ? 'Edit Expense' : 'Add Expense'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {pendingBillForExpense ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              Linked bill: <strong>{pendingBillForExpense.fileName}</strong>
            </div>
          ) : null}

          <div>
            <label style={labelStyle}>Amount ({currencySymbol})</label>
            <input
              autoFocus
              aria-label={`Amount in ${currencyCode}`}
              style={{ ...inputStyle, fontSize: '28px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '800' }}
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {categories.map(c => (
                <option key={c} value={c}>
                  {CATEGORY_EMOJI[c] || '💰'} {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="What was this for?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <input style={inputStyle} type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Payment Method</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, paymentMethod: m }))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: form.paymentMethod === m ? 'var(--accent-indigo)' : 'var(--border)',
                    background: form.paymentMethod === m ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: form.paymentMethod === m ? 'var(--accent-indigo)' : 'var(--text-muted)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isImpulsive: !f.isImpulsive }))}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                flexShrink: 0,
                background: form.isImpulsive ? '#F43F5E' : 'var(--border)',
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: form.isImpulsive ? '23px' : '3px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            </button>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>Impulsive Buy 🤦</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Was this unplanned?</div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={!form.amount}>
            {editingEntry ? 'Update Expense' : 'Save Expense'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!selectedBill} onClose={() => setSelectedBill(null)} title="Bill Details">
        {selectedBill ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <BillPreview bill={selectedBill} height={280} contain />

            {selectedBill.suggestedAmount ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px',
                  background: 'rgba(16,185,129,0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>AI Extracted Amount</span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatCurrencyAmount(selectedBill.suggestedAmount, currencyCode)}
                </span>
              </div>
            ) : null}

            {selectedBill.suggestedCategory ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Category:</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-indigo)' }}>{selectedBill.suggestedCategory}</span>
              </div>
            ) : null}

            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Extracted Text
              </div>
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  lineHeight: '1.7',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedBill.extractedText || 'No text extracted'}
              </div>
            </div>

            <Button
              onClick={() => {
                const bill = selectedBill
                setPendingBillForExpense(bill)
                setForm(f => ({
                  ...f,
                  amount: String(bill.suggestedAmount || ''),
                  category: bill.suggestedCategory || 'Miscellaneous',
                  description: bill.suggestedDescription || bill.fileName || '',
                }))
                setSelectedBill(null)
                setShowAddModal(true)
              }}
            >
              + Add as Expense
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function ExpenseRow({ expense: e, onDelete, onEdit, showDate = false, defaultCurrency = 'INR' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        transition: 'all 0.15s',
      }}
    >
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: `${CATEGORY_COLORS[e.category] || '#6B7280'}25`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          flexShrink: 0,
        }}
      >
        {CATEGORY_EMOJI[e.category] || '💰'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {e.description || e.category}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
          <span>{e.category}</span>
          {showDate ? (
            <>
              <span>•</span>
              <span>{e.date}</span>
            </>
          ) : null}
          <span>•</span>
          <span>{e.paymentMethod}</span>
          {e.isImpulsive ? (
            <>
              <span>•</span>
              <span style={{ color: '#F43F5E' }}>impulse 🤦</span>
            </>
          ) : null}
          {e.billOCRText ? (
            <>
              <span>•</span>
              <span style={{ color: '#10B981' }}>bill attached</span>
            </>
          ) : null}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace' }}>
          {formatCurrencyAmount(Number(e.amount || 0), normalizeCurrency(e.currency || defaultCurrency))}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{e.time}</div>
      </div>

      <button
        type="button"
        onClick={() => onEdit?.(e)}
        aria-label="Edit expense"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 8,
          minHeight: 44,
          minWidth: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseEnter={evt => { evt.currentTarget.style.color = 'var(--accent-indigo)' }}
        onMouseLeave={evt => { evt.currentTarget.style.color = 'var(--text-muted)' }}
      >
        <Pencil size={14} />
      </button>

      <ConfirmDeleteButton onConfirm={() => onDelete(e.id)} label="Delete expense" />
    </div>
  )
}

function BillPreview({ bill, height, contain = false }) {
  const [previewSrc, setPreviewSrc] = useState('')
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false

    async function loadPreview() {
      setHasError(false)
      if (bill?.base64) {
        setPreviewSrc(bill.base64)
        return
      }
      if (bill?.driveFileId) {
        try {
          objectUrl = await fetchDriveFileAsObjectUrl(bill.driveFileId)
          if (!cancelled) setPreviewSrc(objectUrl)
        } catch {
          if (!cancelled) setHasError(true)
        }
        return
      }
      setPreviewSrc(bill?.driveDownloadUrl || bill?.driveFileUrl || '')
    }

    loadPreview()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [bill?.id, bill?.driveFileId, bill?.base64, bill?.driveDownloadUrl, bill?.driveFileUrl])

  const isImage = bill?.fileType?.startsWith('image') && previewSrc && !hasError

  if (!isImage) {
    return (
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          marginBottom: '8px',
        }}
      >
        📄
      </div>
    )
  }

  return (
    <img
      src={previewSrc}
      alt={bill?.fileName || 'bill'}
      onError={() => setHasError(true)}
      style={{
        width: '100%',
        height: `${height}px`,
        objectFit: contain ? 'contain' : 'cover',
        borderRadius: '8px',
        background: 'var(--bg-secondary)',
        marginBottom: '8px',
      }}
    />
  )
}
