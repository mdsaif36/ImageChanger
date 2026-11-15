import { useEffect, useRef, useState } from 'react'
import { Aperture, ArrowDownToLine, Check, ImagePlus, LoaderCircle, RotateCcw, ShieldCheck, Upload, X } from 'lucide-react'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/bmp'

export default function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [originalUrl, setOriginalUrl] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [apiState, setApiState] = useState('checking')

  useEffect(() => {
    fetch('/api/health').then(async r => {
      const data = await r.json()
      setApiState(r.ok ? 'ready' : 'missing')
      if (!r.ok) setError(`Model setup needed. Missing: ${(data.missing_files || []).join(', ')}`)
    }).catch(() => setApiState('offline'))
  }, [])

  useEffect(() => () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl)
    if (resultUrl) URL.revokeObjectURL(resultUrl)
  }, [originalUrl, resultUrl])

  function chooseImage(nextFile) {
    if (!nextFile) return
    if (!nextFile.type.startsWith('image/')) return setError('Please select a valid image file.')
    if (nextFile.size > 16 * 1024 * 1024) return setError('Please choose an image smaller than 16 MB.')
    setError('')
    setFile(nextFile)
    setOriginalUrl(URL.createObjectURL(nextFile))
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setResultUrl('')
  }

  async function runColorization() {
    if (!file) return setError('Choose a photograph before beginning restoration.')
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      const response = await fetch('/api/colorize', { method: 'POST', body: form })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Colorization could not be completed.')
      }
      setResultUrl(URL.createObjectURL(await response.blob()))
    } catch (err) { setError(err.message || 'Could not connect to the restoration service.') }
    finally { setBusy(false) }
  }

  function reset() {
    setFile(null); setError(''); setOriginalUrl(''); setResultUrl('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function download() {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl; a.download = 'chromify-restored.png'
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><Aperture size={21} strokeWidth={1.35}/><span>CHROMIFY</span></a>
        <nav><a className="nav-active" href="#studio">The studio</a><a href="#process">The process</a></nav>
        <div className="top-right"><span className={`status-dot ${apiState === 'ready' ? 'online' : ''}`}/><span>{apiState === 'ready' ? 'Studio open' : apiState === 'checking' ? 'Preparing studio' : 'Studio unavailable'}</span></div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-index">AN IMAGE RESTORATION ATELIER <span>— EST. 2026</span></div>
          <h1>Every photograph<br/>holds a <i>memory.</i></h1>
          <p>Time may soften a photograph, but it need not take its color.<br className="desktop-break"/> Bring a monochrome moment into a new light.</p>
          <div className="hero-rule"><span>01</span><span>THE ART OF REMEMBERING</span><span>01 / 03</span></div>
        </section>

        <section className="studio-card" id="studio">
          <div className="studio-head">
            <div><div className="section-kicker">THE RESTORATION ROOM</div><h2>Begin with a photograph</h2></div>
            <div className="private-note"><ShieldCheck size={14}/> Your image stays on your local studio</div>
          </div>

          {!file ? (
            <button className="dropzone" onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); chooseImage(e.dataTransfer.files?.[0]) }}>
              <span className="upload-mark"><Upload size={22} strokeWidth={1.25}/></span>
              <span className="drop-title">Place a photograph here</span>
              <span className="drop-sub">Drag an image into this space, or browse your collection.</span>
              <span className="browse-btn">Select photograph <span>↗</span></span>
              <span className="file-hint">JPG · PNG · WEBP · BMP &nbsp; / &nbsp; MAX 16 MB</span>
            </button>
          ) : (
            <div className="preview-grid">
              <div className="preview-panel">
                <div className="preview-label"><span>PLATE I</span> ORIGINAL <em>MONOCHROME</em></div>
                <div className="image-frame"><img src={originalUrl} alt="Original uploaded photograph"/></div>
                <div className="image-meta"><span className="truncate">{file.name}</span><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div>
              </div>
              <div className="preview-panel">
                <div className="preview-label"><span>PLATE II</span> RESTORED <em>{resultUrl ? 'COMPLETE' : 'IN WAITING'}</em></div>
                <div className={`image-frame result-frame ${!resultUrl ? 'empty-result' : ''}`}>
                  {resultUrl ? <img src={resultUrl} alt="Colorized photograph"/> : <div className="result-placeholder"><span>II</span><strong>The restored photograph</strong><small>Its color will appear here</small></div>}
                  {busy && <div className="processing"><LoaderCircle className="spin" size={26}/><strong>Restoration in progress</strong><small>Please allow a moment</small></div>}
                </div>
                <div className="image-meta"><span>{resultUrl ? 'Ready to keep' : 'Awaiting restoration'}</span><span>{resultUrl ? <Check size={14}/> : '—'}</span></div>
              </div>
            </div>
          )}

          {error && <div className="error-banner"><X size={15}/><span>{error}</span></div>}
          <div className="action-row">
            <button className="btn-secondary" onClick={() => inputRef.current?.click()}><ImagePlus size={15}/>{file ? 'Choose another' : 'Choose photograph'}</button>
            <div className="action-spacer"/>
            {file && <button className="btn-ghost" onClick={reset}><RotateCcw size={14}/> Clear</button>}
            <button className="btn-primary" onClick={runColorization} disabled={!file || busy || apiState !== 'ready'}>
              {busy ? <><LoaderCircle className="spin" size={15}/> Restoring…</> : <>Begin restoration <span>↗</span></>}
            </button>
            {resultUrl && <button className="btn-download" onClick={download}><ArrowDownToLine size={15}/> Save image</button>}
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={e => chooseImage(e.target.files?.[0])}/>
        </section>

        <section className="process" id="process">
          <div className="process-heading"><span>FROM MONOCHROME TO MEMORY</span><span>THE METHOD</span></div>
          <div className="steps">
            <div className="step"><span className="step-no">01</span><div><strong>Choose an image</strong><p>Begin with a black and white photograph from your collection.</p></div></div>
            <div className="step"><span className="step-no">02</span><div><strong>Restore its tones</strong><p>A trained colorization model proposes a natural palette.</p></div></div>
            <div className="step"><span className="step-no">03</span><div><strong>Keep the moment</strong><p>Save the finished image and give the memory a new life.</p></div></div>
          </div>
        </section>
        <div className="disclaimer"><ShieldCheck size={13}/> Color is interpreted by a machine-learning model; it is an artistic estimate, not a record of historically exact colors.</div>
      </main>
      <footer><span>© 2026 CHROMIFY — IMAGE RESTORATION ATELIER</span><span>MADE FOR THE MEMORIES WE KEEP</span></footer>
    </div>
  )
}
