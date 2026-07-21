import {
  useState, useRef, useCallback, useEffect, createContext, useContext, useMemo,
  type WheelEvent as RWheelEvent, type MouseEvent as RMouseEvent,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'available' | 'occupied' | 'reserved' | 'maintenance'

interface Booth {
  id: string; label: string; exhibitor?: string; area: string; status: Status
  category?: string; x: number; y: number; w: number; h: number
  rotation?: number; contact?: string; since?: string; sqm?: number
  executive?: string; mondayUrl?: string
}

interface AreaDef {
  id: string; name: string; x: number; y: number; w: number; h: number
  accent: string; dim: string
}

interface HistoryEntry {
  id: string; boothId: string; boothLabel: string; action: string
  user: string; timestamp: string; detail?: string
}

interface ColorScheme {
  name: string; bg: string; surface: string; surface2: string; border: string
  text: string; muted: string; accent: string
  occupied: string; reserved: string; available: string; maintenance: string
}

interface StatusCfg { label: string; color: string; bg: string }

interface AppCtxType {
  scheme: ColorScheme
  st: Record<Status, StatusCfg>
}

// ─── Color Presets ────────────────────────────────────────────────────────────

const PRESETS: Record<string, ColorScheme> = {
  dark: {
    name: 'Dark Navy', bg:'#08090d', surface:'#0e1117', surface2:'#141923', border:'#1e2a38',
    text:'#c8d5e2', muted:'#4e6070', accent:'#e8a020',
    occupied:'#e04848', reserved:'#3878f0', available:'#24c864', maintenance:'#9850e0',
  },
  midnight: {
    name: 'Midnight', bg:'#000005', surface:'#080810', surface2:'#10101c', border:'#18183a',
    text:'#dde4ff', muted:'#404068', accent:'#00d4ff',
    occupied:'#ff4466', reserved:'#8866ff', available:'#00cc88', maintenance:'#ff8844',
  },
  steel: {
    name: 'Steel', bg:'#0d1117', surface:'#161b22', surface2:'#21262d', border:'#30363d',
    text:'#c9d1d9', muted:'#484f58', accent:'#58a6ff',
    occupied:'#f85149', reserved:'#79c0ff', available:'#3fb950', maintenance:'#d2a8ff',
  },
  warm: {
    name: 'Warm Coal', bg:'#0d0a08', surface:'#18130e', surface2:'#221b14', border:'#2e2318',
    text:'#e8ddd0', muted:'#6a5a48', accent:'#ff7b35',
    occupied:'#e05050', reserved:'#5090e0', available:'#50c870', maintenance:'#c050d0',
  },
  sage: {
    name: 'Forest', bg:'#070d08', surface:'#0d1710', surface2:'#131f15', border:'#1c3020',
    text:'#c4e0c8', muted:'#486a4c', accent:'#52d870',
    occupied:'#e04848', reserved:'#4080f0', available:'#30e060', maintenance:'#c055d0',
  },
  light: {
    name: 'Light', bg:'#f4f6f8', surface:'#ffffff', surface2:'#edf0f4', border:'#dce2ea',
    text:'#1a2330', muted:'#7a8fa0', accent:'#d08010',
    occupied:'#c83030', reserved:'#2860d0', available:'#188040', maintenance:'#7030b0',
  },
}

// ─── Context ──────────────────────────────────────────────────────────────────

function makeStatusConfig(scheme: ColorScheme): Record<Status, StatusCfg> {
  return {
    occupied:    { label:'Ocupado',    color: scheme.occupied,    bg: scheme.occupied    + '22' },
    reserved:    { label:'Reservado',  color: scheme.reserved,    bg: scheme.reserved    + '22' },
    available:   { label:'Disponível', color: scheme.available,   bg: scheme.available   + '22' },
    maintenance: { label:'Manutenção', color: scheme.maintenance, bg: scheme.maintenance + '22' },
  }
}

const AppCtx = createContext<AppCtxType>({
  scheme: PRESETS.dark,
  st: makeStatusConfig(PRESETS.dark),
})

function useApp() { return useContext(AppCtx) }

// ─── Static Data ──────────────────────────────────────────────────────────────

const AREAS: AreaDef[] = [
  { id:'tech',   name:'Tecnologia',        x:20,  y:20,  w:420, h:240, accent:'#3878f0', dim:'#0e2050' },
  { id:'design', name:'Design & Inovação', x:460, y:20,  w:420, h:240, accent:'#9850e0', dim:'#2a0e4a' },
  { id:'food',   name:'Gastronomia',       x:20,  y:280, w:200, h:240, accent:'#24c864', dim:'#0e3820' },
  { id:'conf',   name:'Conferências',      x:240, y:280, w:640, h:240, accent:'#e8a020', dim:'#7a4e08' },
]
const AREA_MAP = Object.fromEntries(AREAS.map(a => [a.id, a]))

const BOOTHS: Booth[] = [
  // ── Tecnologia Row 1
  { id:'A01', label:'A-01', exhibitor:'Totvs',         area:'tech',   status:'occupied',    category:'ERP & Software',    x:30,  y:65,  w:55, h:72, sqm:9,  executive:'Ricardo Viana',   mondayUrl:'https://monday.com/boards/12345/pulses/10001', contact:'lucas@totvs.com.br',    since:'2025-11-03' },
  { id:'A02', label:'A-02', exhibitor:'Dell Brasil',   area:'tech',   status:'occupied',    category:'Hardware',          x:95,  y:65,  w:55, h:72, sqm:9,  executive:'Camila Fonseca',  mondayUrl:'https://monday.com/boards/12345/pulses/10002', contact:'mkt@dell.com.br',        since:'2025-11-10' },
  { id:'A03', label:'A-03', exhibitor:'Lenovo BR',     area:'tech',   status:'occupied',    category:'Hardware',          x:162, y:58,  w:55, h:80, sqm:9,  executive:'Bruno Almeida',   mondayUrl:'https://monday.com/boards/12345/pulses/10003', contact:'events@lenovo.com',      since:'2025-12-01', rotation:-8 },
  { id:'A04', label:'A-04', exhibitor:'AWS Brasil',    area:'tech',   status:'reserved',    category:'Cloud',             x:232, y:65,  w:55, h:72, sqm:9,  contact:'aws-events@amazon.com', since:'2026-01-15' },
  { id:'A05', label:'A-05',                            area:'tech',   status:'available',   category:undefined,           x:298, y:65,  w:55, h:72, sqm:9  },
  { id:'A06', label:'A-06', exhibitor:'Google Cloud',  area:'tech',   status:'reserved',    category:'Cloud',             x:365, y:65,  w:55, h:72, sqm:9,  contact:'cloud-br@google.com', since:'2026-02-08' },
  // ── Tecnologia Row 2
  { id:'A07', label:'A-07', exhibitor:'Microsoft BR',  area:'tech',   status:'occupied',    category:'Software & Cloud',  x:30,  y:158, w:55, h:72, sqm:9,  executive:'Priya Sharma',    mondayUrl:'https://monday.com/boards/12345/pulses/10007', contact:'evbr@microsoft.com',     since:'2025-10-28' },
  { id:'A08', label:'A-08', exhibitor:'Oracle BR',     area:'tech',   status:'occupied',    category:'Database',          x:97,  y:155, w:68, h:80, sqm:12, executive:'Luiza Carvalho',  mondayUrl:'https://monday.com/boards/12345/pulses/10008', contact:'oracle-ev@oracle.com',   since:'2025-11-20', rotation:10 },
  { id:'A09', label:'A-09', exhibitor:'Salesforce',    area:'tech',   status:'occupied',    category:'CRM',               x:178, y:158, w:55, h:72, sqm:9,  executive:'André Mello',     mondayUrl:'https://monday.com/boards/12345/pulses/10009', contact:'brasil@salesforce.com',  since:'2025-12-15' },
  { id:'A10', label:'A-10',                            area:'tech',   status:'maintenance', category:undefined,           x:243, y:158, w:55, h:72, sqm:9  },
  { id:'A11', label:'A-11',                            area:'tech',   status:'available',   category:undefined,           x:307, y:158, w:55, h:72, sqm:9  },
  { id:'A12', label:'A-12', exhibitor:'Samsung BR',    area:'tech',   status:'occupied',    category:'Dispositivos',      x:370, y:158, w:55, h:72, sqm:9,  executive:'Ji-ho Park',      mondayUrl:'https://monday.com/boards/12345/pulses/10012', contact:'events@samsung.com.br',  since:'2026-01-05' },

  // ── Design & Inovação Row 1
  { id:'B01', label:'B-01', exhibitor:'Adobe Brasil',  area:'design', status:'occupied',    category:'Creative Software', x:470, y:65,  w:70, h:75, sqm:10, executive:'Fernanda Costa',  mondayUrl:'https://monday.com/boards/12345/pulses/20001', contact:'br.events@adobe.com',    since:'2025-11-18' },
  { id:'B02', label:'B-02', exhibitor:'Figma Inc.',    area:'design', status:'occupied',    category:'Design Tools',      x:552, y:60,  w:70, h:82, sqm:10, executive:'Dylan Park',      mondayUrl:'https://monday.com/boards/12345/pulses/20002', contact:'events@figma.com',        since:'2025-12-10', rotation:12 },
  { id:'B03', label:'B-03', exhibitor:'Nubank',        area:'design', status:'occupied',    category:'Fintech Design',    x:636, y:65,  w:70, h:75, sqm:10, executive:'Rafael Torres',   mondayUrl:'https://monday.com/boards/12345/pulses/20003', contact:'press@nubank.com.br',     since:'2026-01-20' },
  { id:'B04', label:'B-04',                            area:'design', status:'available',   category:undefined,           x:718, y:65,  w:70, h:75, sqm:10 },
  { id:'B05', label:'B-05', exhibitor:'XP Inc.',       area:'design', status:'reserved',    category:'Financial UX',      x:800, y:65,  w:70, h:75, sqm:10, contact:'eventos@xp.com.br', since:'2026-02-12' },
  // ── Design & Inovação Row 2
  { id:'B06', label:'B-06', exhibitor:'Natura &Co',    area:'design', status:'occupied',    category:'Brand & Packaging', x:470, y:160, w:70, h:75, sqm:10, executive:'Isabela Rocha',   mondayUrl:'https://monday.com/boards/12345/pulses/20006', contact:'eventos@natura.net',      since:'2025-11-05' },
  { id:'B07', label:'B-07', exhibitor:'Magalu',        area:'design', status:'occupied',    category:'Retail Tech',       x:552, y:157, w:70, h:80, sqm:10, executive:'Tiago Brito',     mondayUrl:'https://monday.com/boards/12345/pulses/20007', contact:'mktg@magazineluiza.com', since:'2025-12-20', rotation:-10 },
  { id:'B08', label:'B-08', exhibitor:'iFood',         area:'design', status:'reserved',    category:'App Design',        x:636, y:160, w:70, h:75, sqm:10, contact:'pr@ifood.com.br',    since:'2026-01-30' },
  { id:'B09', label:'B-09',                            area:'design', status:'maintenance', category:undefined,           x:718, y:160, w:70, h:75, sqm:10 },
  { id:'B10', label:'B-10', exhibitor:'Rappi BR',      area:'design', status:'occupied',    category:'App Design',        x:800, y:160, w:70, h:75, sqm:10, executive:'Santiago López',   mondayUrl:'https://monday.com/boards/12345/pulses/20010', contact:'eventos@rappi.com',       since:'2026-02-01' },

  // ── Gastronomia (2×3)
  { id:'C01', label:'C-01', exhibitor:'Ambev',         area:'food',   status:'occupied',    category:'Bebidas',           x:32,  y:298, w:84, h:68, sqm:8,  executive:'Marcos Pinto',    mondayUrl:'https://monday.com/boards/12345/pulses/30001', contact:'ambev-ev@ambev.com.br',  since:'2025-11-15', rotation:6 },
  { id:'C02', label:'C-02', exhibitor:'Outback BR',    area:'food',   status:'occupied',    category:'Restaurante',       x:124, y:298, w:84, h:68, sqm:8,  executive:'Laura Mendes',    mondayUrl:'https://monday.com/boards/12345/pulses/30002', contact:'ev@outback.com.br',       since:'2025-12-05' },
  { id:'C03', label:'C-03',                            area:'food',   status:'available',   category:undefined,           x:32,  y:378, w:84, h:68, sqm:8  },
  { id:'C04', label:'C-04', exhibitor:'Nestlé BR',     area:'food',   status:'reserved',    category:'Alimentos',         x:124, y:378, w:84, h:68, sqm:8,  contact:'events@nestle.com.br', since:'2026-01-25' },
  { id:'C05', label:'C-05', exhibitor:'Cacau Show',    area:'food',   status:'occupied',    category:'Chocolates',        x:32,  y:458, w:84, h:52, sqm:8,  executive:'Gisele Campos',   mondayUrl:'https://monday.com/boards/12345/pulses/30005', contact:'eventos@cacaushow.com.br', since:'2025-11-22' },
  { id:'C06', label:'C-06',                            area:'food',   status:'available',   category:undefined,           x:124, y:458, w:84, h:52, sqm:8  },

  // ── Conferências (2×4)
  { id:'D01', label:'D-01', exhibitor:'Embraer',       area:'conf',   status:'occupied',    category:'Keynote Sponsor',   x:256, y:298, w:136, h:98, sqm:18, executive:'Cláudio Menezes', mondayUrl:'https://monday.com/boards/12345/pulses/40001', contact:'comms@embraer.com.br',   since:'2025-10-15', rotation:-5 },
  { id:'D02', label:'D-02', exhibitor:'Itaú Unibanco', area:'conf',   status:'occupied',    category:'Keynote Sponsor',   x:404, y:298, w:136, h:98, sqm:18, executive:'Ana Lima',        mondayUrl:'https://monday.com/boards/12345/pulses/40002', contact:'eventos@itau.com.br',    since:'2025-10-20' },
  { id:'D03', label:'D-03', exhibitor:'Localiza',      area:'conf',   status:'reserved',    category:'Diamond Sponsor',   x:552, y:298, w:136, h:98, sqm:18, contact:'marketing@localiza.com', since:'2026-01-10' },
  { id:'D04', label:'D-04', exhibitor:'Vivo',          area:'conf',   status:'occupied',    category:'Diamond Sponsor',   x:700, y:298, w:120, h:98, sqm:18, executive:'Helena Dias',     mondayUrl:'https://monday.com/boards/12345/pulses/40004', contact:'eventos@vivo.com.br',    since:'2025-11-08', rotation:8 },
  { id:'D05', label:'D-05', exhibitor:'Stone Co.',     area:'conf',   status:'occupied',    category:'Gold Sponsor',      x:256, y:408, w:136, h:98, sqm:18, executive:'Renato Aguiar',   mondayUrl:'https://monday.com/boards/12345/pulses/40005', contact:'eventos@stone.com.br',   since:'2025-12-18' },
  { id:'D06', label:'D-06', exhibitor:'PicPay',        area:'conf',   status:'occupied',    category:'Gold Sponsor',      x:404, y:408, w:136, h:98, sqm:18, executive:'Juliana Neves',   mondayUrl:'https://monday.com/boards/12345/pulses/40006', contact:'press@picpay.com',        since:'2026-01-22', rotation:-7 },
  { id:'D07', label:'D-07',                            area:'conf',   status:'available',   category:'Diamond Sponsor',   x:552, y:408, w:136, h:98, sqm:18 },
  { id:'D08', label:'D-08', exhibitor:'Banco Inter',   area:'conf',   status:'reserved',    category:'Gold Sponsor',      x:700, y:408, w:120, h:98, sqm:18, contact:'eventos@inter.com.br', since:'2026-02-05' },
]

const INIT_HISTORY: HistoryEntry[] = [
  { id:'h1',  boothId:'D01', boothLabel:'D-01', action:'Contrato assinado',  user:'Ana Lima',       timestamp:'2026-07-21 14:32', detail:'Embraer — upgrade Keynote' },
  { id:'h2',  boothId:'A04', boothLabel:'A-04', action:'Reserva confirmada', user:'Carlos Mota',    timestamp:'2026-07-21 13:15', detail:'AWS Brasil — pagamento aprovado' },
  { id:'h3',  boothId:'B09', boothLabel:'B-09', action:'Em manutenção',      user:'Sistema',        timestamp:'2026-07-21 12:00', detail:'Problema elétrico no setor B' },
  { id:'h4',  boothId:'C03', boothLabel:'C-03', action:'Estande liberado',   user:'Paula Reis',     timestamp:'2026-07-21 10:48', detail:'Contrato encerrado — disponível' },
  { id:'h5',  boothId:'B05', boothLabel:'B-05', action:'Proposta enviada',   user:'Renato Aguiar',  timestamp:'2026-07-20 17:22', detail:'XP Inc — aguardando aprovação' },
  { id:'h6',  boothId:'D07', boothLabel:'D-07', action:'Novo lead',          user:'Fernanda Costa', timestamp:'2026-07-20 16:05', detail:'Interesse de empresa a definir' },
  { id:'h7',  boothId:'A10', boothLabel:'A-10', action:'Em manutenção',      user:'Sistema',        timestamp:'2026-07-20 09:30', detail:'Piso danificado — reparo agendado' },
  { id:'h8',  boothId:'B04', boothLabel:'B-04', action:'Estande liberado',   user:'Paula Reis',     timestamp:'2026-07-19 15:10', detail:'Cancelamento — disponível' },
  { id:'h9',  boothId:'D03', boothLabel:'D-03', action:'Reserva confirmada', user:'Carlos Mota',    timestamp:'2026-07-18 11:00', detail:'Localiza — sinal pago' },
  { id:'h10', boothId:'C04', boothLabel:'C-04', action:'Proposta enviada',   user:'Renato Aguiar',  timestamp:'2026-07-17 14:45', detail:'Nestlé BR — em negociação' },
]

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusBadge({ status, small }: { status: Status; small?: boolean }) {
  const { st } = useApp()
  const cfg = st[status]
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: small ? 10 : 11, padding: small ? '2px 6px' : '3px 8px',
      borderRadius: 3, letterSpacing:'0.04em', fontWeight:500,
      border: `1px solid ${cfg.color}30`, display:'inline-flex', alignItems:'center', gap:4,
      fontFamily:'JetBrains Mono,monospace',
    }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:cfg.color, flexShrink:0 }} />
      {cfg.label}
    </span>
  )
}

function AreaBadge({ areaId }: { areaId: string }) {
  const a = AREA_MAP[areaId]
  if (!a) return null
  return (
    <span style={{
      background: a.dim, color: a.accent, fontSize:10, padding:'3px 8px',
      borderRadius:3, letterSpacing:'0.04em', fontWeight:500,
      border:`1px solid ${a.accent}30`, fontFamily:'JetBrains Mono,monospace',
    }}>
      {a.name}
    </span>
  )
}

// ─── Map ──────────────────────────────────────────────────────────────────────

interface FloorPlan { url: string; opacity: number }

function MapView({ selectedId, filterArea, onSelect, floorPlan }: {
  selectedId: string | null; filterArea: string | null
  onSelect: (b: Booth) => void; floorPlan: FloorPlan
}) {
  const { scheme, st } = useApp()
  const svgRef = useRef<SVGSVGElement>(null)
  const [tf, setTf] = useState({ x:0, y:0, scale:1 })
  const dragging = useRef(false)
  const dragStart = useRef({ mx:0, my:0, tx:0, ty:0 })

  const clamp = useCallback((n: { x:number; y:number; scale:number }) =>
    ({ ...n, scale: Math.max(0.45, Math.min(3.5, n.scale)) }), [])

  const handleWheel = useCallback((e: RWheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const rect = svgRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    const d = e.deltaY > 0 ? 0.88 : 1.14
    setTf(prev => {
      const scale = Math.max(0.45, Math.min(3.5, prev.scale * d))
      const r = scale / prev.scale
      return { scale, x: cx - r * (cx - prev.x), y: cy - r * (cy - prev.y) }
    })
  }, [])

  const handleMouseDown = useCallback((e: RMouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-booth]')) return
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, tx: tf.x, ty: tf.y }
  }, [tf])

  const handleMouseMove = useCallback((e: RMouseEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    setTf(p => ({ ...p, x: dragStart.current.tx + e.clientX - dragStart.current.mx, y: dragStart.current.ty + e.clientY - dragStart.current.my }))
  }, [])

  const stop = useCallback(() => { dragging.current = false }, [])

  const dimmed = filterArea ? new Set(BOOTHS.filter(b => b.area !== filterArea).map(b => b.id)) : new Set<string>()

  return (
    <div style={{ flex:1, position:'relative', overflow:'hidden', background: scheme.bg }}>
      {/* dot grid */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:.12 }}>
        <defs>
          <pattern id="sg" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0L0 0 0 20" fill="none" stroke="#3878f0" strokeWidth=".3"/>
          </pattern>
          <pattern id="lg" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#sg)"/>
            <path d="M100 0L0 0 0 100" fill="none" stroke="#3878f0" strokeWidth=".7"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lg)"/>
      </svg>

      {/* zoom controls */}
      <div style={{ position:'absolute', top:12, right:12, zIndex:10, display:'flex', flexDirection:'column', gap:4 }}>
        {[{ label:'+', action:() => setTf(p => clamp({...p, scale: p.scale*1.25})) },
          { label:'−', action:() => setTf(p => clamp({...p, scale: p.scale*0.8})) },
          { label:'⊙', action:() => setTf({x:0,y:0,scale:1}) }].map(btn => (
          <button key={btn.label} onClick={btn.action} style={{
            width:28, height:28, background: scheme.surface, border:`1px solid ${scheme.border}`,
            borderRadius:4, color: scheme.text, fontSize:btn.label==='⊙'?12:18, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>{btn.label}</button>
        ))}
      </div>

      {/* scale */}
      <div style={{ position:'absolute', bottom:10, right:12, fontFamily:'JetBrains Mono,monospace', fontSize:10, color: scheme.muted }}>
        {Math.round(tf.scale*100)}%
      </div>

      <svg
        ref={svgRef}
        style={{ width:'100%', height:'100%', cursor: dragging.current ? 'grabbing' : 'grab', userSelect:'none', display:'block' }}
        viewBox="0 0 900 540"
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stop}
        onMouseLeave={stop}
        onDoubleClick={() => setTf({x:0,y:0,scale:1})}
      >
        <g transform={`translate(${tf.x},${tf.y}) scale(${tf.scale})`}>
          {/* floor plan image */}
          {floorPlan.url && (
            <image href={floorPlan.url} x={0} y={0} width={900} height={540}
              opacity={floorPlan.opacity} preserveAspectRatio="xMidYMid slice"
              style={{ pointerEvents:'none' }} />
          )}

          {/* area zones */}
          {AREAS.map(area => (
            <g key={area.id} opacity={filterArea && filterArea !== area.id ? 0.2 : 1}
               style={{ transition:'opacity .2s' }}>
              <rect x={area.x} y={area.y} width={area.w} height={area.h}
                fill={area.dim} fillOpacity={.35} rx={4}
                stroke={area.accent} strokeWidth={.8} strokeOpacity={.4} />
              <text x={area.x + area.w/2} y={area.y + 15} textAnchor="middle"
                fill={area.accent} fontSize={8.5} letterSpacing=".12em"
                fontFamily="JetBrains Mono,monospace" fontWeight="500">
                {area.name.toUpperCase()}
              </text>
            </g>
          ))}

          {/* aisle labels */}
          <text x={450} y={152} textAnchor="middle" fill="#2a3a50" fontSize={7.5}
            fontFamily="JetBrains Mono,monospace" letterSpacing=".1em">CORREDOR CENTRAL</text>
          <line x1={80} y1={152} x2={330} y2={152} stroke="#1e2a38" strokeWidth={.4}/>
          <line x1={570} y1={152} x2={820} y2={152} stroke="#1e2a38" strokeWidth={.4}/>
          <text x={130} y={270} textAnchor="middle" fill="#2a3a50" fontSize={7}
            fontFamily="JetBrains Mono,monospace" letterSpacing=".1em">ACESSO</text>

          {/* booths */}
          {BOOTHS.map(booth => {
            const cfg = st[booth.status]
            const area = AREA_MAP[booth.area]
            const isSelected = booth.id === selectedId
            const isDimmed = dimmed.has(booth.id)
            const cx = booth.x + booth.w / 2, cy = booth.y + booth.h / 2
            const rot = booth.rotation ?? 0

            return (
              <g key={booth.id}
                transform={`rotate(${rot},${cx},${cy})`}
                data-booth={booth.id}
                style={{ opacity: isDimmed ? .2 : 1, transition:'opacity .25s', cursor:'pointer' }}
                onClick={() => onSelect(booth)}
              >
                {/* selection halo */}
                {isSelected && (
                  <rect x={booth.x-3} y={booth.y-3} width={booth.w+6} height={booth.h+6}
                    fill="none" rx={4} stroke={cfg.color} strokeWidth={.7}
                    strokeOpacity={.5} strokeDasharray="4 3" />
                )}
                {/* body */}
                <rect x={booth.x} y={booth.y} width={booth.w} height={booth.h}
                  fill={isSelected ? cfg.color+'20' : '#0e1117'} rx={2}
                  stroke={isSelected ? cfg.color : cfg.color+'55'}
                  strokeWidth={isSelected ? 1.5 : .8} />
                {/* status stripe */}
                <rect x={booth.x} y={booth.y} width={booth.w} height={3}
                  fill={cfg.color} rx={1} opacity={.88} />
                {/* label */}
                <text x={cx} y={booth.y+16} textAnchor="middle"
                  fill="#c8d5e2" fontSize={7.5} fontWeight="500" letterSpacing=".06em"
                  fontFamily="JetBrains Mono,monospace">
                  {booth.label}
                </text>
                {/* exhibitor */}
                {booth.exhibitor && (
                  <text x={cx} y={booth.y+28} textAnchor="middle"
                    fill={area.accent} fontSize={5.8} fontWeight="500"
                    fontFamily="DM Sans,sans-serif" style={{ pointerEvents:'none' }}>
                    {booth.exhibitor.length > 11 ? booth.exhibitor.slice(0,10)+'…' : booth.exhibitor}
                  </text>
                )}
                {/* sqm */}
                {booth.sqm && (
                  <text x={cx} y={booth.y+booth.h-7} textAnchor="middle"
                    fill="#3a5060" fontSize={5.5} fontFamily="JetBrains Mono,monospace">
                    {booth.sqm}m²
                  </text>
                )}
                {/* rotation indicator */}
                {rot !== 0 && (
                  <text x={booth.x+booth.w-6} y={booth.y+booth.h-5}
                    fill="#3a5060" fontSize={5} fontFamily="JetBrains Mono,monospace" textAnchor="end">
                    {rot > 0 ? '+' : ''}{rot}°
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* legend */}
      <div style={{
        position:'absolute', bottom:10, left:10,
        background: scheme.surface+'dd', border:`1px solid ${scheme.border}`,
        borderRadius:4, padding:'5px 12px', backdropFilter:'blur(8px)',
        display:'flex', alignItems:'center', gap:12,
      }}>
        {(Object.entries(st) as [Status, StatusCfg][]).map(([k, v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color: scheme.muted }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:v.color }} />
            {v.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── List Panel ───────────────────────────────────────────────────────────────

function ListPanel({ open, selectedId, filterArea, onSelect, onClose }: {
  open: boolean; selectedId: string | null; filterArea: string | null
  onSelect: (b: Booth) => void; onClose: () => void
}) {
  const { scheme, st } = useApp()
  const [q, setQ] = useState('')
  const [sf, setSf] = useState<Status | 'all'>('all')

  const list = BOOTHS.filter(b => {
    if (filterArea && b.area !== filterArea) return false
    if (sf !== 'all' && b.status !== sf) return false
    const lq = q.toLowerCase()
    return !lq || b.label.toLowerCase().includes(lq) ||
      (b.exhibitor?.toLowerCase().includes(lq) ?? false) ||
      (b.category?.toLowerCase().includes(lq) ?? false)
  })

  const counts = useMemo(() => ({
    occupied: BOOTHS.filter(b=>b.status==='occupied').length,
    reserved: BOOTHS.filter(b=>b.status==='reserved').length,
    available: BOOTHS.filter(b=>b.status==='available').length,
    maintenance: BOOTHS.filter(b=>b.status==='maintenance').length,
  }), [])

  return (
    <div style={{
      width: open ? 272 : 0, minWidth: open ? 272 : 0, flexShrink:0,
      transition:'width .3s cubic-bezier(.4,0,.2,1),min-width .3s cubic-bezier(.4,0,.2,1)',
      overflow:'hidden', background: scheme.surface, borderRight:`1px solid ${scheme.border}`,
      display:'flex', flexDirection:'column',
    }}>
      <div style={{ width:272, display:'flex', flexDirection:'column', height:'100%' }}>
        <div style={{ padding:'14px 14px 10px', borderBottom:`1px solid ${scheme.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:scheme.muted, letterSpacing:'.1em', textTransform:'uppercase' }}>
              Estandes · {list.length}
            </span>
            <button onClick={onClose} style={{ background:'none', border:'none', color:scheme.muted, cursor:'pointer', fontSize:16, lineHeight:1, padding:2 }}>×</button>
          </div>
          <div style={{ position:'relative', marginBottom:8 }}>
            <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:scheme.muted, fontSize:13 }}>⌕</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar…"
              style={{ width:'100%', background:scheme.surface2, border:`1px solid ${scheme.border}`, borderRadius:3,
                color:scheme.text, fontSize:12, padding:'6px 8px 6px 26px', fontFamily:'DM Sans,sans-serif', outline:'none' }} />
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {[['all','Todos', BOOTHS.length, scheme.muted] as const,
              ['occupied','Ocup.', counts.occupied, st.occupied.color] as const,
              ['reserved','Res.', counts.reserved, st.reserved.color] as const,
              ['available','Disp.', counts.available, st.available.color] as const,
            ].map(([k,lbl,cnt,clr]) => (
              <button key={k} onClick={()=>setSf(k as Status|'all')} style={{
                background: sf===k ? clr+'22' : 'transparent',
                border:`1px solid ${sf===k ? clr : scheme.border}`,
                color: sf===k ? clr : scheme.muted,
                borderRadius:3, fontSize:10, padding:'3px 7px', cursor:'pointer',
                fontFamily:'JetBrains Mono,monospace', letterSpacing:'.04em', fontWeight:500, whiteSpace:'nowrap',
              }}>{lbl} <span style={{opacity:.7}}>{cnt}</span></button>
            ))}
          </div>
        </div>

        <div style={{ overflowY:'auto', flex:1 }}>
          {list.length === 0
            ? <div style={{ padding:24, textAlign:'center', color:scheme.muted, fontSize:12 }}>Sem resultados</div>
            : list.map(booth => {
              const cfg = st[booth.status]
              const area = AREA_MAP[booth.area]
              const isSel = booth.id === selectedId
              return (
                <button key={booth.id} onClick={()=>onSelect(booth)} style={{
                  width:'100%', textAlign:'left', background: isSel ? scheme.surface2 : 'transparent',
                  border:'none', borderBottom:`1px solid ${scheme.border}44`,
                  borderLeft:`2px solid ${isSel ? cfg.color : 'transparent'}`,
                  padding:'9px 14px', cursor:'pointer', display:'block', transition:'background .12s',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:scheme.text, fontWeight:500 }}>
                      {booth.label}
                    </span>
                    <StatusBadge status={booth.status} small />
                  </div>
                  <div style={{ fontSize:12, color: booth.exhibitor ? area.accent : scheme.muted, fontWeight:500, marginBottom:1 }}>
                    {booth.exhibitor ?? '— vago —'}
                  </div>
                  {booth.category && <div style={{ fontSize:10, color:scheme.muted }}>{booth.category}</div>}
                </button>
              )
            })
          }
        </div>
      </div>
    </div>
  )
}

// ─── Booth Detail ─────────────────────────────────────────────────────────────

function BoothDetail({ booth, onClose, onLog }: {
  booth: Booth; onClose: () => void; onLog: (e: HistoryEntry) => void
}) {
  const { scheme, st } = useApp()
  const area = AREA_MAP[booth.area]
  const cfg = st[booth.status]

  const changeStatus = (s: Status) => {
    onLog({
      id: `h${Date.now()}`, boothId: booth.id, boothLabel: booth.label,
      action:'Status alterado', user:'Operador',
      timestamp: new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}).replace(',',''),
      detail:`${st[booth.status].label} → ${st[s].label}`,
    })
  }

  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0, zIndex:20,
      background: scheme.surface, borderTop:`1px solid ${scheme.border}`,
      padding:'14px 18px', animation:'slideUp .2s ease-out',
    }}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:20, fontWeight:600, color:scheme.text, letterSpacing:'.04em' }}>
              {booth.label}
            </span>
            <StatusBadge status={booth.status} />
            <AreaBadge areaId={booth.area} />
            {booth.rotation != null && booth.rotation !== 0 && (
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:scheme.muted, background:scheme.surface2, padding:'2px 6px', borderRadius:3, border:`1px solid ${scheme.border}` }}>
                {booth.rotation > 0 ? '+' : ''}{booth.rotation}°
              </span>
            )}
          </div>
          <div style={{ fontSize:14, color: area.accent, fontWeight:600 }}>
            {booth.exhibitor ?? 'Estande disponível'}
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:scheme.muted, cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:20, marginBottom:12 }}>
        {booth.category && <Field label="Categoria" value={booth.category} scheme={scheme} />}
        {booth.sqm && <Field label="Área" value={`${booth.sqm} m²`} scheme={scheme} />}
        {booth.since && <Field label="Desde" value={booth.since} scheme={scheme} />}
        {booth.contact && <Field label="Contato" value={booth.contact} scheme={scheme} accent />}
      </div>

      {/* Executive + Monday link — only for occupied booths */}
      {booth.status === 'occupied' && (booth.executive || booth.mondayUrl) && (
        <div style={{
          display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
          padding:'8px 12px', background: scheme.surface2,
          borderRadius:4, border:`1px solid ${scheme.border}`, marginBottom:10,
        }}>
          {booth.executive && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{
                width:28, height:28, borderRadius:'50%', background: cfg.color+'22',
                border:`1px solid ${cfg.color}44`, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, color: cfg.color, fontWeight:700,
              }}>
                {booth.executive.split(' ').map(p=>p[0]).slice(0,2).join('')}
              </span>
              <div>
                <div style={{ fontSize:9, color:scheme.muted, fontFamily:'JetBrains Mono,monospace', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:1 }}>Executivo Responsável</div>
                <div style={{ fontSize:12, color:scheme.text, fontWeight:600 }}>{booth.executive}</div>
              </div>
            </div>
          )}
          {booth.executive && booth.mondayUrl && (
            <div style={{ width:1, height:28, background: scheme.border }} />
          )}
          {booth.mondayUrl && (
            <a href={booth.mondayUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
                background:'#6161ff22', border:'1px solid #6161ff55',
                borderRadius:4, color:'#8888ff', fontSize:11, fontWeight:600,
                textDecoration:'none', fontFamily:'DM Sans,sans-serif',
                transition:'background .15s',
              }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#6161ff33'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#6161ff22'}}
            >
              <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" fill="#6161ff"/>
                <path d="M10 28 L20 12 L30 28" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              Ver no Monday
            </a>
          )}
        </div>
      )}

      {/* Status change actions */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {(['available','occupied','reserved','maintenance'] as Status[]).map(s =>
          s !== booth.status && (
            <button key={s} onClick={()=>changeStatus(s)} style={{
              background: st[s].bg, border:`1px solid ${st[s].color}44`,
              color: st[s].color, borderRadius:3, fontSize:10, padding:'4px 10px',
              cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontWeight:500,
            }}>→ {st[s].label}</button>
          )
        )}
      </div>
    </div>
  )
}

function Field({ label, value, scheme, accent }: { label:string; value:string; scheme:ColorScheme; accent?:boolean }) {
  return (
    <div>
      <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:scheme.muted, marginBottom:2, fontFamily:'JetBrains Mono,monospace' }}>{label}</div>
      <div style={{ fontSize:12, color: accent ? '#e8a020' : scheme.text, fontWeight:500 }}>{value}</div>
    </div>
  )
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({ open, history, onClose, onBoothSelect }: {
  open: boolean; history: HistoryEntry[]; onClose: () => void; onBoothSelect: (id:string)=>void
}) {
  const { scheme } = useApp()

  return (
    <div style={{
      width: open ? 296 : 0, minWidth: open ? 296 : 0, flexShrink:0,
      transition:'width .3s cubic-bezier(.4,0,.2,1),min-width .3s cubic-bezier(.4,0,.2,1)',
      overflow:'hidden', background: scheme.surface, borderLeft:`1px solid ${scheme.border}`,
      display:'flex', flexDirection:'column',
    }}>
      <div style={{ width:296, display:'flex', flexDirection:'column', height:'100%' }}>
        <div style={{ padding:'14px 14px 10px', borderBottom:`1px solid ${scheme.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:scheme.muted, letterSpacing:'.1em', textTransform:'uppercase' }}>Histórico</div>
            <div style={{ fontSize:12, color:scheme.text, marginTop:2 }}>{history.length} eventos</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:scheme.muted, cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>
        </div>

        <div style={{ overflowY:'auto', flex:1 }}>
          {history.map(entry => {
            const booth = BOOTHS.find(b => b.id === entry.boothId)
            const area = booth ? AREA_MAP[booth.area] : null
            return (
              <button key={entry.id} onClick={()=>onBoothSelect(entry.boothId)}
                style={{
                  width:'100%', textAlign:'left', background:'transparent', border:'none',
                  borderBottom:`1px solid ${scheme.border}44`, padding:'11px 14px', cursor:'pointer', display:'block',
                }}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=scheme.surface2}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent'}}
              >
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:3 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{
                      fontFamily:'JetBrains Mono,monospace', fontSize:10, padding:'2px 5px', borderRadius:2,
                      background: area?.dim ?? scheme.surface2, color: area?.accent ?? scheme.muted,
                      border:`1px solid ${area?.accent ?? scheme.border}30`, fontWeight:500,
                    }}>{entry.boothLabel}</span>
                    <span style={{ fontSize:11, color:scheme.text, fontWeight:500 }}>{entry.action}</span>
                  </div>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:scheme.muted, flexShrink:0 }}>
                    {entry.timestamp.split(' ')[1]}
                  </span>
                </div>
                {entry.detail && <div style={{ fontSize:11, color:scheme.muted, marginBottom:2 }}>{entry.detail}</div>}
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:10, color:scheme.border }}>{entry.user}</span>
                  <span style={{ fontSize:10, color:scheme.border }}>{entry.timestamp.split(' ')[0]}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Area Tab Bar ─────────────────────────────────────────────────────────────

function AreaTabs({ filter, onChange }: { filter: string|null; onChange: (id:string|null)=>void }) {
  const { scheme } = useApp()
  const counts = Object.fromEntries(AREAS.map(a => [a.id, BOOTHS.filter(b=>b.area===a.id).length]))

  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, padding:'0 14px', height:38,
      borderBottom:`1px solid ${scheme.border}`, background:scheme.surface, flexShrink:0, overflowX:'auto' }}>
      <TabBtn label="TODAS" count={BOOTHS.length} active={filter===null} onClick={()=>onChange(null)} color={scheme.muted} scheme={scheme} />
      {AREAS.map(a => (
        <TabBtn key={a.id} label={a.name.toUpperCase()} count={counts[a.id]}
          active={filter===a.id} onClick={()=>onChange(a.id)} color={a.accent} dim={a.dim} scheme={scheme} />
      ))}
    </div>
  )
}

function TabBtn({ label, count, active, onClick, color, dim, scheme }: {
  label:string; count:number; active:boolean; onClick:()=>void
  color:string; dim?:string; scheme:ColorScheme
}) {
  return (
    <button onClick={onClick} style={{
      background: active ? (dim ?? color+'22') : 'transparent',
      border:`1px solid ${active ? color+'66' : 'transparent'}`,
      color: active ? color : scheme.muted,
      borderRadius:3, fontSize:9.5, padding:'3px 9px', cursor:'pointer',
      fontFamily:'JetBrains Mono,monospace', letterSpacing:'.06em', fontWeight:500, whiteSpace:'nowrap',
    }}>
      {label} <span style={{opacity:.6}}>{count}</span>
    </button>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const { scheme, st } = useApp()
  const total = BOOTHS.length
  const occ = BOOTHS.filter(b=>b.status==='occupied').length
  const res = BOOTHS.filter(b=>b.status==='reserved').length
  const avail = BOOTHS.filter(b=>b.status==='available').length
  const pct = Math.round(occ/total*100)

  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, padding:'0 18px', height:34,
      borderBottom:`1px solid ${scheme.border}`, background:scheme.bg, flexShrink:0 }}>
      <Stat label="Total" value={total} scheme={scheme} />
      <div style={{ width:1, height:14, background:scheme.border }} />
      <Stat label="Ocupados" value={occ} color={st.occupied.color} scheme={scheme} />
      <Stat label="Reservados" value={res} color={st.reserved.color} scheme={scheme} />
      <Stat label="Disponíveis" value={avail} color={st.available.color} scheme={scheme} />
      <div style={{ flex:1 }}/>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9.5, color:scheme.muted, letterSpacing:'.06em' }}>OCUPAÇÃO</div>
        <div style={{ width:72, height:3, background:scheme.surface2, borderRadius:2, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:scheme.accent, borderRadius:2, transition:'width .4s' }}/>
        </div>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:scheme.accent, fontWeight:600 }}>{pct}%</div>
      </div>
    </div>
  )
}

function Stat({ label, value, color, scheme }: { label:string; value:number; color?:string; scheme:ColorScheme }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700, color: color ?? scheme.text }}>{value}</span>
      <span style={{ fontSize:9.5, color:scheme.muted, letterSpacing:'.03em' }}>{label}</span>
    </div>
  )
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ scheme, presetKey, onPreset, onColor, floorPlan, onFloorPlan, onClose }: {
  scheme: ColorScheme; presetKey: string
  onPreset: (k:string) => void
  onColor: (key: keyof ColorScheme, val: string) => void
  floorPlan: FloorPlan
  onFloorPlan: (fp: FloorPlan) => void
  onClose: () => void
}) {
  const [fp, setFp] = useState(floorPlan)

  const applyFp = () => onFloorPlan(fp)

  const colorFields: { key: keyof ColorScheme; label: string; group?: string }[] = [
    { key:'bg',          label:'Fundo principal',     group:'Superfícies' },
    { key:'surface',     label:'Painéis / barras' },
    { key:'surface2',    label:'Hover / seleção' },
    { key:'border',      label:'Bordas' },
    { key:'text',        label:'Texto principal',      group:'Tipografia' },
    { key:'muted',       label:'Texto secundário' },
    { key:'accent',      label:'Destaque (acento)',    group:'Cores de ação' },
    { key:'occupied',    label:'Ocupado',              group:'Status' },
    { key:'reserved',    label:'Reservado' },
    { key:'available',   label:'Disponível' },
    { key:'maintenance', label:'Manutenção' },
  ]

  let lastGroup = ''

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background:'#00000088', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }} onClick={e=>e.target===e.currentTarget && onClose()}>
      <div style={{
        background: scheme.surface, border:`1px solid ${scheme.border}`,
        borderRadius:8, width:520, maxHeight:'88vh', overflow:'hidden',
        display:'flex', flexDirection:'column', boxShadow:'0 24px 64px #000a',
      }}>
        {/* header */}
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${scheme.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:scheme.text }}>Configurações</div>
            <div style={{ fontSize:11, color:scheme.muted, marginTop:2 }}>Esquema de cores e planta baixa</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:scheme.muted, cursor:'pointer', fontSize:20, lineHeight:1, padding:4 }}>×</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'16px 20px' }}>
          {/* presets */}
          <div style={{ marginBottom:20 }}>
            <SectionLabel>Temas pré-definidos</SectionLabel>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {Object.entries(PRESETS).map(([k, p]) => (
                <button key={k} onClick={()=>onPreset(k)} style={{
                  padding:'6px 14px', borderRadius:4, cursor:'pointer', fontSize:12, fontWeight:500,
                  background: presetKey===k ? scheme.accent+'22' : scheme.surface2,
                  border:`1px solid ${presetKey===k ? scheme.accent : scheme.border}`,
                  color: presetKey===k ? scheme.accent : scheme.text,
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  <span style={{ display:'flex', gap:3 }}>
                    {[p.bg, p.accent, p.occupied, p.available].map((c,i) => (
                      <span key={i} style={{ width:10, height:10, borderRadius:2, background:c, border:'1px solid #fff2' }} />
                    ))}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* color pickers */}
          <div style={{ marginBottom:20 }}>
            <SectionLabel>Cores personalizadas</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {colorFields.map(f => {
                const showGroup = f.group && f.group !== lastGroup
                if (f.group) lastGroup = f.group
                return (
                  <div key={f.key}>
                    {showGroup && (
                      <div style={{ gridColumn:'1/-1', fontSize:9.5, fontFamily:'JetBrains Mono,monospace', color:scheme.muted, letterSpacing:'.1em', textTransform:'uppercase', margin:'8px 0 4px' }}>
                        {f.group}
                      </div>
                    )}
                    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'5px 8px', background:scheme.surface2, borderRadius:3, border:`1px solid ${scheme.border}`, cursor:'pointer' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span style={{ width:16, height:16, borderRadius:3, background:scheme[f.key] as string, border:`1px solid ${scheme.border}`, flexShrink:0 }} />
                        <span style={{ fontSize:11, color:scheme.text }}>{f.label}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9.5, color:scheme.muted }}>{(scheme[f.key] as string).toUpperCase()}</span>
                        <input type="color" value={scheme[f.key] as string}
                          onChange={e=>onColor(f.key, e.target.value)}
                          style={{ width:22, height:22, border:'none', borderRadius:2, background:'none', cursor:'pointer', padding:0 }} />
                      </div>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* floor plan */}
          <div>
            <SectionLabel>Planta Baixa do Pavilhão</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div>
                <div style={{ fontSize:10, color:scheme.muted, marginBottom:4 }}>URL da imagem</div>
                <div style={{ display:'flex', gap:6 }}>
                  <input value={fp.url} onChange={e=>setFp(p=>({...p,url:e.target.value}))}
                    placeholder="https://…"
                    style={{ flex:1, background:scheme.surface2, border:`1px solid ${scheme.border}`, borderRadius:3,
                      color:scheme.text, fontSize:12, padding:'7px 10px', fontFamily:'DM Sans,sans-serif', outline:'none' }} />
                  <button onClick={applyFp} style={{
                    background:scheme.accent+'22', border:`1px solid ${scheme.accent}66`,
                    color:scheme.accent, borderRadius:3, fontSize:11, padding:'0 14px', cursor:'pointer', fontWeight:600,
                  }}>Aplicar</button>
                </div>
                <div style={{ fontSize:10, color:scheme.muted, marginTop:4 }}>
                  Sugestão: <span style={{ color:scheme.accent+'cc', wordBreak:'break-all' }}>
                    https://images.unsplash.com/photo-1721244654346-9be0c0129e36?w=900&h=540&fit=crop&auto=format
                  </span>
                </div>
              </div>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:scheme.muted, marginBottom:4 }}>
                  <span>Opacidade da imagem</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace' }}>{Math.round(fp.opacity*100)}%</span>
                </div>
                <input type="range" min={0} max={100} value={Math.round(fp.opacity*100)}
                  onChange={e=>{ const v=Number(e.target.value)/100; setFp(p=>({...p,opacity:v})); onFloorPlan({...fp,opacity:v}) }}
                  style={{ width:'100%', accentColor:scheme.accent }} />
              </div>
              {fp.url && (
                <div style={{ borderRadius:4, overflow:'hidden', height:100, border:`1px solid ${scheme.border}` }}>
                  <img src={fp.url} alt="Planta baixa" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:fp.opacity }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { scheme } = useApp()
  return (
    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9.5, color:scheme.muted, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:8 }}>
      {children}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [presetKey, setPresetKey] = useState('dark')
  const [scheme, setScheme] = useState<ColorScheme>(PRESETS.dark)
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null)
  const [filterArea, setFilterArea] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(INIT_HISTORY)
  const [floorPlan, setFloorPlan] = useState<FloorPlan>({ url:'', opacity:0.15 })

  const st = useMemo(() => makeStatusConfig(scheme), [scheme])

  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--color-bg', scheme.bg)
    r.style.setProperty('--color-surface', scheme.surface)
    r.style.setProperty('--color-border', scheme.border)
    r.style.setProperty('--color-text', scheme.text)
    r.style.setProperty('--color-muted', scheme.muted)
    r.style.setProperty('--color-accent', scheme.accent)
    r.style.color = scheme.text
    r.style.background = scheme.bg
  }, [scheme])

  const ctx: AppCtxType = useMemo(() => ({ scheme, st }), [scheme, st])

  const handlePreset = (k: string) => {
    setPresetKey(k)
    setScheme(PRESETS[k])
  }

  const handleColor = (key: keyof ColorScheme, val: string) => {
    setPresetKey('custom')
    setScheme(p => ({ ...p, [key]: val }))
  }

  const handleSelect = useCallback((b: Booth) => {
    setSelectedBooth(p => p?.id === b.id ? null : b)
  }, [])

  const addHistory = useCallback((e: HistoryEntry) => {
    setHistory(p => [e, ...p])
  }, [])

  const hdrBtn = (active: boolean, accent?: string): React.CSSProperties => ({
    background: active ? ((accent ?? scheme.accent)+'22') : 'transparent',
    border: `1px solid ${active ? (accent ?? scheme.accent) : scheme.border}`,
    color: active ? (accent ?? scheme.accent) : scheme.muted,
    borderRadius:4, fontSize:11, padding:'5px 11px', cursor:'pointer',
    fontFamily:'JetBrains Mono,monospace', letterSpacing:'.06em', fontWeight:500,
    whiteSpace:'nowrap', transition:'all .15s',
  })

  return (
    <AppCtx.Provider value={ctx}>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', background:scheme.bg }}>

        {/* Header */}
        <header style={{ display:'flex', alignItems:'center', padding:'0 18px', height:50,
          background:scheme.surface, borderBottom:`1px solid ${scheme.border}`, flexShrink:0, gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginRight:6 }}>
            <div style={{ width:28, height:28, background:scheme.accent, borderRadius:4,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx=".5" fill={scheme.bg}/>
                <rect x="9" y="1" width="6" height="6" rx=".5" fill={scheme.bg} opacity=".6"/>
                <rect x="1" y="9" width="6" height="6" rx=".5" fill={scheme.bg} opacity=".6"/>
                <rect x="9" y="9" width="6" height="6" rx=".5" fill={scheme.bg}/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:600, color:scheme.text, letterSpacing:'.08em' }}>ESPACEMAP</div>
              <div style={{ fontSize:9.5, color:scheme.muted }}>v2.5</div>
            </div>
          </div>

          <div style={{ width:1, height:22, background:scheme.border }} />

          <div>
            <div style={{ fontSize:13, fontWeight:600, color:scheme.text }}>ExpoTech 2026</div>
            <div style={{ fontSize:9.5, color:scheme.muted }}>Expo Center Norte · São Paulo · 24–27 Jul</div>
          </div>

          <div style={{ flex:1 }} />

          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={()=>setListOpen(p=>!p)} style={hdrBtn(listOpen)}>☰ Lista</button>
            <button onClick={()=>setHistoryOpen(p=>!p)} style={hdrBtn(historyOpen, '#e8a020')}>
              ◷ Histórico
              {!historyOpen && (
                <span style={{ marginLeft:5, background:scheme.accent, color:scheme.bg,
                  borderRadius:10, fontSize:9, padding:'1px 5px', fontWeight:700 }}>{history.length}</span>
              )}
            </button>
            <button onClick={()=>setSettingsOpen(true)} style={hdrBtn(settingsOpen)}>⚙ Config.</button>
          </div>
        </header>

        <StatsBar />

        {/* Main */}
        <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>
          {/* List */}
          <ListPanel open={listOpen} selectedId={selectedBooth?.id ?? null}
            filterArea={filterArea} onSelect={handleSelect} onClose={()=>setListOpen(false)} />

          {/* Reopen list tab */}
          {!listOpen && (
            <button
              onClick={()=>setListOpen(true)}
              title="Abrir lista de estandes"
              style={{
                position:'absolute', left:0, top:'50%', transform:'translateY(-50%)',
                zIndex:30, background:scheme.surface, border:`1px solid ${scheme.border}`,
                borderLeft:'none', borderRadius:'0 6px 6px 0',
                color:scheme.muted, cursor:'pointer', padding:'14px 6px',
                display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                boxShadow:`2px 0 12px ${scheme.bg}88`,
                transition:'color .15s, background .15s',
              }}
              onMouseEnter={e=>{
                (e.currentTarget as HTMLButtonElement).style.color=scheme.text
                ;(e.currentTarget as HTMLButtonElement).style.background=scheme.surface2
              }}
              onMouseLeave={e=>{
                (e.currentTarget as HTMLButtonElement).style.color=scheme.muted
                ;(e.currentTarget as HTMLButtonElement).style.background=scheme.surface
              }}
            >
              <span style={{ fontSize:13 }}>☰</span>
              <span style={{
                fontFamily:'JetBrains Mono,monospace', fontSize:8.5, letterSpacing:'.1em',
                writingMode:'vertical-rl', textOrientation:'mixed', textTransform:'uppercase',
              }}>Lista</span>
            </button>
          )}

          {/* Center */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
            <AreaTabs filter={filterArea} onChange={setFilterArea} />
            <div style={{ flex:1, position:'relative', overflow:'hidden', display:'flex' }}>
              <MapView selectedId={selectedBooth?.id ?? null} filterArea={filterArea}
                onSelect={handleSelect} floorPlan={floorPlan} />
              {selectedBooth && (
                <BoothDetail booth={selectedBooth} onClose={()=>setSelectedBooth(null)} onLog={addHistory} />
              )}
            </div>
          </div>

          {/* History */}
          <HistoryPanel open={historyOpen} history={history} onClose={()=>setHistoryOpen(false)}
            onBoothSelect={id=>{ const b=BOOTHS.find(b=>b.id===id); if(b) setSelectedBooth(b) }} />
        </div>

        {/* Settings modal */}
        {settingsOpen && (
          <SettingsPanel
            scheme={scheme} presetKey={presetKey}
            onPreset={handlePreset} onColor={handleColor}
            floorPlan={floorPlan} onFloorPlan={setFloorPlan}
            onClose={()=>setSettingsOpen(false)}
          />
        )}
      </div>
    </AppCtx.Provider>
  )
}
