import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { motion } from 'framer-motion'
import { initTauri } from '@/lib/tauri'

export default function Layout() {
  useEffect(() => {
    initTauri()
  }, [])

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-auto p-6"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}
