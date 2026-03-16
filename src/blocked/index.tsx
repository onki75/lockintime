import { createRoot } from 'react-dom/client'
import { Blocked } from './Blocked'
import '../styles/global.css'

const root = createRoot(document.getElementById('root')!)
root.render(<Blocked />)
