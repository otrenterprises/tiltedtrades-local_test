/**
 * Console Log Downloader
 * Debug component to download console logs
 */

import React from 'react'
import { consoleLogger } from '@/utils/consoleLogger'
import { Download } from 'lucide-react'

export const ConsoleLogDownloader: React.FC = () => {
  const handleDownload = () => {
    consoleLogger.downloadLogs()
  }

  const handleSave = () => {
    consoleLogger.saveLogs()
    alert('Console logs saved to localStorage!')
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-2">
      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition"
        title="Save console logs to localStorage"
      >
        💾 Save Logs
      </button>
      <button
        onClick={handleDownload}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition"
        title="Download console logs as file"
      >
        <Download className="w-4 h-4" />
        Download Logs
      </button>
    </div>
  )
}
