import test from 'node:test'
import assert from 'node:assert/strict'
import { expenseForBill, saveReceiptExpense } from '../src/utils/financeBills.js'

test('receipt queue shrinks 30 to 29 without deleting attachments; duplicate expense is rejected', () => {
  const bills = Array.from({length:30}, (_,i)=>({id:`b${i}`,driveFileId:`f${i}`}))
  const original={bills,expenses:[],budgets:{monthly:123}}
  const expense={id:'e1',billId:'b0',billDriveFileId:'f0',amount:100,updatedAt:'2026-10-12T12:00:00Z'}
  const next=saveReceiptExpense(original,expense,bills[0])
  assert.equal(next.bills.filter(b=>!expenseForBill(b,next.expenses)).length,29)
  assert.equal(next.bills.length,30)
  assert.equal(next.budgets.monthly,123)
  assert.equal(original.expenses.length,0)
  assert.throws(()=>saveReceiptExpense(next,{...expense,id:'e2'},bills[0]),/already/)
  assert.equal(saveReceiptExpense(next,{...expense,amount:200},bills[0]).expenses.length,1)
})
test('legacy, local-only, deleted and detached receipt links resolve accurately', () => {
  assert.equal(expenseForBill({id:'a',driveFileId:null},[{id:'x',billDriveFileId:null}]),undefined)
  assert.equal(expenseForBill({id:'a',linkedExpenseId:'deleted'},[]),undefined)
  assert.equal(expenseForBill({id:'a',driveFileId:'f'},[{id:'x',billDriveFileId:'f'}]).id,'x')
  const b={id:'b'};const e={id:'e',billId:'b',amount:3,updatedAt:'2026-10-12'}
  const next=saveReceiptExpense({bills:[b],expenses:[]},e,b)
  assert.equal(expenseForBill(next.bills[0],next.expenses).id,'e')
  const detached=saveReceiptExpense(next,{...e,billId:null},null,true)
  assert.equal(expenseForBill(detached.bills[0],detached.expenses),undefined)
})
