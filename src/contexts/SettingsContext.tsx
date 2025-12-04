/**
 * Settings Context
 * Provides global access to P&L display and calculation method settings
 * Allows components to read and update settings without prop drilling
 */

import { createContext, useContext, useState, ReactNode } from 'react'
import { CalculationMethod } from '@/utils/calculations/tradeMatching'

interface SettingsContextType {
  // P&L Display (Net vs Gross)
  showGrossPL: boolean
  setShowGrossPL: (showGross: boolean) => void
  // Calculation Method (FIFO vs Per Position)
  calculationMethod: CalculationMethod
  setCalculationMethod: (method: CalculationMethod) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

interface SettingsProviderProps {
  children: ReactNode
  // Allow parent to control values (for backward compatibility with App.tsx state)
  showGrossPL: boolean
  onShowGrossPLChange: (showGross: boolean) => void
  calculationMethod: CalculationMethod
  onCalculationMethodChange: (method: CalculationMethod) => void
}

export function SettingsProvider({
  children,
  showGrossPL,
  onShowGrossPLChange,
  calculationMethod,
  onCalculationMethodChange,
}: SettingsProviderProps) {
  return (
    <SettingsContext.Provider
      value={{
        showGrossPL,
        setShowGrossPL: onShowGrossPLChange,
        calculationMethod,
        setCalculationMethod: onCalculationMethodChange,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

export default SettingsContext
