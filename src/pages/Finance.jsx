import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppActions, useAppState } from '../context/appHooks'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Plus, Pencil } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import TagInput from '../components/ui/TagInput'
import { useToast } from '../context/toastContextCore'
import { extractBillWithGemini, getGeminiApiKey } from '../services/geminiService'
import { playSuccessSound, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import {
  ensureBillsFolder,
  getBillsFolderId,
  uploadBase64FileToDrive,
  deleteDriveFile,
  fetchDriveFileAsObjectUrl,
} from '../services/driveService'
import { formatCurrencyAmount, getCurrencySymbol, normalizeCurrency } from '../utils/currency'
import { getTodayDateKey } from '../utils/dateTime'

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
const DEFAULT_ACCOUNTS = ['Cash', 'UPI', 'Credit Card', 'Debit Card']
const EMPTY_ARRAY = []

function inferMimeType(fileName = '', fallback = '') {
  if (fallback) return fallback
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  if (ext === 'pdf') return 'application/pdf'
  return ''
}

function isImageBill(bill = {}) {
  const type = (bill.fileType || '').toLowerCase()
  const name = (bill.fileName || '').toLowerCase()
  return type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(name)
}

function isPdfBill(bill = {}) {
  const type = (bill.fileType || '').toLowerCase()
  const name = (bill.fileName || '').toLowerCase()
  return type === 'application/pdf' || name.endsWith('.pdf')
}

function isHeicBill(bill = {}) {
  const type = (bill.fileType || '').toLowerCase()
  const name = (bill.fileName || '').toLowerCase()
  return type.includes('heic') || type.includes('heif') || /\.(heic|heif)$/i.test(name)
}

async function createImageThumbnail(file, maxSize = 640) {
  if (!file || !file.type?.startsWith('image/')) return ''

  const imageUrl = URL.createObjectURL(file)

  try {
    const image = new Image()
    image.decoding = 'async'

    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
      image.src = imageUrl
    })

    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || 1, image.naturalHeight || 1))
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale))
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    ctx.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch {
    return ''
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}


export default function Finance() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const location = useLocation()

  const timezone = state.settings?.profile?.timezone
  const currencyCode = normalizeCurrency(state.settings?.profile?.currency)
  const currencySymbol = getCurrencySymbol(currencyCode)
  const today = getTodayDateKey(timezone)

  const redirectDate = location.state?.selectedDate
  const [selectedDate, setSelectedDate] = useState(redirectDate || today)

  const [activeTab, setActiveTab] = useState('today')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [selectedBill, setSelectedBill] = useState(null)
  const [pendingBillForExpense, setPendingBillForExpense] = useState(null)
  const [uploadingBill, setUploadingBill] = useState(false)
  const [accountFilter, setAccountFilter] = useState('all')
  const [billRemoved, setBillRemoved] = useState(false)
  const fileInputRef = useRef(null)
  const modalFileInputRef = useRef(null)

  // SMS UPI Parser State
  const [showSMSModal, setShowSMSModal] = useState(false)
  const [smsInput, setSmsInput] = useState('')
  const [parsedSMSResult, setParsedSMSResult] = useState(null)

  function handleParseSMS() {
    if (!smsInput.trim()) {
      showToast('Please paste a transaction SMS text first', 'warning')
      return
    }

    const amountMatch = smsInput.match(/(?:rs\.?|inr|amt|sent|debited|paid|withdrawal|withdrawn|spent)\s*(?:rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i)
    if (!amountMatch) {
      showToast("Could not extract amount. Please make sure the SMS contains words like 'debited', 'paid' or 'spent' followed by a number", 'error')
      playWarningBeep()
      hapticLight()
      return
    }

    const amount = parseFloat(amountMatch[1])

    let merchant = 'Unknown Merchant'
    const merchantMatch = smsInput.match(/(?:to|at|for|ref|payee|towards)\s+([a-z0-9\s&'\-\.]+?)(?:\s+ref|\s+on|\s+ref\.|\s+via|\s+balance|\s+bal|\s+a\/c|\s+ac|\s+\d{2}[-\/.]|\s+date|$)/i)
    if (merchantMatch && merchantMatch[1]) {
      const candidate = merchantMatch[1].trim()
      if (candidate.length > 2 && !candidate.toLowerCase().includes('debited') && !candidate.toLowerCase().includes('credited')) {
        merchant = candidate
      }
    }

    let account = 'Bank'
    if (smsInput.match(/hdfc/i)) account = 'HDFC'
    else if (smsInput.match(/sbi/i)) account = 'SBI'
    else if (smsInput.match(/icici/i)) account = 'ICICI'
    else if (smsInput.match(/paytm/i)) account = 'Paytm'
    else if (smsInput.match(/phonepe/i)) account = 'PhonePe'
    else if (smsInput.match(/gpay/i)) account = 'GPay'

    let category = 'Other'
    const textLower = smsInput.toLowerCase()
    if (textLower.match(/swiggy|zomato|ubereats|food|restaurant|cafe|hotel|chai|bakery|lunch|dinner|breakfast/)) category = 'Food & Drinks'
    else if (textLower.match(/uber|ola|rapido|metro|auto|cab|taxi|train|petrol|diesel|fuel|cng/)) category = 'Transport'
    else if (textLower.match(/amazon|flipkart|myntra|shopping|clothing|fashion|mall|store/)) category = 'Shopping'
    else if (textLower.match(/netflix|spotify|youtube|hotstar|prime|jio|airtel|recharge|electricity|water|bill|gas/)) category = 'Bills & Utilities'
    else if (textLower.match(/gym|fitness|protein|cult|medical|pharmacy|doctor|hospital|medicine/)) category = 'Health & Medical'

    setParsedSMSResult({
      amount,
      merchant,
      account,
      category,
      date: today,
      time: format(new Date(), 'HH:mm'),
    })
    
    showToast('UPI SMS parsed successfully! 📊 Verify and save.', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleSaveSMSExpense() {
    if (!parsedSMSResult) return

    const newExpense = {
      id: uuid(),
      amount: parsedSMSResult.amount,
      currency: currencyCode,
      category: parsedSMSResult.category,
      subcategory: '',
      description: `SMS Import: ${parsedSMSResult.merchant}`,
      date: parsedSMSResult.date,
      time: parsedSMSResult.time,
      paymentMethod: 'UPI',
      isImpulsive: false,
      account: parsedSMSResult.account,
      isRecurring: false,
      tags: ['sms-import'],
      billDriveFileId: null,
      billOCRText: null,
      createdAt: new Date().toISOString(),
    }

    const updatedExpenses = [newExpense, ...expenses]
    setModule('finance', {
      ...state.finance,
      expenses: updatedExpenses,
    })

    showToast('SMS Expense imported and saved! 💸', 'success')
    playSuccessSound()
    hapticSuccess()
    
    setSmsInput('')
    setParsedSMSResult(null)
    setShowSMSModal(false)
  }

  const rawAccounts = state.settings?.preferences?.accounts?.length
    ? state.settings.preferences.accounts
    : DEFAULT_ACCOUNTS
  // Accounts may be stored as objects { name, type } or plain strings — normalize to strings
  const accounts = rawAccounts.map(a => (typeof a === 'object' && a !== null ? a.name : a))

  const [form, setForm] = useState({
    amount: '',
    category: 'Food & Drinks',
    description: '',
    date: selectedDate,
    time: format(new Date(), 'HH:mm'),
    paymentMethod: 'UPI',
    isImpulsive: false,
    subcategory: '',
    account: accounts[0] || 'Cash',
    tags: [],
  })

  // Synchronize form date when selectedDate changes
  useEffect(() => {
    setForm(f => ({ ...f, date: selectedDate }))
  }, [selectedDate])

  const expenses = state.finance?.expenses || EMPTY_ARRAY
  const bills = state.finance?.bills || EMPTY_ARRAY

  const allTags = useMemo(() => [...new Set((state.finance?.expenses || []).flatMap(e => e.tags || []))], [state.finance?.expenses])

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
    monthExpenses,
    accountTotals,
  } = useMemo(() => {
    const now = new Date()
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
    const totalsByDate = new Map()
    const totalsByCategory = {}
    const totalsByAccount = {}
    const monthlyBuckets = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(now, 5 - i)
      const key = format(date, 'yyyy-MM')
      return { key, month: format(date, 'MMM'), total: 0 }
    })
    const monthlyBucketByKey = new Map(monthlyBuckets.map(bucket => [bucket.key, bucket]))
    const todaysExpenses = []
    const currentMonthExpenses = []
    let todaysTotal = 0
    let currentMonthTotal = 0

    expenses.forEach(expense => {
      const amount = Number(expense.amount || 0)
      const date = expense.date || ''

      totalsByDate.set(date, (totalsByDate.get(date) || 0) + amount)

      if (date === selectedDate) {
        todaysExpenses.push(expense)
        todaysTotal += amount
      }

      if (date >= monthStart && date <= monthEnd) {
        currentMonthExpenses.push(expense)
        currentMonthTotal += amount
        totalsByCategory[expense.category] = (totalsByCategory[expense.category] || 0) + amount
        const acct = expense.account || 'Unassigned'
        totalsByAccount[acct] = (totalsByAccount[acct] || 0) + amount
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
      monthExpenses: currentMonthExpenses,
      accountTotals: Object.entries(totalsByAccount)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value),
    }
  }, [expenses, selectedDate])

  const pct = Math.min(100, (todayTotal / dailyBudget) * 100)
  const monthPct = Math.min(100, (monthTotal / monthlyBudget) * 100)

  function resetForm() {
    setBillRemoved(false)
    setPendingBillForExpense(null)
    setForm({
      amount: '',
      category: 'Food & Drinks',
      description: '',
      date: selectedDate,
      time: format(new Date(), 'HH:mm'),
      paymentMethod: 'UPI',
      isImpulsive: false,
      subcategory: '',
      account: accounts[0] || 'Cash',
      tags: [],
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
    setBillRemoved(false)
    resetForm()
  }

  function handleViewBill(expense) {
    const matchedBill = bills.find(b => b.driveFileId === expense.billDriveFileId || b.linkedExpenseId === expense.id)
    const targetBill = matchedBill || {
      id: expense.id,
      fileName: expense.description || 'Attached Bill',
      driveFileId: expense.billDriveFileId,
      extractedText: expense.billOCRText || 'No text extracted',
      suggestedAmount: expense.amount,
      suggestedCategory: expense.category,
      uploadedAt: expense.createdAt || new Date().toISOString(),
    }
    
    // Switch to bills tab
    setActiveTab('bills')
    // Open bill preview modal
    setSelectedBill(targetBill)
  }

  function startEdit(expense) {
    setBillRemoved(false)
    setPendingBillForExpense(null)
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
      account: expense.account || accounts[0] || 'Cash',
      tags: expense.tags || [],
    })
    setShowAddModal(true)
  }

  function handleSave() {
    if (!form.amount || isNaN(Number(form.amount))) return

    const linkedBill = pendingBillForExpense || null
    const billDriveFileId = billRemoved ? null : (linkedBill?.driveFileId || editingEntry?.billDriveFileId || null)
    const billOCRText = billRemoved ? null : (linkedBill?.extractedText || editingEntry?.billOCRText || null)

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
        account: form.account,
        tags: form.tags,
        billDriveFileId,
        billOCRText,
        updatedAt: new Date().toISOString(),
      }

      let updatedBills = bills
      if (linkedBill) {
        updatedBills = bills.map(b => {
          if (b.id === linkedBill.id) return { ...b, linkedExpenseId: editingEntry.id }
          if (b.linkedExpenseId === editingEntry.id) return { ...b, linkedExpenseId: null }
          return b
        })
      } else if (billRemoved) {
        updatedBills = bills.map(b =>
          b.linkedExpenseId === editingEntry.id ? { ...b, linkedExpenseId: null } : b
        )
      }

      setModule('finance', {
        ...state.finance,
        expenses: expenses.map(e => (e.id === editingEntry.id ? updatedExpense : e)),
        bills: updatedBills,
      })
      showToast('Expense updated ✓', 'success')
      playSuccessSound()
      hapticSuccess()
      closeExpenseModal()
      return
    }

    const newExpenseId = uuid()
    const newExpense = {
      id: newExpenseId,
      amount: Number(form.amount),
      currency: currencyCode,
      category: form.category,
      subcategory: form.subcategory,
      description: form.description || linkedBill?.fileName || '',
      date: form.date,
      time: form.time,
      paymentMethod: form.paymentMethod,
      isImpulsive: form.isImpulsive,
      account: form.account,
      isRecurring: false,
      tags: form.tags,
      billDriveFileId,
      billOCRText,
      createdAt: new Date().toISOString(),
    }

    const updatedExpenses = [newExpense, ...expenses]
    let updatedBills = bills

    if (linkedBill) {
      updatedBills = bills.map(b =>
        b.id === linkedBill.id ? { ...b, linkedExpenseId: newExpenseId } : b
      )
    }

    setModule('finance', {
      ...state.finance,
      expenses: updatedExpenses,
      bills: updatedBills,
    })

    showToast('Expense saved ✓', 'success')
    playSuccessSound()
    hapticSuccess()
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
    playWarningBeep()
    hapticLight()
  }

  async function handleBillUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingBill(true)

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const fileType = inferMimeType(file.name, file.type)
      const thumbnailDataUrl = await createImageThumbnail(file)
      
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
          mimeType: fileType || 'application/octet-stream',
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
        fileType,
        thumbnailDataUrl,
        base64: isImageBill({ fileName: file.name, fileType }) && !thumbnailDataUrl
          ? String(base64)
          : undefined,
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

  async function handleModalBillUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingBill(true)

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const fileType = inferMimeType(file.name, file.type)
      const thumbnailDataUrl = await createImageThumbnail(file)
      
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
          mimeType: fileType || 'application/octet-stream',
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
        fileType,
        thumbnailDataUrl,
        base64: isImageBill({ fileName: file.name, fileType }) && !thumbnailDataUrl
          ? String(base64)
          : undefined,
        extractedText,
        suggestedAmount,
        suggestedCategory,
        suggestedDescription,
        uploadedAt: new Date().toISOString(),
        linkedExpenseId: editingEntry?.id || null,
        driveFileId,
        driveFileUrl,
        driveDownloadUrl,
        driveSyncStatus,
      }

      const updatedBills = [newBill, ...bills]
      saveBills(updatedBills)
      setPendingBillForExpense(newBill)
      setBillRemoved(false)

      setForm(f => ({
        ...f,
        amount: f.amount && f.amount !== '0' && f.amount !== '' ? f.amount : String(suggestedAmount || ''),
        category: f.category && f.category !== 'Food & Drinks' ? f.category : suggestedCategory,
        description: f.description ? f.description : (suggestedDescription || ''),
      }))

      showToast('Bill uploaded and attached! 🧾', 'success')
      playSuccessSound()
      hapticSuccess()
    } catch (error) {
      console.error('Bill upload failed:', error)
      showToast('Could not upload this bill.', 'error')
    } finally {
      setUploadingBill(false)
      if (modalFileInputRef.current) modalFileInputRef.current.value = ''
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
    <div className="finance-container">
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>💸 Finance</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="secondary"
            onClick={() => { playSubtleClick(); hapticLight(); setShowSMSModal(true); }}
          >
            📥 UPI SMS Import
          </Button>
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
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {[
          { key: 'today', label: 'Today' },
          { key: 'month', label: 'This Month' },
          { key: 'yearly', label: 'Yearly' },
          { key: 'bills', label: '🧾 Bills' },
          { key: 'savings', label: '💰 Savings' },
          { key: 'recurring', label: '💳 Subscriptions & Debt' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={tabStyle(activeTab === key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Account filter row */}
      <div style={{ padding: '10px 24px 0', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginRight: '4px' }}>Account:</span>
        <button
          onClick={() => setAccountFilter('all')}
          style={{
            padding: '4px 12px',
            borderRadius: '16px',
            border: '1px solid',
            borderColor: accountFilter === 'all' ? 'var(--accent-indigo)' : 'var(--border)',
            background: accountFilter === 'all' ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: accountFilter === 'all' ? 'var(--accent-indigo)' : 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          All
        </button>
        {accounts.map(acct => (
          <button
            key={acct}
            onClick={() => setAccountFilter(acct)}
            style={{
              padding: '4px 12px',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: accountFilter === acct ? 'var(--accent-indigo)' : 'var(--border)',
              background: accountFilter === acct ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: accountFilter === acct ? 'var(--accent-indigo)' : 'var(--text-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {acct}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeTab === 'today' && (
          <>
            {/* Inline Date Selector for Back Dates */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'DM Sans, sans-serif',
                  outline: 'none',
                }}
              />
              {selectedDate !== today && (
                <button
                  onClick={() => setSelectedDate(today)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'rgba(99,102,241,0.12)',
                    color: '#B9C2FF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Reset to Today
                </button>
              )}
            </div>

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
              {(() => {
                const filtered = accountFilter === 'all' ? todayExpenses : todayExpenses.filter(e => (e.account || 'Unassigned') === accountFilter)
                return filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>{accountFilter === 'all' ? 'No spending today!' : `No spending from ${accountFilter} today!`}</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Stay strong 💪</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filtered.map(e => (
                      <ExpenseRow key={e.id} expense={e} onDelete={handleDelete} onEdit={startEdit} onViewBill={handleViewBill} defaultCurrency={currencyCode} />
                    ))}
                  </div>
                )
              })()}
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

            {accountTotals.length > 0 && (
              <Card>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>Spend by Account</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                  {accountTotals.map(({ name, value }) => (
                    <div
                      key={name}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-indigo)' }}>
                        {formatCurrencyAmount(value, currencyCode)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: '600' }}>{name}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

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
              {(() => {
                const filtered = accountFilter === 'all' ? monthExpenses : monthExpenses.filter(e => (e.account || 'Unassigned') === accountFilter)
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px' }}>All Transactions</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filtered.length} items</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                      {[...filtered]
                        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.time || '').localeCompare(String(a.time || '')))
                        .map(e => (
                          <ExpenseRow key={e.id} expense={e} onDelete={handleDelete} onEdit={startEdit} onViewBill={handleViewBill} showDate defaultCurrency={currencyCode} />
                        ))}
                    </div>
                  </>
                )
              })()}
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
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleBillUpload} />
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

        {activeTab === 'savings' && (
          <SavingsTabContent
            state={state}
            setModule={setModule}
            showToast={showToast}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
          />
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={closeExpenseModal}
        title={editingEntry ? 'Edit Expense' : 'Add Expense'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {(() => {
            const activeModalBill = pendingBillForExpense || (editingEntry && !billRemoved && bills.find(b => b.driveFileId === editingEntry.billDriveFileId || b.linkedExpenseId === editingEntry.id))
            
            if (activeModalBill) {
              return (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>
                      🧾 Linked Bill: <span style={{ color: '#10B981' }}>{activeModalBill.fileName}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedBill(activeModalBill)}
                        style={{
                          background: 'rgba(99,102,241,0.15)',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'var(--accent-indigo)',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        🔍 View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBillRemoved(true)
                          setPendingBillForExpense(null)
                        }}
                        style={{
                          background: 'rgba(244,63,94,0.15)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#F43F5E',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        🗑 Unlink
                      </button>
                    </div>
                  </div>
                  {activeModalBill.suggestedAmount ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Amount: {formatCurrencyAmount(activeModalBill.suggestedAmount, currencyCode)}
                    </div>
                  ) : null}
                </div>
              )
            }

            return (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploadingBill}
                  onClick={() => modalFileInputRef.current?.click()}
                  style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
                >
                  {uploadingBill ? '⏳ Uploading...' : '📎 Attach Bill or Receipt'}
                </Button>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleModalBillUpload}
                />
              </div>
            )
          })()}

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
            <label style={labelStyle}>Account</label>
            <select style={inputStyle} value={form.account} onChange={e => setForm(f => ({ ...f, account: e.target.value }))}>
              {accounts.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
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

          <div>
            <label style={labelStyle}>Tags</label>
            <TagInput
              tags={form.tags || []}
              onChange={tags => setForm(f => ({ ...f, tags }))}
              allTags={allTags}
              placeholder="Add tags..."
            />
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

function ExpenseRow({ expense: e, onDelete, onEdit, onViewBill, showDate = false, defaultCurrency = 'INR' }) {
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
          {e.account ? (
            <>
              <span>•</span>
              <span style={{ color: 'var(--accent-indigo)' }}>{e.account}</span>
            </>
          ) : null}
          {e.isImpulsive ? (
            <>
              <span>•</span>
              <span style={{ color: '#F43F5E' }}>impulse 🤦</span>
            </>
          ) : null}
          {(e.billDriveFileId || e.billOCRText) ? (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={(evt) => {
                  evt.stopPropagation();
                  onViewBill?.(e);
                }}
                style={{
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  color: '#10B981',
                  fontSize: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                🧾 bill attached
              </button>
            </>
          ) : null}
        </div>
        {e.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
            {e.tags.map(tag => (
              <span
                key={tag}
                style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  fontSize: '11px',
                  color: 'var(--accent-indigo)',
                  fontWeight: '600',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
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
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false

    async function loadPreview() {
      setHasError(false)
      setPreviewSrc('')
      setIsLoading(false)

      if (!bill) return
      if (bill?.thumbnailDataUrl) {
        setPreviewSrc(bill.thumbnailDataUrl)
        return
      }

      if (bill?.base64) {
        setPreviewSrc(bill.base64)
        return
      }
      if (bill?.driveFileId) {
        setIsLoading(true)
        try {
          objectUrl = await fetchDriveFileAsObjectUrl(bill.driveFileId)
          if (!cancelled) setPreviewSrc(objectUrl)
        } catch {
          if (!cancelled) {
            const fallbackUrl = bill?.driveDownloadUrl || bill?.driveFileUrl || ''
            setPreviewSrc(fallbackUrl)
            setHasError(!fallbackUrl)
          }
        } finally {
          if (!cancelled) setIsLoading(false)
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
  }, [bill])

  const isImage = isImageBill(bill) && previewSrc && !hasError

  if (!isImage) {
    return (
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 800 }}>
          {isPdfBill(bill) ? 'PDF' : isHeicBill(bill) ? 'HEIC' : isLoading ? '...' : 'IMG'}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700 }}>
          {isLoading
            ? 'Loading preview'
            : hasError
              ? 'Preview unavailable'
              : isHeicBill(bill)
                ? 'Unsupported preview'
                : isPdfBill(bill)
                  ? 'PDF receipt'
                  : 'Receipt'}
        </div>
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

function SavingsTabContent({ state, setModule, showToast, currencyCode, currencySymbol }) {
  const [goals, setGoals] = useState(state.finance?.savingsGoals || [])
  const [form, setForm] = useState({
    title: '',
    targetAmount: '',
    targetDate: '',
    category: 'General',
  })
  
  const [transactionModal, setTransactionModal] = useState({
    isOpen: false,
    goalId: null,
    type: 'deposit', // 'deposit' | 'withdraw'
    amount: '',
    description: '',
  })

  useEffect(() => {
    setGoals(state.finance?.savingsGoals || [])
  }, [state.finance?.savingsGoals])

  function handleCreateGoal() {
    if (!form.title.trim() || !form.targetAmount) return
    
    const newGoal = {
      id: 'savings_' + Date.now(),
      title: form.title.trim(),
      targetAmount: parseFloat(form.targetAmount),
      currentAmount: 0,
      category: form.category,
      targetDate: form.targetDate || '',
      contributions: [],
      createdAt: new Date().toISOString()
    }
    
    const updatedGoals = [...goals, newGoal]
    setModule('finance', {
      ...state.finance,
      savingsGoals: updatedGoals
    })
    
    setForm({
      title: '',
      targetAmount: '',
      targetDate: '',
      category: 'General'
    })
    
    showToast('Savings goal created! 💰', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleTransaction() {
    const { goalId, type, amount, description } = transactionModal
    if (!goalId || !amount) return
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) return

    const updated = goals.map(g => {
      if (g.id !== goalId) return g
      
      const change = type === 'deposit' ? val : -val
      const nextAmount = Math.max(0, g.currentAmount + change)
      
      if (type === 'deposit' && nextAmount >= g.targetAmount && g.currentAmount < g.targetAmount) {
        showToast(`🏆 Goal Completed: ${g.title}! Outstanding job!`, 'success')
        playSuccessSound()
        hapticSuccess()
      } else {
        if (type === 'deposit') {
          playSuccessSound()
          hapticSuccess()
        } else {
          playWarningBeep()
          hapticLight()
        }
      }
      
      const newTx = {
        id: 'tx_' + Date.now(),
        amount: val,
        type: type,
        description: description.trim() || (type === 'deposit' ? 'Deposit' : 'Withdrawal'),
        date: new Date().toISOString()
      }
      
      return {
        ...g,
        currentAmount: nextAmount,
        contributions: [newTx, ...(g.contributions || [])]
      }
    })

    setModule('finance', {
      ...state.finance,
      savingsGoals: updated
    })

    setTransactionModal({
      isOpen: false,
      goalId: null,
      type: 'deposit',
      amount: '',
      description: ''
    })
    
    showToast(type === 'deposit' ? 'Contribution added! ✓' : 'Funds withdrawn ✓', 'success')
  }

  function handleDeleteGoal(goalId) {
    if (!window.confirm('Are you sure you want to delete this savings goal?')) return
    const updated = goals.filter(g => g.id !== goalId)
    setModule('finance', {
      ...state.finance,
      savingsGoals: updated
    })
    showToast('Savings goal deleted', 'warning')
    playWarningBeep()
    hapticLight()
  }
  
  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '4px',
    display: 'block',
    textTransform: 'uppercase',
  }
  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px', padding: '0 24px 48px' }}>
      <Card style={{ padding: '18px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          💰 Create Savings Goal
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>Goal Name / Item</label>
            <input
              style={inputStyle}
              placeholder="e.g. MacBook Pro M3"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Target Amount ({currencySymbol})</label>
            <input
              type="number"
              style={inputStyle}
              placeholder="e.g. 150000"
              value={form.targetAmount}
              onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Target Date (Optional)</label>
            <input
              type="date"
              style={inputStyle}
              value={form.targetDate}
              onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <div style={{ width: '180px' }}>
            <label style={labelStyle}>Category</label>
            <select
              style={inputStyle}
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              <option value="General">General 📦</option>
              <option value="Tech">Technology 💻</option>
              <option value="Travel">Travel ✈️</option>
              <option value="Emergency">Emergency Fund 🚨</option>
              <option value="Investment">Investment 📈</option>
            </select>
          </div>
          <Button onClick={handleCreateGoal} disabled={!form.title.trim() || !form.targetAmount} style={{ height: '40px' }}>
            Set Goal
          </Button>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {goals.map(g => {
          const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100))
          const needed = Math.max(0, g.targetAmount - g.currentAmount)
          
          let etaDisplay = 'No target date set'
          if (g.targetDate) {
            const todayDate = new Date()
            const targetD = new Date(g.targetDate)
            const ms = targetD.getTime() - todayDate.getTime()
            const daysLeft = Math.ceil(ms / (1000 * 60 * 60 * 24))
            if (daysLeft > 0) {
              const dailyRate = needed / daysLeft
              const monthlyRate = dailyRate * 30
              etaDisplay = `${daysLeft} days remaining. Save approx ${currencySymbol}${Math.ceil(dailyRate)}/day (${currencySymbol}${Math.ceil(monthlyRate)}/mo)`
            } else if (needed === 0) {
              etaDisplay = 'Goal target achieved! 🎉'
            } else {
              etaDisplay = 'Target date passed'
            }
          }

          return (
            <Card key={g.id} style={{ padding: '18px', background: 'rgba(30,41,59,0.3)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.12)', color: '#10B981', textTransform: 'uppercase' }}>
                    {g.category}
                  </span>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', marginTop: '6px', marginBottom: '2px' }}>{g.title}</h4>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{etaDisplay}</div>
                </div>
                <button
                  onClick={() => handleDeleteGoal(g.id)}
                  style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: '12px' }}
                >
                  Delete
                </button>
              </div>

              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {currencySymbol}{g.currentAmount.toLocaleString('en-IN')} / {currencySymbol}{g.targetAmount.toLocaleString('en-IN')}
                  </span>
                  <span style={{ color: pct >= 100 ? '#10B981' : 'var(--accent-indigo)' }}>{pct}%</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'linear-gradient(90deg, #10B981, #34D399)' : 'linear-gradient(90deg, #6366F1, #8B5CF6)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                </div>
                {needed > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Still need to save: <strong>{currencySymbol}{needed.toLocaleString('en-IN')}</strong>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <Button
                  onClick={() => setTransactionModal({ isOpen: true, goalId: g.id, type: 'deposit', amount: '', description: '' })}
                  variant="secondary"
                  style={{ flex: 1, padding: '6px 12px', fontSize: '13px', borderColor: 'rgba(16,185,129,0.3)', color: '#A7F3D0' }}
                >
                  📥 Deposit
                </Button>
                <Button
                  onClick={() => setTransactionModal({ isOpen: true, goalId: g.id, type: 'withdraw', amount: '', description: '' })}
                  variant="secondary"
                  style={{ flex: 1, padding: '6px 12px', fontSize: '13px', borderColor: 'rgba(244,63,94,0.3)', color: '#FECDD3' }}
                >
                  📤 Withdraw
                </Button>
              </div>

              {g.contributions && g.contributions.length > 0 && (
                <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>Recent contributions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {g.contributions.slice(0, 3).map(tx => (
                      <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span>
                          {tx.type === 'deposit' ? '➕' : '➖'} {tx.description}
                        </span>
                        <span style={{ fontWeight: '600', color: tx.type === 'deposit' ? '#10B981' : '#F43F5E' }}>
                          {tx.type === 'deposit' ? '+' : '-'}{currencySymbol}{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}

        {goals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '32px' }}>📊</div>
            <div style={{ fontWeight: '600', marginTop: '6px' }}>No savings goals created</div>
            <div style={{ fontSize: '12px' }}>Set your saving goals above to start tracking allocations.</div>
          </div>
        )}
      </div>

      {activeTab === 'recurring' && (
        <RecurringDebtTab
          state={state}
          setModule={setModule}
          showToast={showToast}
          currencySymbol={currencySymbol}
          inputStyle={inputStyle}
          labelStyle={labelStyle}
        />
      )}

      <Modal
        isOpen={transactionModal.isOpen}
        onClose={() => setTransactionModal({ isOpen: false, goalId: null, type: 'deposit', amount: '', description: '' })}
        title={transactionModal.type === 'deposit' ? '📥 Deposit Funds' : '📤 Withdraw Funds'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Amount ({currencySymbol})</label>
            <input
              type="number"
              style={inputStyle}
              placeholder="e.g. 5000"
              value={transactionModal.amount}
              onChange={e => setTransactionModal(m => ({ ...m, amount: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Description / Reference</label>
            <input
              style={inputStyle}
              placeholder="e.g. Saved from salary, Side project bonus"
              value={transactionModal.description}
              onChange={e => setTransactionModal(m => ({ ...m, description: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <Button
              variant="secondary"
              onClick={() => setTransactionModal({ isOpen: false, goalId: null, type: 'deposit', amount: '', description: '' })}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransaction}
              disabled={!transactionModal.amount}
              style={{ flex: 1, background: transactionModal.type === 'deposit' ? '#10B981' : '#F43F5E' }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* UPI SMS Auto Import Modal */}
      <Modal
        isOpen={showSMSModal}
        onClose={() => {
          setShowSMSModal(false);
          setSmsInput('');
          setParsedSMSResult(null);
        }}
        title="📥 UPI SMS Auto-Import"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Paste UPI SMS Text</label>
            <textarea
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', fontSize: '13px' }}
              placeholder="Paste SMS here... e.g. 'Debited from a/c HDFC Rs.250 to Zomato' or 'SBI: Amt Sent Rs. 1200.00 to SWIGGY'"
              value={smsInput}
              onChange={e => setSmsInput(e.target.value)}
            />
          </div>

          {!parsedSMSResult ? (
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSMSModal(false);
                  setSmsInput('');
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button onClick={handleParseSMS} style={{ flex: 1 }} disabled={!smsInput.trim()}>
                Parse SMS
              </Button>
            </div>
          ) : (
            <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.2)', padding: '14px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--accent-indigo)' }}>🔍 Parsed Details (Verify & Edit)</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={parsedSMSResult.amount}
                    onChange={e => setParsedSMSResult(p => ({ ...p, amount: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Vendor / Payee</label>
                  <input
                    style={inputStyle}
                    value={parsedSMSResult.merchant}
                    onChange={e => setParsedSMSResult(p => ({ ...p, merchant: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Account</label>
                  <select
                    style={inputStyle}
                    value={parsedSMSResult.account}
                    onChange={e => setParsedSMSResult(p => ({ ...p, account: e.target.value }))}
                  >
                    {accounts.map(acct => (
                      <option key={acct} value={acct}>{acct}</option>
                    ))}
                    {!accounts.includes(parsedSMSResult.account) && (
                      <option value={parsedSMSResult.account}>{parsedSMSResult.account}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    style={inputStyle}
                    value={parsedSMSResult.category}
                    onChange={e => setParsedSMSResult(p => ({ ...p, category: e.target.value }))}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={parsedSMSResult.date}
                    onChange={e => setParsedSMSResult(p => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Time</label>
                  <input
                    style={inputStyle}
                    value={parsedSMSResult.time}
                    onChange={e => setParsedSMSResult(p => ({ ...p, time: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <Button
                  variant="secondary"
                  onClick={() => setParsedSMSResult(null)}
                  style={{ flex: 1 }}
                >
                  Reparse / Clear
                </Button>
                <Button onClick={handleSaveSMSExpense} style={{ flex: 1 }}>
                  Confirm & Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function RecurringDebtTab({ state, setModule, showToast, currencySymbol, inputStyle, labelStyle }) {
  const subscriptions = state.finance?.subscriptions || []
  const emis = state.finance?.emis || []
  const loans = state.finance?.loans || []
  const expenses = state.finance?.expenses || []

  const [activeSection, setActiveSection] = useState('subs')

  const [subForm, setSubForm] = useState({ name: '', amount: '', cycle: 'Monthly', category: 'Entertainment', nextRenewal: '' })
  const [emiForm, setEmiForm] = useState({ name: '', amount: '', remainingMonths: 12, totalMonths: 12, rate: 0 })
  const [loanForm, setLoanForm] = useState({ person: '', amount: '', type: 'Borrowed', dueDate: '', notes: '' })

  const monthlySubTotal = subscriptions.reduce((acc, sub) => {
    const amt = Number(sub.amount) || 0
    return acc + (sub.cycle === 'Monthly' ? amt : amt / 12)
  }, 0)

  const monthlyEmiTotal = emis.reduce((acc, emi) => acc + (Number(emi.amount) || 0), 0)

  function addSubscription() {
    if (!subForm.name.trim() || !subForm.amount) return
    const newSub = {
      id: 'sub_' + Date.now(),
      name: subForm.name.trim(),
      amount: Number(subForm.amount),
      cycle: subForm.cycle,
      category: subForm.category,
      nextRenewal: subForm.nextRenewal || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    }

    setModule('finance', {
      ...state.finance,
      subscriptions: [...subscriptions, newSub]
    })
    setSubForm({ name: '', amount: '', cycle: 'Monthly', category: 'Entertainment', nextRenewal: '' })
    showToast('Subscription registered! 💳', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function addEMI() {
    if (!emiForm.name.trim() || !emiForm.amount) return
    const newEmi = {
      id: 'emi_' + Date.now(),
      name: emiForm.name.trim(),
      amount: Number(emiForm.amount),
      remainingMonths: Number(emiForm.remainingMonths) || 12,
      totalMonths: Number(emiForm.totalMonths) || 12,
      rate: Number(emiForm.rate) || 0,
      createdAt: new Date().toISOString()
    }

    setModule('finance', {
      ...state.finance,
      emis: [...emis, newEmi]
    })
    setEmiForm({ name: '', amount: '', remainingMonths: 12, totalMonths: 12, rate: 0 })
    showToast('EMI payment logged! ⏱️', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function addLoan() {
    if (!loanForm.person.trim() || !loanForm.amount) return
    const newLoan = {
      id: 'loan_' + Date.now(),
      person: loanForm.person.trim(),
      amount: Number(loanForm.amount),
      type: loanForm.type,
      dueDate: loanForm.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      notes: loanForm.notes.trim(),
      createdAt: new Date().toISOString()
    }

    setModule('finance', {
      ...state.finance,
      loans: [...loans, newLoan]
    })
    setLoanForm({ person: '', amount: '', type: 'Borrowed', dueDate: '', notes: '' })
    showToast('Debt ledger entry added! 🤝', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function payEmiInstallment(id) {
    const emi = emis.find(e => e.id === id)
    if (!emi || emi.remainingMonths <= 0) return

    const updated = emis.map(e => {
      if (e.id !== id) return e
      return { ...e, remainingMonths: e.remainingMonths - 1 }
    }).filter(e => e.remainingMonths > 0)

    const expenseEntry = {
      id: 'exp_' + Date.now(),
      title: `EMI: ${emi.name} (Installment)`,
      amount: emi.amount,
      category: 'Bills Utilities',
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'UPI',
      account: 'Primary',
      tags: ['EMI'],
      createdAt: new Date().toISOString()
    }

    setModule('finance', {
      ...state.finance,
      emis: updated,
      expenses: [expenseEntry, ...expenses]
    })
    showToast('Installment paid & logged as expense! ⚡', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function settleLoan(id) {
    const loan = loans.find(l => l.id === id)
    if (!loan) return

    const expenseEntry = {
      id: 'exp_' + Date.now(),
      title: loan.type === 'Borrowed' ? `Settle Loan (Paid Back ${loan.person})` : `Settle Loan (Received from ${loan.person})`,
      amount: loan.type === 'Borrowed' ? loan.amount : -loan.amount,
      category: 'Miscellaneous',
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'UPI',
      account: 'Primary',
      tags: ['Settle Debt'],
      createdAt: new Date().toISOString()
    }

    setModule('finance', {
      ...state.finance,
      loans: loans.filter(l => l.id !== id),
      expenses: [expenseEntry, ...expenses]
    })
    showToast(loan.type === 'Borrowed' ? 'Borrowed loan paid back & settled! ✓' : 'Lent loan received & settled! ✓', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function deleteSub(id) {
    setModule('finance', {
      ...state.finance,
      subscriptions: subscriptions.filter(s => s.id !== id)
    })
    showToast('Subscription deleted', 'warning')
    playWarningBeep()
    hapticLight()
  }

  function deleteEmi(id) {
    setModule('finance', {
      ...state.finance,
      emis: emis.filter(e => e.id !== id)
    })
    showToast('EMI deleted', 'warning')
    playWarningBeep()
    hapticLight()
  }

  function deleteLoan(id) {
    setModule('finance', {
      ...state.finance,
      loans: loans.filter(l => l.id !== id)
    })
    showToast('Loan deleted', 'warning')
    playWarningBeep()
    hapticLight()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        {[
          { key: 'subs', label: `💳 Subscriptions (${subscriptions.length})` },
          { key: 'emis', label: `⏱️ EMIs (${emis.length})` },
          { key: 'loans', label: `🤝 Debt Ledger (${loans.length})` }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { playSubtleClick(); setActiveSection(key); }}
            style={{
              background: activeSection === key ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              color: activeSection === key ? 'var(--accent-indigo)' : 'var(--text-muted)',
              fontWeight: activeSection === key ? '700' : '400',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'subs' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <Card style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '12px' }}>➕ Register Subscription</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  style={inputStyle}
                  placeholder="Subscription Name (e.g. Netflix, Spotify)"
                  value={subForm.name}
                  onChange={e => setSubForm(s => ({ ...s, name: e.target.value }))}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder={`Amount (${currencySymbol})`}
                    value={subForm.amount}
                    onChange={e => setSubForm(s => ({ ...s, amount: e.target.value }))}
                  />
                  <select
                    style={inputStyle}
                    value={subForm.cycle}
                    onChange={e => setSubForm(s => ({ ...s, cycle: e.target.value }))}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                  <input
                    type="date"
                    style={inputStyle}
                    value={subForm.nextRenewal}
                    onChange={e => setSubForm(s => ({ ...s, nextRenewal: e.target.value }))}
                  />
                  <select
                    style={inputStyle}
                    value={subForm.category}
                    onChange={e => setSubForm(s => ({ ...s, category: e.target.value }))}
                  >
                    <option value="Entertainment">Entertainment</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Education">Education</option>
                    <option value="Work">Work</option>
                  </select>
                </div>
                <Button onClick={addSubscription} disabled={!subForm.name.trim() || !subForm.amount} style={{ marginTop: '4px' }}>
                  Register Sub
                </Button>
              </div>
            </Card>

            <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '20px' }}>💳</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-indigo)', margin: '4px 0 2px' }}>
                {currencySymbol} {monthlySubTotal.toFixed(0)} / mo
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total subscription burn rate</span>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subscriptions.map(sub => (
              <Card key={sub.id} style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800' }}>{sub.name}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {sub.category} • Next billing: {sub.nextRenewal}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    {currencySymbol} {sub.amount} / {sub.cycle === 'Monthly' ? 'mo' : 'yr'}
                  </strong>
                  <ConfirmDeleteButton onConfirm={() => deleteSub(sub.id)} size={12} label="Cancel sub" />
                </div>
              </Card>
            ))}
            {subscriptions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No active subscriptions logged.
              </div>
            )}
          </div>
        </>
      )}

      {activeSection === 'emis' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <Card style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '12px' }}>➕ Add EMI Installment</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  style={inputStyle}
                  placeholder="EMI Name (e.g. Phone, Car Loan)"
                  value={emiForm.name}
                  onChange={e => setEmiForm(s => ({ ...s, name: e.target.value }))}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder={`EMI Amount (${currencySymbol})`}
                    value={emiForm.amount}
                    onChange={e => setEmiForm(s => ({ ...s, amount: e.target.value }))}
                  />
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="Interest Rate (%)"
                    value={emiForm.rate}
                    onChange={e => setEmiForm(s => ({ ...s, rate: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>REMAINING MONTHS</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={emiForm.remainingMonths}
                      onChange={e => setEmiForm(s => ({ ...s, remainingMonths: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>TOTAL MONTHS</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={emiForm.totalMonths}
                      onChange={e => setEmiForm(s => ({ ...s, totalMonths: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={addEMI} disabled={!emiForm.name.trim() || !emiForm.amount} style={{ marginTop: '4px' }}>
                  Register EMI
                </Button>
              </div>
            </Card>

            <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '20px' }}>⏱️</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-cyan)', margin: '4px 0 2px' }}>
                {currencySymbol} {monthlyEmiTotal.toFixed(0)} / mo
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total EMI outgoings</span>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {emis.map(emi => {
              const progress = emi.totalMonths > 0 ? Math.round(((emi.totalMonths - emi.remainingMonths) / emi.totalMonths) * 100) : 0
              return (
                <Card key={emi.id} style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800' }}>{emi.name}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {emi.remainingMonths} of {emi.totalMonths} months left • {emi.rate > 0 ? `${emi.rate}% interest` : 'Interest-free'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {currencySymbol} {emi.amount} / mo
                      </strong>
                      <Button onClick={() => payEmiInstallment(emi.id)} style={{ padding: '4px 10px', fontSize: '11px' }}>Pay</Button>
                      <ConfirmDeleteButton onConfirm={() => deleteEmi(emi.id)} size={12} label="Remove EMI" />
                    </div>
                  </div>
                  <div style={{ height: '5px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-cyan)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                  </div>
                </Card>
              )
            })}
            {emis.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No active EMI schedules logged.
              </div>
            )}
          </div>
        </>
      )}

      {activeSection === 'loans' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <Card style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '12px' }}>➕ Register Debt Entry</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  style={inputStyle}
                  placeholder="Person Name (e.g. Alice, Bob)"
                  value={loanForm.person}
                  onChange={e => setLoanForm(l => ({ ...l, person: e.target.value }))}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder={`Amount (${currencySymbol})`}
                    value={loanForm.amount}
                    onChange={e => setLoanForm(l => ({ ...l, amount: e.target.value }))}
                  />
                  <select
                    style={inputStyle}
                    value={loanForm.type}
                    onChange={e => setLoanForm(l => ({ ...l, type: e.target.value }))}
                  >
                    <option value="Borrowed">🔴 Borrowed (You owe)</option>
                    <option value="Lent">🟢 Lent (Owed to you)</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                  <input
                    type="date"
                    style={inputStyle}
                    value={loanForm.dueDate}
                    onChange={e => setLoanForm(l => ({ ...l, dueDate: e.target.value }))}
                  />
                  <input
                    style={inputStyle}
                    placeholder="Short description..."
                    value={loanForm.notes}
                    onChange={e => setLoanForm(l => ({ ...l, notes: e.target.value }))}
                  />
                </div>
                <Button onClick={addLoan} disabled={!loanForm.person.trim() || !loanForm.amount} style={{ marginTop: '4px' }}>
                  Log Debt
                </Button>
              </div>
            </Card>

            <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '20px' }}>🤝</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#10B981', margin: '4px 0 2px' }}>
                + {currencySymbol} {loans.filter(l => l.type === 'Lent').reduce((acc, l) => acc + l.amount, 0)}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#EF4444', marginBottom: '4px' }}>
                - {currencySymbol} {loans.filter(l => l.type === 'Borrowed').reduce((acc, l) => acc + l.amount, 0)}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lent vs Borrowed Debt Ledger</span>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loans.map(loan => (
              <Card key={loan.id} style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${loan.type === 'Lent' ? '#10B981' : '#EF4444'}` }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800' }}>
                    {loan.type === 'Lent' ? `🟢 Owed by ${loan.person}` : `🔴 Owed to ${loan.person}`}
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Due date: {loan.dueDate} {loan.notes && `• "${loan.notes}"`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <strong style={{ fontSize: '15px', color: loan.type === 'Lent' ? '#10B981' : '#EF4444' }}>
                    {currencySymbol} {loan.amount}
                  </strong>
                  <Button onClick={() => settleLoan(loan.id)} style={{ padding: '4px 10px', fontSize: '11px', background: loan.type === 'Lent' ? '#10B981' : '#EF4444' }}>Settle</Button>
                  <ConfirmDeleteButton onConfirm={() => deleteLoan(loan.id)} size={12} label="Remove entry" />
                </div>
              </Card>
            ))}
            {loans.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No active loans or debts recorded.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
