import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('عنصر الجذر #root غير موجود')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// تحديث صامت لعامل الخدمة: التطبيق قد يُستخدم في ظرف طارئ،
// فلا نعرض أي مطالبات تقطع الاستخدام.
registerSW({ immediate: true })
