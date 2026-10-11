import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CoverPage from './CoverPage.jsx'

// Show the cover page first; the map app mounts only after the user enters
function Root() {
  const [entered, setEntered] = useState(false)
  return entered ? <App /> : <CoverPage onEnter={() => setEntered(true)} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
