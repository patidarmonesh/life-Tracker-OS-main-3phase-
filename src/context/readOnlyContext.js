import { createContext, useContext } from 'react'

// True when pages are rendered inside the public shared view (/shared).
// Components use it to hide editing affordances and block edit modals.
export const ReadOnlyContext = createContext(false)

export const useReadOnly = () => useContext(ReadOnlyContext)
