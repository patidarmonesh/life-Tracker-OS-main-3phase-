export const DRIVE_MODULES = Object.fromEntries(['finance', 'timeflow', 'study', 'habits', 'health', 'journal', 'wisdom', 'goals', 'decisions', 'crm', 'secondBrain', 'readings', 'meditations', 'settings', 'aiChat'].map(name => [`${name}.json`, name]))
const blocked = new Set(['__proto__', 'prototype', 'constructor'])
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)
export function mergeDriveModules(current, imported) {
  const conflicts = [], counts = { added: 0, duplicates: 0 }, modules = {}
  function merge(left, right, path) {
    const kind = value => Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
    if (left !== undefined && left !== null && left !== '' && kind(left) !== kind(right)) {
      conflicts.push({ path, current: left, imported: right })
      return structuredClone(left)
    }
    if (Array.isArray(right)) {
      const result = Array.isArray(left) ? structuredClone(left) : []
      for (const row of right) {
        const match = result.find(item => row?.id != null && item?.id != null ? String(item.id) === String(row.id) : stable(item) === stable(row) || (row && typeof row === 'object' && !Array.isArray(row) && item && Object.keys(row).every(key => stable(item[key]) === stable(row[key]))))
        if (match !== undefined) {
          if (stable(match) === stable(row) || row?.id == null) counts.duplicates++
          else conflicts.push({ path, id: row?.id, current: match, imported: row })
        } else { result.push(structuredClone(row)); counts.added++ }
      }
      return result
    }
    if (right && typeof right === 'object') {
      const result = left && typeof left === 'object' && !Array.isArray(left) ? structuredClone(left) : {}
      for (const [key, value] of Object.entries(right)) if (!blocked.has(key)) result[key] = merge(result[key], value, `${path}.${key}`)
      return result
    }
    if (left === undefined || left === null || left === '') return right
    if (stable(left) !== stable(right)) conflicts.push({ path, current: left, imported: right })
    return left
  }
  for (const name of Object.values(DRIVE_MODULES)) if (Object.hasOwn(imported, name)) modules[name] = merge(current[name], imported[name], name)
  return { modules, conflicts, ...counts }
}
