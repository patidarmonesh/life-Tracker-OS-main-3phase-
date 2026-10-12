// Resolve both current links and older receipts attached only by Drive id.
export function expenseForBill(bill, expenses = []) {
  return expenses.find(e => e.billId === bill.id ||
    (bill.linkedExpenseId && e.id === bill.linkedExpenseId) ||
    (bill.driveFileId && e.billDriveFileId === bill.driveFileId))
}

export function saveReceiptExpense(finance, expense, bill, detach = false) {
  const expenses = finance.expenses || []
  const linked = bill && expenseForBill(bill, expenses)
  if (linked && linked.id !== expense.id) throw new Error('This receipt already has an expense. Open it from Added to edit it.')
  return {
    ...finance,
    expenses: expenses.some(e => e.id === expense.id)
      ? expenses.map(e => e.id === expense.id ? expense : e) : [expense, ...expenses],
    bills: (finance.bills || []).map(b => {
      if (bill && b.id === bill.id) return { ...b, linkedExpenseId: expense.id, updatedAt: expense.updatedAt }
      if ((bill || detach) && expenseForBill(b, expenses)?.id === expense.id)
        return { ...b, linkedExpenseId: null, updatedAt: expense.updatedAt }
      return b
    }),
  }
}
