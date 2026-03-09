import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, Filter, Download, Plus, Edit2, Trash2, X,
  ChevronLeft, ChevronRight, CheckCircle, Upload, FileUp
} from 'lucide-react'
import {
  getSpares, deleteSpare, getFilterOptions, exportCSV,
  createSpare, updateSpare,
  getSAPCatalog, getCentros, getAlmacenes,
  getPartNumbers, getSAPLookup, lookupPartNumberBySAP
} from '../services/api'
import StatusBadge from '../components/StatusBadge'

// CSV bulk import helper
async function bulkImportSpares(rows, createFn) {
  const results = { ok: 0, err: 0 }
  for (const r of rows) {
    try { await createFn(r); results.ok++ } catch(_) { results.err++ }
  }
  return results
}

// ── SpareImportModal ──────────────────────────────────────────────────────────
const SPARE_IMPORT_COLS = [
  { key:'sap',              label:'sap' },
  { key:'orden_compra',     label:'orden_compra' },
  { key:'descripcion',      label:'descripcion' },
  { key:'serial_number',    label:'serial_number' },
  { key:'tipo',             label:'tipo' },
  { key:'modelo',           label:'modelo' },
  { key:'tipo_material',    label:'tipo_material' },
  { key:'grupo_art',        label:'grupo_art' },
  { key:'descrip_gpo_art',  label:'descrip_gpo_art' },
  { key:'cat_valoracion',   label:'cat_valoracion' },
  { key:'unidad_medida',    label:'unidad_medida' },
  { key:'creado_el_sap',    label:'creado_el_sap' },
  { key:'creado_por_sap',   label:'creado_por_sap' },
  { key:'sujeto_lote',      label:'sujeto_lote' },
  { key:'etiqueta',         label:'etiqueta' },
  { key:'cod_naciones',     label:'cod_naciones' },
  { key:'grupo_art_ext',    label:'grupo_art_ext' },
  { key:'cod_subcat',       label:'cod_subcat' },
  { key:'desc_subcat',      label:'desc_subcat' },
  { key:'perfil_numserie',  label:'perfil_numserie' },
  { key:'marcado_borrar',   label:'marcado_borrar' },
  { key:'texto_pedido',     label:'texto_pedido' },
  { key:'fuente',           label:'fuente' },
  { key:'part_number',      label:'part_number' },
  { key:'proveedor',        label:'proveedor' },
  { key:'centro',           label:'centro' },
  { key:'almacen',          label:'almacen' },
  { key:'zona',             label:'zona' },
  { key:'fecha_averia',     label:'fecha_averia' },
  { key:'fecha_ingreso',    label:'fecha_ingreso' },
  { key:'valor_lote',       label:'valor_lote' },
  { key:'motivo_asignacion',label:'motivo_asignacion' },
  { key:'estatus',          label:'estatus' },
]

function SpareImportModal({ onClose, onDone }) {
  const [rows, setRows]     = useState([])
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef             = useRef()

  const parseCSV = (text) => {
    const lines = text.replace(/\r/g,'').replace(/^\uFEFF/,'').split('\n').filter(l=>l.trim())
    if (lines.length < 2) { setError('El archivo debe tener encabezado y al menos una fila'); return }
    const headers = lines[0].replace(/^\uFEFF/,'').split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase())
    const SKIP = ['id','created_at','updated_at']
    const parsed = lines.slice(1).map(line => {
      const vals = []
      let cur = '', inQ = false
      for (const ch of line) {
        if (ch==='"') inQ=!inQ
        else if (ch===',' && !inQ) { vals.push(cur); cur='' }
        else cur+=ch
      }
      vals.push(cur)
      const obj = {}
      SPARE_IMPORT_COLS.forEach(col => {
        const idx = headers.findIndex(h => h===col.key.toLowerCase() || h===col.label.toLowerCase())
        const raw = idx>=0 ? (vals[idx]||'').replace(/^"|"$/g,'').trim() : ''
        // skip empty dates to avoid backend errors
        if (['fecha_averia','fecha_ingreso','creado_el_sap'].includes(col.key) && !raw) return
        if (raw) obj[col.key] = raw
      })
      return obj
    }).filter(r => Object.keys(r).length > 0)
    setRows(parsed); setError('')
  }

  const downloadTemplate = () => {
    const csv = SPARE_IMPORT_COLS.map(c=>c.key).join(',') + '\n'
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})
    const a = document.createElement('a')
    a.href=URL.createObjectURL(blob); a.download='plantilla_spares.csv'; a.click()
  }

  const handleSave = async () => {
    if (rows.length === 0) return
    setSaving(true)
    try {
      // Build CSV string and POST to backend import endpoint
      const headers = SPARE_IMPORT_COLS.map(c => c.label).join(',')
      const csvRows = rows.map(r => SPARE_IMPORT_COLS.map(c => `"${(r[c.key]||'').replace(/"/g,'""')}"`).join(','))
      const csvBlob = new Blob(['\uFEFF' + [headers, ...csvRows].join('\n')], {type:'text/csv;charset=utf-8;'})
      const formData = new FormData()
      formData.append('file', csvBlob, 'import.csv')
      const res = await fetch('/api/spare/import/csv/', { method:'POST', body: formData })
      const data = await res.json()
      setResult(data)
      onDone()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return createPortal(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,
      display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'40px 16px'}}>
      <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:680,
        boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>

        <div style={{padding:'14px 20px',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <p style={{margin:0,fontSize:14,fontWeight:700,color:'#fff'}}>Importar Spares — CSV</p>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',
            borderRadius:8,padding:5,cursor:'pointer',color:'#fff'}}><X size={15}/></button>
        </div>

        <div style={{padding:20}}>
          {result ? (
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <p style={{fontSize:32,margin:'0 0 8px'}}>{result.errors>0 ? '⚠️' : '✅'}</p>
              <p style={{fontWeight:700,fontSize:15,color:'#15803d',margin:0}}>Importación completada</p>
              <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:10}}>
                <div style={{textAlign:'center'}}>
                  <p style={{fontSize:22,fontWeight:700,color:'#15803d',margin:0}}>{result.imported||0}</p>
                  <p style={{fontSize:11,color:'#6b7280',margin:0}}>Importados</p>
                </div>
                {result.skipped>0 && <div style={{textAlign:'center'}}>
                  <p style={{fontSize:22,fontWeight:700,color:'#b45309',margin:0}}>{result.skipped}</p>
                  <p style={{fontSize:11,color:'#6b7280',margin:0}}>Omitidos</p>
                </div>}
                {result.errors>0 && <div style={{textAlign:'center'}}>
                  <p style={{fontSize:22,fontWeight:700,color:'#dc2626',margin:0}}>{result.errors}</p>
                  <p style={{fontSize:11,color:'#6b7280',margin:0}}>Errores</p>
                </div>}
              </div>
              {result.error_details?.length>0 && (
                <div style={{marginTop:12,textAlign:'left',background:'#fef2f2',borderRadius:8,
                  padding:'8px 12px',maxHeight:120,overflowY:'auto'}}>
                  {result.error_details.map((e,i)=>(
                    <p key={i} style={{fontSize:11,color:'#dc2626',margin:'2px 0'}}>{e}</p>
                  ))}
                </div>
              )}
              <button className="btn-primary" style={{marginTop:16}} onClick={onClose}>Cerrar</button>
            </div>
          ) : (
            <>
              <div style={{background:'#f5f3ff',borderRadius:8,padding:'10px 14px',
                marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <p style={{margin:0,fontSize:12,fontWeight:600,color:'#7c3aed'}}>📋 Plantilla CSV</p>
                  <p style={{margin:'2px 0 0',fontSize:11,color:'#6b7280'}}>
                    Compatible con el CSV exportado desde Spares. Campos: SAP, Part Number, Serial, Centro, Almacén, Estatus…
                  </p>
                </div>
                <button onClick={downloadTemplate}
                  style={{fontSize:11,padding:'6px 12px',border:'1px solid #7c3aed',
                    borderRadius:7,background:'#fff',color:'#7c3aed',cursor:'pointer',fontWeight:600}}>
                  Descargar plantilla
                </button>
              </div>

              <div onClick={()=>fileRef.current.click()}
                style={{border:'2px dashed #d8b4fe',borderRadius:10,padding:'24px',
                  textAlign:'center',cursor:'pointer',marginBottom:16,background:'#faf5ff'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#7c3aed'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#d8b4fe'}>
                <FileUp size={24} color="#a78bfa" style={{margin:'0 auto 8px',display:'block'}}/>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:'#7c3aed'}}>Seleccionar archivo CSV</p>
                <p style={{margin:'4px 0 0',fontSize:11,color:'#9ca3af'}}>Haz clic para buscar</p>
                <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}}
                  onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=ev=>parseCSV(ev.target.result);r.readAsText(f,'UTF-8')}}} />
              </div>

              {error && (
                <p style={{fontSize:12,color:'#dc2626',background:'#fef2f2',
                  padding:'8px 12px',borderRadius:6,border:'1px solid #fecaca',marginBottom:12}}>{error}</p>
              )}

              {rows.length>0 && (
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:8}}>
                    Vista previa — {rows.length} filas
                  </p>
                  <div style={{overflowX:'auto',borderRadius:8,border:'1px solid #e5e7eb'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead>
                        <tr style={{background:'#f9fafb'}}>
                          {SPARE_IMPORT_COLS.slice(0,6).map(c=>(
                            <th key={c.key} style={{padding:'6px 10px',textAlign:'left',
                              fontWeight:600,color:'#6b7280',textTransform:'uppercase',letterSpacing:.5}}>
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0,5).map((r,i)=>(
                          <tr key={i} style={{borderTop:'1px solid #f3f4f6'}}>
                            {SPARE_IMPORT_COLS.slice(0,6).map(c=>(
                              <td key={c.key} style={{padding:'6px 10px',color:'#374151'}}>
                                {r[c.key]||<span style={{color:'#d1d5db'}}>—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {rows.length>5&&<tr><td colSpan={6} style={{padding:'6px 10px',color:'#9ca3af',textAlign:'center'}}>+ {rows.length-5} filas más…</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
                <button className="btn-ghost" onClick={onClose}>Cancelar</button>
                <button className="btn-primary" onClick={handleSave}
                  disabled={saving||rows.length===0} style={{display:'flex',alignItems:'center',gap:6}}>
                  {saving ? 'Importando…' : <><Upload size={13}/> Importar {rows.length>0?`(${rows.length})`:''}</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}


const ESTATUS_LIST = [
  'Spare Operativo','Spare Utilizado','Spare Asignado','PENDIENTE','REVISION','BAJA'
]

const EMPTY = {
  sap:'', orden_compra:'', descripcion:'', serial_number:'', part_number:'', proveedor:'',
  // auto SAP
  tipo:'', modelo:'', tipo_material:'', grupo_art:'', descrip_gpo_art:'',
  cat_valoracion:'', unidad_medida:'', creado_el_sap:'', creado_por_sap:'',
  sujeto_lote:'', etiqueta:'', cod_naciones:'', grupo_art_ext:'',
  cod_subcat:'', desc_subcat:'', perfil_numserie:'', marcado_borrar:'',
  texto_pedido:'', fuente:'',
  // manual
  centro:'', almacen:'', zona:'',
  fecha_averia:'', fecha_ingreso:'',
  valor_lote:'', motivo_asignacion:'', estatus:'',
}

// ── SAP Autocomplete hook ─────────────────────────────────────────────────────
// Pre-builds a sorted index on first load so searches are O(log n) not O(n)
function useSAPSearch(sapCatalog) {
  const [query, setQuery]             = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching]     = useState(false)
  const debounce  = useRef(null)
  const indexRef  = useRef(null)   // sorted array of {key, row} for binary search

  // Build index once when catalog loads
  useEffect(() => {
    if (!sapCatalog.length) return
    // Sort by lowercase sap for binary search
    const idx = sapCatalog
      .map(r => ({ key: (r.sap || '').toLowerCase(), row: r }))
      .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
    indexRef.current = idx
  }, [sapCatalog])

  const search = (val) => {
    setQuery(val)
    clearTimeout(debounce.current)
    if (val.length < 2) { setSuggestions([]); return }
    setSearching(true)
    debounce.current = setTimeout(() => {
      const q = val.toLowerCase()
      const idx = indexRef.current
      let results = []

      if (idx) {
        // Binary search for prefix matches (very fast)
        let lo = 0, hi = idx.length - 1, start = idx.length
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          if (idx[mid].key >= q) { start = mid; hi = mid - 1 }
          else lo = mid + 1
        }
        // Collect up to 8 prefix matches
        for (let i = start; i < idx.length && results.length < 8; i++) {
          if (!idx[i].key.startsWith(q)) break
          results.push(idx[i].row)
        }
        // If fewer than 8, add texto_breve matches (but cap total scan at 5000)
        if (results.length < 8) {
          const seen = new Set(results.map(r => r.sap))
          const limit = Math.min(idx.length, 5000)
          for (let i = 0; i < limit && results.length < 8; i++) {
            const r = idx[i].row
            if (!seen.has(r.sap) && (r.texto_breve||'').toLowerCase().includes(q)) {
              results.push(r)
            }
          }
        }
      }

      setSuggestions(results)
      setSearching(false)
    }, 150)
  }

  const clear = () => { setQuery(''); setSuggestions([]) }
  return { query, setQuery, suggestions, setSuggestions, searching, search, clear }
}

// ── SpareModal ────────────────────────────────────────────────────────────────
// Uses refs for simple text/date inputs → zero re-renders on keystroke
function SpareModal({ spare, onClose, onSaved, sapCatalog }) {
  const init = spare ? { ...spare } : { ...EMPTY }

  // Only reactive state: SAP autocomplete + Centro/Almacén dropdowns + SAP auto-fields
  const [saving, setSaving]     = useState(false)
  const [sapMatch, setSapMatch] = useState(null)
  const [centros, setCentros]   = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [centro, setCentro]     = useState(init.centro || '')
  const [almacen, setAlmacen]   = useState(init.almacen || '')
  const [estatus, setEstatus]     = useState(init.estatus || '')
  const [proveedor, setProveedor] = useState(init.proveedor || '')
  const [partNumbers, setPartNumbers] = useState([])
  const [selProveedor, setSelProveedor] = useState(init.proveedor || '')
  const [selPartNumber, setSelPartNumber] = useState(init.part_number || '')
  const selProveedorRef = useRef(init.proveedor || '')
  const selPartNumberRef = useRef(init.part_number || '')
  const _setSelProveedor = (v) => { selProveedorRef.current = v; setSelProveedor(v) }
  const _setSelPartNumber = (v) => { selPartNumberRef.current = v; setSelPartNumber(v) }
  const [pnSugg, setPnSugg] = useState([])
  const [autoFields, setAutoFields] = useState({
    sap: init.sap || '', tipo: init.tipo || '', modelo: init.modelo || '',
    tipo_material: init.tipo_material || '', grupo_art: init.grupo_art || '',
    descrip_gpo_art: init.descrip_gpo_art || '', cat_valoracion: init.cat_valoracion || '',
    unidad_medida: init.unidad_medida || '', creado_el_sap: init.creado_el_sap || '',
    creado_por_sap: init.creado_por_sap || '', sujeto_lote: init.sujeto_lote || '',
    etiqueta: init.etiqueta || '', cod_naciones: init.cod_naciones || '',
    grupo_art_ext: init.grupo_art_ext || '', cod_subcat: init.cod_subcat || '',
    desc_subcat: init.desc_subcat || '', perfil_numserie: init.perfil_numserie || '',
    marcado_borrar: init.marcado_borrar || '', texto_pedido: init.texto_pedido || '',
    fuente: init.fuente || '',
  })

  // Refs for simple fields (no re-render on type)
  const refs = {
    zona:               useRef(null),
    serial_number:      useRef(null),
    part_number:        useRef(null),
    fecha_averia:       useRef(null),
    fecha_ingreso:      useRef(null),
    valor_lote:         useRef(null),
    orden_compra:       useRef(null),
    descripcion:        useRef(null),
    motivo_asignacion:  useRef(null),
  }

  const { query, setQuery, suggestions, setSuggestions, searching, search } = useSAPSearch(sapCatalog)

  useEffect(() => { getCentros().then(r => setCentros(r.data)).catch(()=>{}) }, [])
  useEffect(() => { getPartNumbers().then(r => { const d=r.data; setPartNumbers(Array.isArray(d)?d:(d.results||[])) }).catch(()=>{}) }, [])
  // When proveedor changes, reset part_number and filter list
  const filteredPNs = selProveedor ? partNumbers.filter(p => p.proveedor === selProveedor) : []
  useEffect(() => {
    if (centro) getAlmacenes(centro).then(r => setAlmacenes(r.data)).catch(()=>{})
    else setAlmacenes([])
  }, [centro])
  useEffect(() => { if (spare?.sap) setQuery(spare.sap) }, [spare])

  // On edit: always fetch SAP catalog data to fill fields
  useEffect(() => {
    if (!spare?.sap) return
    getSAPLookup(spare.sap).then(res => {
      const row = res.data
      console.log('[SAP Lookup]', row)
      if (!row?.sap) return
      setAutoFields({
        sap: row.sap,
        tipo:            row.denom_tpmt   || row.tipo            || '',
        modelo:          row.texto_breve  || row.modelo          || '',
        tipo_material:   row.tipo_material   || '',
        grupo_art:       row.grupo_art       || '',
        descrip_gpo_art: row.descrip_gpo_art || '',
        cat_valoracion:  row.cat_valoracion  || '',
        unidad_medida:   row.unidad_medida   || '',
        creado_el_sap:   row.creado_el       || '',
        creado_por_sap:  row.creado_por      || '',
        sujeto_lote:     row.sujeto_lote     || '',
        etiqueta:        row.etiqueta        || '',
        cod_naciones:    row.cod_naciones    || '',
        grupo_art_ext:   row.grupo_art_ext   || '',
        cod_subcat:      row.cod_subcat      || '',
        desc_subcat:     row.desc_subcat     || '',
        perfil_numserie: row.perfil_numserie || '',
        marcado_borrar:  row.marcado_borrar  || '',
        texto_pedido:    row.texto_pedido    || '',
        fuente:          row.fuente          || '',
      })
      // Also lookup Part Number + Proveedor by SAP
      lookupPartNumberBySAP(row.sap).then(pnRes => {
        console.log('[PN Lookup by SAP]', row.sap, pnRes.data)
        if (pnRes.data?.part_number) {
          _setSelProveedor(pnRes.data.proveedor || '')
          _setSelPartNumber(pnRes.data.part_number)
        }
      }).catch(err => console.log('[PN Lookup error]', err))
    }).catch(() => {})
  }, [spare])

  const applyMatch = (row) => {
    const af = {
      sap: row.sap,
      tipo:  row.denom_tpmt || row.tipo || '',
      modelo: row.texto_breve || row.modelo || '',
      tipo_material: row.tipo_material||'', grupo_art: row.grupo_art||'',
      descrip_gpo_art: row.descrip_gpo_art||'', cat_valoracion: row.cat_valoracion||'',
      unidad_medida: row.unidad_medida||'', creado_el_sap: row.creado_el||'',
      creado_por_sap: row.creado_por||'', sujeto_lote: row.sujeto_lote||'',
      etiqueta: row.etiqueta||'', cod_naciones: row.cod_naciones||'',
      grupo_art_ext: row.grupo_art_ext||'', cod_subcat: row.cod_subcat||'',
      desc_subcat: row.desc_subcat||'', perfil_numserie: row.perfil_numserie||'',
      marcado_borrar: row.marcado_borrar||'', texto_pedido: row.texto_pedido||'',
      fuente: row.fuente||'',
    }
    setAutoFields(af)
    setSapMatch(row)
    setQuery(row.sap)
    setSuggestions([])

    // Auto-fill Part Number + Proveedor: try local array first, then backend
    const pnLocal = partNumbers.find(p => p.sap === row.sap)
    if (pnLocal) {
      setSelProveedor(pnLocal.proveedor)
      setSelPartNumber(pnLocal.part_number)
    } else {
      lookupPartNumberBySAP(row.sap).then(res => {
        if (res.data?.part_number) {
          setSelProveedor(res.data.proveedor || '')
          setSelPartNumber(res.data.part_number)
        }
      }).catch(() => {})
    }
  }

  // Collect all field values from refs + state on save
  const handleSave = async () => {
    if (!autoFields.sap) { alert('El código SAP es requerido.'); return }
    console.log('[handleSave] proveedor:', selProveedorRef.current, 'pn:', selPartNumberRef.current)
    const payload = {
      ...autoFields,
      centro, almacen, estatus,
      proveedor:         selProveedorRef.current,
      part_number:       selPartNumberRef.current,
      zona:              refs.zona.current?.value              || '',
      serial_number:     refs.serial_number.current?.value     || '',
      fecha_averia:      refs.fecha_averia.current?.value      || null,
      fecha_ingreso:     refs.fecha_ingreso.current?.value     || null,
      valor_lote:        refs.valor_lote.current?.value        || '',
      orden_compra:      refs.orden_compra.current?.value      || '',
      descripcion:       refs.descripcion.current?.value       || '',
      motivo_asignacion: refs.motivo_asignacion.current?.value || '',
    }
    setSaving(true)
    try {
      spare ? await updateSpare(spare.id, payload) : await createSpare(payload)
      onSaved(); onClose()
    } catch(e) {
      alert('Error al guardar: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    } finally { setSaving(false) }
  }

  // Uncontrolled field (uses ref, no re-render on type)
  const F = ({ label, k, type='text', full, rows }) => (
    <div style={ full ? { gridColumn:'1/-1' } : {} }>
      <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>{label}</label>
      {rows
        ? <textarea ref={refs[k]} className="input" rows={rows} style={{ resize:'none' }}
            defaultValue={init[k] || ''} />
        : <input ref={refs[k]} type={type} className="input"
            defaultValue={init[k] || ''} />
      }
    </div>
  )

  // Read-only auto-filled field
  const AutoF = ({ label, k }) => (
    <div>
      <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>
        {label}
        <span style={{ marginLeft:5, fontSize:9, padding:'1px 6px', borderRadius:10,
          background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', fontWeight:700 }}>AUTO SAP</span>
      </label>
      <input className="input" readOnly value={autoFields[k] || ''}
        style={{ background: autoFields[k] ? '#f0fdf4' : '#f9fafb',
          borderColor: autoFields[k] ? '#bbf7d0' : undefined,
          color: autoFields[k] ? '#166534' : '#9ca3af', cursor:'default' }} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.55)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto" style={{ padding:0 }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'18px 24px', borderBottom:'1px solid #e5e7eb' }}>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:17 }}>
            {spare ? 'Editar Spare' : 'Nuevo Spare'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', padding:4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* ── SAP Search ── */}
          <p style={{ fontSize:10, fontWeight:700, color:'#6b7280', letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:10, paddingBottom:6, borderBottom:'1px solid #f3f4f6' }}>
            Búsqueda SAP
          </p>
          <div style={{ marginBottom:18, position:'relative' }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>
              Código SAP / Nombre del equipo
            </label>
            <input className="input" placeholder="Escribe el código SAP o nombre del equipo…"
              value={query} autoComplete="off"
              onChange={e => {
                const val = e.target.value
                search(val)
                setSapMatch(null)
                setAutoFields(af => ({...af, sap: val}))
              }}
              onBlur={async e => {
                const val = e.target.value.trim()
                if (!val) return
                // Try local catalog first (O(log n))
                const exact = sapCatalog.find(r => r.sap === val)
                if (exact) { applyMatch(exact); return }
                // Fallback: query backend SAP catalog DB
                try {
                  const res = await getSAPLookup(val)
                  if (res.data?.sap) applyMatch(res.data)
                } catch(_) {}
              }}
            />
            {(suggestions.length > 0 || searching) && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200,
                background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
                boxShadow:'0 8px 24px rgba(0,0,0,0.12)', maxHeight:220, overflowY:'auto' }}>
                {searching
                  ? <div style={{ padding:'12px 14px', fontSize:12, color:'#6b7280' }}>Buscando…</div>
                  : <>
                    <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 1fr', gap:8,
                      padding:'6px 14px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb',
                      fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:'#9ca3af' }}>
                      <span>SAP</span><span>Denominación</span><span>Texto Breve</span>
                    </div>
                    {suggestions.map(s => (
                      <div key={s.sap} onClick={() => applyMatch(s)}
                        style={{ display:'grid', gridTemplateColumns:'100px 1fr 1fr', gap:8,
                          padding:'9px 14px', cursor:'pointer', borderBottom:'1px solid #f3f4f6', fontSize:12 }}
                        onMouseEnter={e => e.currentTarget.style.background='#f5f3ff'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <span style={{ fontWeight:700, color:'#7c3aed' }}>{s.sap}</span>
                        <span style={{ color:'#6b7280', fontSize:11 }}>{s.denom_tpmt}</span>
                        <span style={{ color:'#374151', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.texto_breve}</span>
                      </div>
                    ))}
                  </>
                }
              </div>
            )}
            {!searching && query.length >= 2 && suggestions.length === 0 && !sapMatch && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200,
                background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
                padding:'12px 14px', fontSize:12, color:'#9ca3af', boxShadow:'0 8px 24px rgba(0,0,0,0.1)' }}>
                Sin coincidencias para "{query}"
              </div>
            )}
            {sapMatch && (
              <div style={{ marginTop:5, fontSize:12, color:'#16a34a', display:'flex', alignItems:'center', gap:4 }}>
                <CheckCircle size={13} /> Coincidencia encontrada — campos SAP completados automáticamente
              </div>
            )}
          </div>

          {/* ── Auto SAP fields ── */}
          <p style={{ fontSize:10, fontWeight:700, color:'#6b7280', letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:10, paddingBottom:6, borderBottom:'1px solid #f3f4f6' }}>
            Datos del Material (auto SAP)
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
            <AutoF label="Material (SAP)"       k="sap" />
            <AutoF label="Texto Breve"          k="modelo" />
            <AutoF label="Denominación TPMT"    k="tipo" />
            <AutoF label="Tipo Material"        k="tipo_material" />
            <AutoF label="Grupo Artículos"      k="grupo_art" />
            <AutoF label="Descrip. Gpo. Art."   k="descrip_gpo_art" />
            <AutoF label="Categoría Valoración" k="cat_valoracion" />
            <AutoF label="Unidad Medida"        k="unidad_medida" />
            <AutoF label="Creado El"            k="creado_el_sap" />
            <AutoF label="Creado Por"           k="creado_por_sap" />
            <AutoF label="Sujeto a Lote"        k="sujeto_lote" />
            <AutoF label="Etiqueta"             k="etiqueta" />
            <AutoF label="Cód. Naciones Unidas" k="cod_naciones" />
            <AutoF label="Grupo Art. Externo"   k="grupo_art_ext" />
            <AutoF label="Cód. Subcategoría"    k="cod_subcat" />
            <AutoF label="Desc. Subcategoría"   k="desc_subcat" />
            <AutoF label="Perfil Numserie"      k="perfil_numserie" />
            <AutoF label="Marcado Borrar"       k="marcado_borrar" />
            <AutoF label="Texto Pedido Compras" k="texto_pedido" />
          </div>

          {/* ── Ubicación ── */}
          <p style={{ fontSize:10, fontWeight:700, color:'#6b7280', letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:10, paddingBottom:6, borderBottom:'1px solid #f3f4f6' }}>
            Ubicación
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Centro</label>
              <select className="input" value={centro}
                onChange={e => { setCentro(e.target.value); setAlmacen('') }}>
                <option value="">— seleccionar —</option>
                {centros.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Almacén</label>
              <select className="input" value={almacen} onChange={e => setAlmacen(e.target.value)}
                disabled={!centro} style={{ opacity: centro ? 1 : 0.4 }}>
                <option value="">— seleccionar —</option>
                {almacenes.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <F label="Zona"          k="zona" />
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Proveedor</label>
              <input className="input" placeholder="Ej: HUAWEI, ZTE…" value={selProveedor}
                onChange={e => { setSelProveedor(e.target.value); setSelPartNumber('') }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Part Number</label>
              <div style={{ position:'relative' }}>
                <input className="input" placeholder="Buscar o escribir part number…"
                  value={selPartNumber} autoComplete="off"
                  onChange={e => {
                    setSelPartNumber(e.target.value)
                    setPnSugg(partNumbers.filter(p =>
                      p.part_number.toLowerCase().includes(e.target.value.toLowerCase())
                    ).slice(0, 8))
                  }}
                  onBlur={() => setTimeout(() => setPnSugg([]), 150)}
                />
                {pnSugg.length > 0 && (
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:300,
                    background:'#fff', border:'1px solid #e5e7eb', borderRadius:8,
                    boxShadow:'0 6px 20px rgba(0,0,0,0.1)', maxHeight:180, overflowY:'auto' }}>
                    {pnSugg.map(p => (
                      <div key={p.id} onMouseDown={() => { _setSelPartNumber(p.part_number); _setSelProveedor(p.proveedor); setPnSugg([]) }}
                        style={{ padding:'8px 12px', cursor:'pointer', fontSize:12,
                          display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background='#f5f3ff'}
                        onMouseLeave={e => e.currentTarget.style.background=''}>
                        <span style={{ fontWeight:700, color:'#7c3aed', fontFamily:'monospace' }}>{p.part_number}</span>
                        <span style={{ fontSize:11, color:'#6b7280' }}>{p.proveedor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <F label="Serial Number" k="serial_number" />
          </div>

          {/* ── Datos de Ingreso ── */}
          <p style={{ fontSize:10, fontWeight:700, color:'#6b7280', letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:10, paddingBottom:6, borderBottom:'1px solid #f3f4f6' }}>
            Datos de Ingreso
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
            <F label="Fecha Avería"   k="fecha_averia"  type="date" />
            <F label="Fecha Ingreso"  k="fecha_ingreso" type="date" />
            <F label="Valor Lote"     k="valor_lote" />
            <F label="Orden de Compra" k="orden_compra" />
            <F label="Descripción"    k="descripcion"   rows={2} full />
            <F label="Motivo Asignación" k="motivo_asignacion" full />
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Estatus</label>
              <select className="input" value={estatus} onChange={e => setEstatus(e.target.value)}>
                <option value="">— seleccionar —</option>
                {ESTATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end',
          padding:'14px 24px', borderTop:'1px solid #e5e7eb' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SpareList page ────────────────────────────────────────────────────────────
export default function SpareList() {
  const [spares, setSpares]   = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [pages, setPages]     = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filters, setFilters] = useState({ estatus:'', tipo:'', centro:'' })
  const [options, setOptions] = useState({ estatus:[], tipo:[], centro:[] })
  const [showFilters, setShowFilters] = useState(false)
  const [modal, setModal]     = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [sapCatalog, setSapCatalog] = useState([])

  // Load SAP catalog from public JSON (fast, no DB round-trip for search)
  useEffect(() => {
    fetch('/sap_catalog.json')
      .then(r => r.json())
      .then(data => setSapCatalog(data))
      .catch(() => setSapCatalog([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, page_size:20, search: search || undefined }
    if (filters.estatus) params.estatus = filters.estatus
    if (filters.tipo)    params.tipo    = filters.tipo
    if (filters.centro)  params.centro  = filters.centro
    getSpares(params)
      .then(r => { setSpares(r.data.results); setTotal(r.data.count)
        setPages(Math.ceil(r.data.count / 20)) })
      .finally(() => setLoading(false))
  }, [page, search, filters])

  useEffect(() => { load() }, [load])
  useEffect(() => { getFilterOptions().then(r => setOptions(r.data)) }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este spare?')) return
    setDeleting(id)
    await deleteSpare(id).finally(() => { setDeleting(null); load() })
  }

  const handleExport = async () => {
    const r = await exportCSV()
    const url = URL.createObjectURL(new Blob([r.data]))
    Object.assign(document.createElement('a'), { href:url, download:'spare_export.csv' }).click()
  }

  const Sel = ({ k, label }) => (
    <select className="input text-sm" value={filters[k]}
      onChange={e => { setFilters(f => ({ ...f, [k]: e.target.value })); setPage(1) }}>
      <option value="">{label}</option>
      {options[k]?.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Spares</h1>
          <p className="text-sm mt-0.5" style={{ color:'#6b7280' }}>{total.toLocaleString()} registros</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex items-center gap-2" onClick={handleExport}>
            <Download size={15} /> Exportar
          </button>
          <button className="btn-ghost flex items-center gap-2" onClick={() => setShowImport(true)}>
            <Upload size={15} /> Importar
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setModal('new')}>
            <Plus size={15} /> Nuevo
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#6b7280' }} />
            <input className="input pl-9" placeholder="Buscar SAP, serial, descripción, modelo…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <button className="btn-ghost flex items-center gap-2" onClick={() => setShowFilters(f => !f)}>
            <Filter size={15} /> Filtros
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-3 gap-3">
            <Sel k="estatus" label="— Estatus —" />
            <Sel k="tipo"    label="— Tipo —"    />
            <Sel k="centro"  label="— Centro —"  />
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom:'1px solid #e5e7eb', background:'#f9fafb' }}>
                {['SAP','Descripción / Texto Breve','Part Number','Proveedor','Serial','Tipo','Centro','Almacén','Estatus','Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide"
                    style={{ color:'#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12" style={{ color:'#6b7280' }}>Cargando…</td></tr>
              ) : spares.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12" style={{ color:'#6b7280' }}>Sin resultados</td></tr>
              ) : spares.map((s, i) => (
                <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6',
                  background: i%2===0 ? 'transparent' : 'rgba(249,250,251,0.6)' }}>
                  <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color:'#7c3aed' }}>{s.sap}</td>
                  <td className="px-4 py-3 max-w-xs" style={{ color:'#111827' }}>
                    <div style={{ fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:220 }}
                      title={s.modelo}>{s.modelo || s.descripcion || '—'}</div>
                    {s.descripcion && s.modelo && (
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:220 }}
                        title={s.descripcion}>{s.descripcion}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color:'#374151', fontWeight:500 }}>{s.part_number || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {s.proveedor
                      ? <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600,
                          background: s.proveedor==='Huawei' ? '#eff6ff' : s.proveedor==='ZTE' ? '#f0fdf4' : s.proveedor==='ALCATEL' ? '#fef3c7' : '#f3f4f6',
                          color:      s.proveedor==='Huawei' ? '#1d4ed8' : s.proveedor==='ZTE' ? '#15803d' : s.proveedor==='ALCATEL' ? '#b45309' : '#6b7280',
                        }}>{s.proveedor}</span>
                      : <span style={{ color:'#9ca3af' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color:'#6b7280' }}>{s.serial_number || '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color:'#6b7280' }}>{s.tipo || '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color:'#374151' }}>{s.centro || '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color:'#6b7280' }}>{s.almacen || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge estatus={s.estatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setModal(s)} className="p-1.5 rounded hover:opacity-70" style={{ color:'#7c3aed' }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} disabled={deleting===s.id}
                        className="p-1.5 rounded hover:opacity-70" style={{ color:'#dc2626' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop:'1px solid #e5e7eb' }}>
            <p className="text-xs" style={{ color:'#6b7280' }}>Página {page} de {pages} · {total.toLocaleString()} registros</p>
            <div className="flex gap-2">
              <button className="btn-ghost px-2 py-1 text-xs flex items-center gap-1"
                disabled={page===1} onClick={() => setPage(p=>p-1)}>
                <ChevronLeft size={14}/> Anterior
              </button>
              <button className="btn-ghost px-2 py-1 text-xs flex items-center gap-1"
                disabled={page===pages} onClick={() => setPage(p=>p+1)}>
                Siguiente <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}
      </div>

      {showImport && (
        <SpareImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load() }}
        />
      )}

      {modal && createPortal(
        <SpareModal
          spare={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={load}
          sapCatalog={sapCatalog}
        />,
        document.body
      )}
    </div>
  )
}
