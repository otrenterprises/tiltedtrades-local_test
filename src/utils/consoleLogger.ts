/**
 * Console Logger
 * Captures console output and saves to localStorage for debugging
 */

interface LogEntry {
  timestamp: number
  type: 'log' | 'warn' | 'error' | 'info'
  message: string
  args: any[]
}

class ConsoleLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private isCapturing = false
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  }

  startCapture() {
    if (this.isCapturing) return

    this.isCapturing = true
    this.logs = []

    // Override console methods
    console.log = (...args: any[]) => {
      this.addLog('log', args)
      this.originalConsole.log(...args)
    }

    console.warn = (...args: any[]) => {
      this.addLog('warn', args)
      this.originalConsole.warn(...args)
    }

    console.error = (...args: any[]) => {
      this.addLog('error', args)
      this.originalConsole.error(...args)
    }

    console.info = (...args: any[]) => {
      this.addLog('info', args)
      this.originalConsole.info(...args)
    }

    console.log('📝 Console logging started - logs will be saved to localStorage')
  }

  stopCapture() {
    if (!this.isCapturing) return

    this.isCapturing = false

    // Restore original console methods
    console.log = this.originalConsole.log
    console.warn = this.originalConsole.warn
    console.error = this.originalConsole.error
    console.info = this.originalConsole.info

    this.saveLogs()
    console.log('📝 Console logging stopped - logs saved to localStorage')
  }

  private addLog(type: 'log' | 'warn' | 'error' | 'info', args: any[]) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      type,
      message: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2)
          } catch (e) {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' '),
      args
    }

    this.logs.push(entry)

    // Keep only last N logs to prevent memory issues
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  saveLogs() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const key = `console-logs-${timestamp}`

      localStorage.setItem(key, JSON.stringify(this.logs, null, 2))
      localStorage.setItem('console-logs-latest', key)

      console.log(`✅ Saved ${this.logs.length} console logs to localStorage key: ${key}`)
    } catch (e) {
      console.error('❌ Failed to save console logs:', e)
    }
  }

  downloadLogs() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `console-logs-${timestamp}.json`

    const logText = this.logs.map(log => {
      const time = new Date(log.timestamp).toISOString()
      return `[${time}] [${log.type.toUpperCase()}] ${log.message}`
    }).join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    console.log(`📥 Downloaded console logs to ${filename}`)
  }

  getLogs() {
    return this.logs
  }

  getLatestLogsFromStorage() {
    try {
      const latestKey = localStorage.getItem('console-logs-latest')
      if (!latestKey) return null

      const logsJson = localStorage.getItem(latestKey)
      if (!logsJson) return null

      return JSON.parse(logsJson) as LogEntry[]
    } catch (e) {
      console.error('Failed to load logs from storage:', e)
      return null
    }
  }

  clearStoredLogs() {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('console-logs-'))
    keys.forEach(key => localStorage.removeItem(key))
    console.log(`🗑️ Cleared ${keys.length} stored console log files`)
  }
}

export const consoleLogger = new ConsoleLogger()

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).consoleLogger = consoleLogger
}
