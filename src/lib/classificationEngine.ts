/**
 * Ágora Plus — Motor de Clasificación de Operaciones v3.0
 * HEURISTIC FALLBACK ENGINE — used only when field_ae (Áreas de práctica) doesn't resolve.
 * Primary classification is deterministic via Drupal's practice area checkboxes (see sync-drupal/route.ts).
 * 
 * 3 Familias: M&A, Emisiones, Financiamientos
 * 4 Fases: Determinística → Scoring → Roles → Fallback
 */

// ─── PHASE 1: Deterministic Evidence (High Confidence ≥90%) ────────────────
// Words/phrases that BY THEMSELVES identify the operation type with certainty.

const DETERMINISTIC: Record<string, string[]> = {
  'M&A': [
    'adquiere', 'adquirió', 'adquisición', 'adquisiciones',
    'compra de acciones', 'compra de activos', 'venta de activos',
    'takeover', 'opa', 'oferta pública de adquisición',
    'desinversión', 'privatización', 'privatiza',
    'joint venture', 'carve-out', 'carve out', 'spin-off', 'spin off',
    'leveraged buyout', 'lbo', 'management buyout', 'mbo',
    'fusión', 'fusiona', 'se fusionan', 'fusiones',
    'compró', 'participación accionaria', 'control accionario',
    'asset purchase', 'share purchase', 'secondary sale',
    'tender offer', 'escisión',
  ],
  'Emisiones': [
    'emisión de bonos', 'emite bonos', 'emitió bonos',
    'emisión de notas', 'emisión de deuda',
    'ipo', 'oferta pública inicial',
    'bookrunner', 'underwriter', 'trustee',
    'placement', 'colocación', 'colocó',
    'debenture', 'debentures',
    'commercial paper', 'papel comercial',
    'ckds', 'ckd', 'fibras', 'fibra',
    'certificados bursátiles', 'certificado bursátil',
    'titulización', 'titulizaciones', 'securitización',
    'notas senior', 'senior notes',
    'green bond', 'green bonds', 'bonos verdes', 'bono verde',
    'social bond', 'social bonds', 'bonos sociales',
    'blue bond', 'blue bonds',
    'bonos convertibles', 'convertible bond',
    'follow-on', 'follow on offering',
    'medium term notes',
    'abs', 'mbs',
  ],
  'Financiamientos': [
    'préstamo sindicado', 'syndicated loan',
    'project finance', 'financiamiento de proyecto',
    'bridge loan', 'préstamo puente',
    'credit facility', 'credit agreement',
    'revolving credit', 'línea de crédito revolvente',
    'refinanciamiento', 'refinanciación', 'refinancing', 'refinancia',
    'leasing', 'arrendamiento financiero',
    'factoring', 'factoraje',
    'venture debt', 'deuda de riesgo',
    'dip financing', 'exit financing',
    'mandated lead arranger', 'mla',
    'sustainability linked loan', 'préstamo sostenible',
    'green loan', 'préstamo verde',
    'trade finance', 'financiamiento comercial',
    'working capital facility',
  ],
}

// ─── PHASE 2: Heuristic Evidence with Weights ──────────────────────────────
// Words that INCREASE probability but need context. Each has a weight (1-3).

type WeightedKeyword = { word: string; weight: number }

const HEURISTIC: Record<string, WeightedKeyword[]> = {
  'M&A': [
    { word: 'compra', weight: 2 },
    { word: 'vende', weight: 2 },
    { word: 'venta', weight: 2 },
    { word: 'adquiere', weight: 3 },
    { word: 'participación', weight: 1 },
    { word: 'control', weight: 1 },
    { word: 'activo', weight: 1 },
    { word: 'subsidiaria', weight: 2 },
    { word: 'filial', weight: 2 },
    { word: 'holding', weight: 1 },
    { word: 'inversionista estratégico', weight: 2 },
    { word: 'target', weight: 2 },
    { word: 'comprador', weight: 3 },
    { word: 'vendedor', weight: 3 },
    { word: 'empresa objetivo', weight: 3 },
    { word: 'operación de compraventa', weight: 3 },
    { word: 'transferencia', weight: 1 },
    { word: 'accionista mayoritario', weight: 2 },
    { word: 'accionista minoritario', weight: 2 },
  ],
  'Emisiones': [
    { word: 'emisión', weight: 3 },
    { word: 'emite', weight: 3 },
    { word: 'emisiones', weight: 3 },
    { word: 'bonos', weight: 2 },
    { word: 'notas', weight: 1 },
    { word: 'cupón', weight: 2 },
    { word: 'vencimiento', weight: 1 },
    { word: 'bookbuilding', weight: 3 },
    { word: 'mercado de capitales', weight: 3 },
    { word: 'prospecto', weight: 2 },
    { word: 'valor nominal', weight: 2 },
    { word: 'emisor', weight: 3 },
    { word: 'issued', weight: 2 },
    { word: 'issuance', weight: 3 },
    { word: 'offering', weight: 2 },
    { word: 'bolsa', weight: 1 },
    { word: 'bursátil', weight: 2 },
    { word: 'listado', weight: 1 },
  ],
  'Financiamientos': [
    { word: 'financiamiento', weight: 3 },
    { word: 'préstamo', weight: 3 },
    { word: 'crédito', weight: 2 },
    { word: 'financia', weight: 2 },
    { word: 'línea de crédito', weight: 3 },
    { word: 'capital de trabajo', weight: 2 },
    { word: 'amortización', weight: 2 },
    { word: 'plazo', weight: 1 },
    { word: 'tasa', weight: 1 },
    { word: 'garantía', weight: 1 },
    { word: 'borrower', weight: 3 },
    { word: 'lender', weight: 3 },
    { word: 'loan', weight: 3 },
    { word: 'facility', weight: 2 },
    { word: 'deuda', weight: 1 },
    { word: 'acreedor', weight: 2 },
    { word: 'deudor', weight: 2 },
    { word: 'banco', weight: 1 },
  ],
}

// ─── PHASE 3: Role-based confirmation ──────────────────────────────────────
const ROLE_SIGNALS: Record<string, string[]> = {
  'M&A': ['comprador', 'target', 'vendedor', 'buyer', 'seller', 'acquirer'],
  'Emisiones': ['emisor', 'issuer', 'bookrunner', 'placement agent', 'trustee', 'underwriter', 'paying agent'],
  'Financiamientos': ['prestatario', 'prestamista', 'borrower', 'lender', 'agent', 'guarantor', 'garante'],

}

// ─── PHASE 0: Noise Filter (Taxonomía Editorial — Ángela Castillo v0.1) ────
// Content that is NOT a corporate transaction. If the article is primarily about
// these topics, it should be classified as "Operación General" (Review Required).
// Per spec: "Corporate News" and "Legal News" are NOT transactions.

const CORPORATE_NEWS_SIGNALS: string[] = [
  'nombramiento', 'nombrado', 'nombra como',
  'promoción', 'promovido', 'asciende',
  'lateral hiring', 'fichaje', 'incorpora como socio',
  'nueva oficina', 'abre oficina', 'inaugura oficina',
  'cambio de marca', 'rebranding',
  'resultados financieros', 'resultados trimestrales', 'informe anual',
  'alianza estratégica', 'alianza comercial', 'convenio',
  'premio', 'reconocimiento', 'ranking', 'certificación',
]

const LEGAL_NEWS_SIGNALS: string[] = [
  'litigio', 'demanda', 'arbitraje', 'sentencia', 'fallo judicial',
  'regulación', 'regulador', 'ley aprobada', 'reforma',
  'compliance', 'cumplimiento normativo',
  'entrevista', 'opinión', 'columna',
  'evento', 'congreso', 'conferencia', 'foro', 'seminario',
  'publicación', 'libro', 'guía jurídica',
]

function isNonTransactional(titleLower: string, fullText: string): boolean {
  // Count noise signals vs transaction signals
  let noiseScore = 0
  let transactionSignalFound = false

  for (const signal of [...CORPORATE_NEWS_SIGNALS, ...LEGAL_NEWS_SIGNALS]) {
    if (titleLower.includes(signal)) {
      noiseScore += 3 // Title match = strong signal
    } else if (fullText.includes(signal)) {
      noiseScore += 1
    }
  }

  // Check if ANY deterministic transaction keyword exists
  for (const keywords of Object.values(DETERMINISTIC)) {
    for (const kw of keywords) {
      if (fullText.includes(kw)) {
        transactionSignalFound = true
        break
      }
    }
    if (transactionSignalFound) break
  }

  // If noise is strong AND no deterministic transaction signal exists, it's non-transactional
  return noiseScore >= 3 && !transactionSignalFound
}

// ─── MAIN CLASSIFIER ───────────────────────────────────────────────────────

export type ClassificationResult = {
  type: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  phase: number
}

export function classifyOperationType(
  title: string,
  excerpt: string | null,
  companyRoles: string[]
): ClassificationResult {
  const titleLower = (title || '').toLowerCase()
  const excerptLower = (excerpt || '').toLowerCase()
  // Strip HTML tags from excerpt
  const cleanExcerpt = excerptLower.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
  const fullText = `${titleLower} ${cleanExcerpt}`

  // ── PHASE 0: Noise Filter (Ángela Castillo spec) ──
  // Detect Corporate News / Legal News that are NOT transactions
  if (isNonTransactional(titleLower, fullText)) {
    return { type: 'Operación General', confidence: 'LOW', phase: 0 }
  }

  // ── PHASE 1: Deterministic (title only first, then full text) ──
  for (const [type, keywords] of Object.entries(DETERMINISTIC)) {
    for (const kw of keywords) {
      if (titleLower.includes(kw)) {
        return { type, confidence: 'HIGH', phase: 1 }
      }
    }
  }

  // Deterministic on full text (title + excerpt)
  for (const [type, keywords] of Object.entries(DETERMINISTIC)) {
    for (const kw of keywords) {
      if (fullText.includes(kw)) {
        return { type, confidence: 'HIGH', phase: 1 }
      }
    }
  }

  // ── PHASE 2: Weighted Scoring ──
  const scores: Record<string, number> = { 'M&A': 0, 'Emisiones': 0, 'Financiamientos': 0 }

  for (const [type, keywords] of Object.entries(HEURISTIC)) {
    for (const { word, weight } of keywords) {
      // Title matches get 2x weight
      if (titleLower.includes(word)) {
        scores[type] += weight * 2
      } else if (fullText.includes(word)) {
        scores[type] += weight
      }
    }
  }

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [topType, topScore] = sortedScores[0]
  const [, secondScore] = sortedScores[1]

  if (topScore >= 3 && (topScore - secondScore) >= 2) {
    return { type: topType, confidence: 'MEDIUM', phase: 2 }
  }

  // ── PHASE 3: Role-based confirmation ──
  if (companyRoles.length > 0) {
    const rolesLower = companyRoles.map(r => r.toLowerCase())
    for (const [type, signals] of Object.entries(ROLE_SIGNALS)) {
      for (const signal of signals) {
        if (rolesLower.some(r => r.includes(signal))) {
          // If roles match AND there's some score, confirm
          if (scores[type] > 0) {
            return { type, confidence: 'MEDIUM', phase: 3 }
          }
          return { type, confidence: 'LOW', phase: 3 }
        }
      }
    }
  }

  // ── PHASE 4: Strict Fallback (Ángela Castillo: "evidencia suficiente") ──
  // Per spec: "invertirá USD 500M" is NOT sufficient evidence.
  // Only assign a type if there's meaningful evidence (score >= 3).
  // A weak score (2) is no longer enough — it goes to Operación General.
  if (topScore >= 3) {
    return { type: topType, confidence: 'LOW', phase: 4 }
  }

  return { type: 'Operación General', confidence: 'LOW', phase: 4 }
}

// ─── INDUSTRY CLASSIFIER (Weighted Scoring, no cascading if/else) ──────────

type IndustryCluster = { name: string; keywords: { word: string; weight: number }[] }

const INDUSTRY_CLUSTERS: IndustryCluster[] = [
  {
    name: 'Energía y recursos naturales',
    keywords: [
      { word: 'energía', weight: 3 }, { word: 'petróleo', weight: 3 }, { word: 'gas natural', weight: 3 },
      { word: 'solar', weight: 2 }, { word: 'eólica', weight: 2 }, { word: 'eléctric', weight: 2 },
      { word: 'renovable', weight: 2 }, { word: 'hidrocarburos', weight: 3 }, { word: 'gasoducto', weight: 3 },
      { word: 'refinería', weight: 3 }, { word: 'oleoducto', weight: 3 }, { word: 'petroquímic', weight: 3 },
      { word: 'ecopetrol', weight: 3 }, { word: 'pemex', weight: 3 }, { word: 'ypf', weight: 3 },
      { word: 'fotovoltaic', weight: 2 }, { word: 'generación eléctrica', weight: 3 },
    ],
  },
  {
    name: 'Minería',
    keywords: [
      { word: 'minería', weight: 3 }, { word: 'mina', weight: 2 }, { word: 'cobre', weight: 3 },
      { word: 'litio', weight: 3 }, { word: 'oro', weight: 2 }, { word: 'zinc', weight: 3 },
      { word: 'plata', weight: 2 }, { word: 'hierro', weight: 2 }, { word: 'mineral', weight: 2 },
      { word: 'codelco', weight: 3 }, { word: 'barrick', weight: 3 },
    ],
  },
  {
    name: 'Banca y Servicios Financieros',
    keywords: [
      { word: 'banco', weight: 1 }, { word: 'banca', weight: 3 }, { word: 'scotiabank', weight: 3 },
      { word: 'citigroup', weight: 3 }, { word: 'citibank', weight: 3 }, { word: 'bbva', weight: 3 },
      { word: 'santander', weight: 2 }, { word: 'itaú', weight: 3 }, { word: 'bradesco', weight: 3 },
      { word: 'bancolombia', weight: 3 }, { word: 'banorte', weight: 3 },
      { word: 'entidad financiera', weight: 3 }, { word: 'institución financiera', weight: 3 },
      { word: 'microfinanz', weight: 3 }, { word: 'fintech', weight: 2 },
    ],
  },
  {
    name: 'Seguros y reaseguros',
    keywords: [
      { word: 'seguro', weight: 2 }, { word: 'reaseguro', weight: 3 }, { word: 'asegurador', weight: 3 },
      { word: 'póliza', weight: 3 }, { word: 'siniestro', weight: 2 },
    ],
  },
  {
    name: 'Bienes Raíces',
    keywords: [
      { word: 'inmobiliari', weight: 3 }, { word: 'bienes raíces', weight: 3 }, { word: 'hotel', weight: 2 },
      { word: 'resort', weight: 2 }, { word: 'terreno', weight: 2 }, { word: 'real estate', weight: 3 },
      { word: 'hipoteca', weight: 2 }, { word: 'residencial', weight: 2 }, { word: 'comercial', weight: 1 },
      { word: 'centro comercial', weight: 3 }, { word: 'oficina', weight: 1 },
    ],
  },
  {
    name: 'Infraestructura',
    keywords: [
      { word: 'infraestructura', weight: 3 }, { word: 'construcción', weight: 2 }, { word: 'cemento', weight: 3 },
      { word: 'obras', weight: 1 }, { word: 'autopista', weight: 3 }, { word: 'carretera', weight: 2 },
      { word: 'puente', weight: 1 }, { word: 'concesión vial', weight: 3 }, { word: 'peaje', weight: 3 },
      { word: 'aeropuerto', weight: 3 }, { word: 'puerto', weight: 2 },
    ],
  },
  {
    name: 'Telecomunicaciones',
    keywords: [
      { word: 'telecomunicacion', weight: 3 }, { word: 'telefon', weight: 2 }, { word: 'internet', weight: 1 },
      { word: 'fibra óptica', weight: 3 }, { word: 'data center', weight: 3 }, { word: 'centro de datos', weight: 3 },
      { word: '5g', weight: 3 }, { word: 'torre de comunicaciones', weight: 3 },
      { word: 'claro', weight: 1 }, { word: 'tigo', weight: 2 }, { word: 'millicom', weight: 3 },
    ],
  },
  {
    name: 'Tecnología',
    keywords: [
      { word: 'tecnología', weight: 2 }, { word: 'software', weight: 3 }, { word: 'app', weight: 1 },
      { word: 'informática', weight: 2 }, { word: 'saas', weight: 3 }, { word: 'plataforma digital', weight: 3 },
      { word: 'inteligencia artificial', weight: 3 }, { word: 'cloud', weight: 2 }, { word: 'nube', weight: 1 },
      { word: 'ciberseguridad', weight: 3 }, { word: 'e-commerce', weight: 2 }, { word: 'marketplace', weight: 2 },
    ],
  },
  {
    name: 'Salud y Farmacéutica',
    keywords: [
      { word: 'salud', weight: 2 }, { word: 'hospital', weight: 3 }, { word: 'clínica', weight: 2 },
      { word: 'farmacéutic', weight: 3 }, { word: 'medicamento', weight: 3 }, { word: 'laboratorio', weight: 2 },
      { word: 'biotecnología', weight: 3 }, { word: 'dispositivo médico', weight: 3 },
      { word: 'healthtech', weight: 3 }, { word: 'vacuna', weight: 2 },
    ],
  },
  {
    name: 'Retail y Consumo',
    keywords: [
      { word: 'retail', weight: 3 }, { word: 'supermercado', weight: 3 }, { word: 'tienda', weight: 1 },
      { word: 'comercio', weight: 1 }, { word: 'consumo masivo', weight: 3 }, { word: 'cadena de', weight: 1 },
      { word: 'marca', weight: 1 }, { word: 'franquicia', weight: 3 },
    ],
  },
  {
    name: 'Alimentos y Bebidas',
    keywords: [
      { word: 'alimento', weight: 3 }, { word: 'bebida', weight: 3 }, { word: 'agrícola', weight: 2 },
      { word: 'agro', weight: 2 }, { word: 'pesca', weight: 2 }, { word: 'nutrición', weight: 2 },
      { word: 'cervecería', weight: 3 }, { word: 'embotellador', weight: 3 }, { word: 'lácteo', weight: 3 },
      { word: 'cárnic', weight: 3 }, { word: 'azúcar', weight: 2 }, { word: 'granos', weight: 2 },
    ],
  },
  {
    name: 'Transporte y logística',
    keywords: [
      { word: 'transporte', weight: 2 }, { word: 'logística', weight: 3 }, { word: 'aerolínea', weight: 3 },
      { word: 'aviación', weight: 3 }, { word: 'marítim', weight: 3 }, { word: 'naviera', weight: 3 },
      { word: 'ferrocarril', weight: 3 }, { word: 'freight', weight: 2 }, { word: 'shipping', weight: 2 },
      { word: 'last mile', weight: 2 },
    ],
  },
  {
    name: 'Educación',
    keywords: [
      { word: 'educación', weight: 3 }, { word: 'universidad', weight: 3 }, { word: 'colegio', weight: 2 },
      { word: 'escuela', weight: 2 }, { word: 'edtech', weight: 3 }, { word: 'capacitación', weight: 1 },
    ],
  },
  {
    name: 'Entretenimiento y Media',
    keywords: [
      { word: 'entretenimiento', weight: 3 }, { word: 'televisión', weight: 3 }, { word: 'cine', weight: 2 },
      { word: 'música', weight: 2 }, { word: 'deporte', weight: 2 }, { word: 'gaming', weight: 3 },
      { word: 'streaming', weight: 3 }, { word: 'contenido digital', weight: 2 }, { word: 'medio de comunicación', weight: 2 },
    ],
  },
  {
    name: 'Agua y Saneamiento',
    keywords: [
      { word: 'agua', weight: 2 }, { word: 'saneamiento', weight: 3 }, { word: 'acueducto', weight: 3 },
      { word: 'desalinización', weight: 3 }, { word: 'tratamiento de agua', weight: 3 },
    ],
  },
  {
    name: 'Manufactura e Industrial',
    keywords: [
      { word: 'manufactura', weight: 3 }, { word: 'industrial', weight: 2 }, { word: 'fábrica', weight: 2 },
      { word: 'planta', weight: 1 }, { word: 'automotriz', weight: 3 }, { word: 'autopart', weight: 3 },
      { word: 'siderúrgic', weight: 3 }, { word: 'acero', weight: 2 }, { word: 'textil', weight: 2 },
      { word: 'químic', weight: 2 }, { word: 'producción', weight: 1 },
    ],
  },
]

export function classifyIndustry(text: string): string | null {
  const t = text.toLowerCase().replace(/<[^>]*>/g, ' ')

  const scores: { name: string; score: number }[] = INDUSTRY_CLUSTERS.map(cluster => {
    let score = 0
    for (const { word, weight } of cluster.keywords) {
      if (t.includes(word)) {
        score += weight
      }
    }
    return { name: cluster.name, score }
  })

  scores.sort((a, b) => b.score - a.score)

  // Winner must have at least 3 points
  if (scores[0].score >= 3) {
    return scores[0].name
  }

  return null
}
