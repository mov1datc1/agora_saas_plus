import re

file_path = "src/app/dashboard/metrics/countries/CountriesClient.tsx"

with open(file_path, "r") as f:
    content = f.read()

# 1. Add imports
content = content.replace(
    "import { checkTrialRestrictions, checkCanDownload } from '../../actions'",
    "import { checkTrialRestrictions, checkCanDownload } from '../../actions'\nimport ProDateRangePicker from '@/components/ui/ProDateRangePicker'"
)

# 2. Add renderChipsArray inside component
chip_helper = """  // Render array tags as PRO chips instead of cluttered strings
  const renderChipsArray = (items: string[], isDark: boolean = false) => {
    if (!items || items.length === 0) {
      return <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-foreground/80'}`}>No especificadas</p>
    }
    
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {items.map((item, i) => (
          <span 
            key={i} 
            className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold leading-none border transition-colors ${
              isDark 
                ? 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:text-white' 
                : 'bg-brand/5 border-brand/20 text-brand hover:bg-brand/10'
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    )
  }
"""

content = content.replace(
    "export default function CountriesClient() {\n  const [tableData, setTableData] = useState<TableRow[]>([])",
    "export default function CountriesClient() {\n  const [transactions, setTransactions] = useState<any[]>([])\n" + chip_helper
)

# 3. Aggregation logic
old_data_logic = """  const { data: apiData, error, isLoading: isSwrLoading } = useSWR('/api/metrics/countries', fetcher)

  useEffect(() => {
    if (apiData) {
      setTableData(apiData)
    }
  }, [apiData])

  const totalVolume = tableData.reduce((acc, row) => acc + (row.monto || 0), 0)

  const filterOptions = ['Todas', 'M&A', 'Financiamientos', 'Emisiones']

  const filteredData = useMemo(() => {
    let result = tableData.filter(row => {
      const matchesType = filterType === 'Todas' || row.tiposOperacion.includes(filterType)
      const matchesSearch = row.pais.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesType && matchesSearch
    })

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === 'pais') {
          return sortConfig.direction === 'asc' 
            ? a.pais.localeCompare(b.pais) 
            : b.pais.localeCompare(a.pais)
        } else if (sortConfig.key === 'monto') {
          return sortConfig.direction === 'asc' ? a.monto - b.monto : b.monto - a.monto
        } else if (sortConfig.key === 'operaciones') {
          return sortConfig.direction === 'asc' ? a.operaciones - b.operaciones : b.operaciones - a.operaciones
        }
        return 0
      })
    }
    return result
  }, [tableData, filterType, searchQuery, sortConfig])"""

new_data_logic = """  const filterOptions = ['Todas', 'M&A', 'Financiamientos', 'Emisiones']

  const { data: apiData, error, isLoading: isSwrLoading } = useSWR('/api/metrics/countries', fetcher)

  useEffect(() => {
    if (apiData) {
      setTransactions(apiData)
      setIsLoading(false)
    }
  }, [apiData])

  // Filtrado base de transacciones (Tipo, Fecha) - no filtramos por pais aquí ya que la tabla muestra paises
  const baseFilteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = filterType === 'Todas' || tx.type === filterType
      
      let matchesDate = true
      if (dateRange.start || dateRange.end) {
        const txDateStr = tx.dateAnnounced || tx.dateClosed
        if (txDateStr) {
          const txDate = new Date(txDateStr).getTime()
          const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00').getTime() : 0
          const endDate = dateRange.end ? new Date(dateRange.end + 'T00:00:00').getTime() + 86399999 : Infinity
          matchesDate = txDate >= startDate && txDate <= endDate
        } else {
          matchesDate = false
        }
      }
      
      return matchesType && matchesDate
    })
  }, [transactions, filterType, dateRange])

  // Agrupar por país
  const aggregatedCountries = useMemo(() => {
    const countryMap: Record<string, any> = {}

    baseFilteredTransactions.forEach(tx => {
      if (!tx.country) return
      const countriesList = tx.country.split(',').map((c: string) => c.trim()).filter(Boolean)
      
      countriesList.forEach((cName: string) => {
        if (!countryMap[cName]) {
          countryMap[cName] = {
            id: cName,
            pais: cName,
            monto: 0,
            operaciones: 0,
            firmas: new Set<string>(),
            industrias: new Set<string>(),
            empresas: new Set<string>(),
            abogados: new Set<string>(),
            tiposOperacion: new Set<string>(),
          }
        }

        countryMap[cName].operaciones += 1
        if (tx.value) {
          countryMap[cName].monto += Number(tx.value)
        }
        if (tx.type) {
          countryMap[cName].tiposOperacion.add(tx.type)
        }
        if (tx.industry?.name) {
          countryMap[cName].industrias.add(tx.industry.name)
        }
        tx.companies?.forEach((c: any) => {
          if (c.company?.name) countryMap[cName].empresas.add(c.company.name)
        })
        tx.advisors?.forEach((a: any) => {
          if (a.firm?.name) countryMap[cName].firmas.add(a.firm.name)
        })
        tx.lawyers?.forEach((l: any) => {
          if (l.lawyer?.name) countryMap[cName].abogados.add(l.lawyer.name)
        })
      })
    })

    const tableData = Object.values(countryMap).map((c: any) => ({
      ...c,
      firmas: Array.from(c.firmas),
      industrias: Array.from(c.industrias),
      empresas: Array.from(c.empresas),
      abogados: Array.from(c.abogados),
      tiposOperacion: Array.from(c.tiposOperacion)
    }))

    return tableData
  }, [baseFilteredTransactions])

  const filteredData = useMemo(() => {
    let result = aggregatedCountries.filter(row => {
      const matchesSearch = row.pais.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === 'pais') {
          return sortConfig.direction === 'asc' 
            ? a.pais.localeCompare(b.pais) 
            : b.pais.localeCompare(a.pais)
        } else if (sortConfig.key === 'monto') {
          return sortConfig.direction === 'asc' ? a.monto - b.monto : b.monto - a.monto
        } else if (sortConfig.key === 'operaciones') {
          return sortConfig.direction === 'asc' ? a.operaciones - b.operaciones : b.operaciones - a.operaciones
        }
        return 0
      })
    } else {
      result.sort((a, b) => b.operaciones - a.operaciones)
    }
    return result
  }, [aggregatedCountries, searchQuery, sortConfig])
  
  const totalVolume = filteredData.reduce((acc, row) => acc + (row.monto || 0), 0)
"""

content = content.replace(old_data_logic, new_data_logic)

# Replace topCountriesList logic
content = content.replace(
    "const topCountriesList = useMemo(() => {\n    return [...tableData].sort((a, b) => b.operaciones - a.operaciones)\n  }, [tableData])",
    "const topCountriesList = useMemo(() => {\n    return [...filteredData].sort((a, b) => b.operaciones - a.operaciones)\n  }, [filteredData])"
)

# 4. Insert Header & ProDateRangePicker
header_ui = """  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-4 rounded-2xl shadow-sm border border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6 text-brand" />
            Métricas: Países
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Explora la actividad financiera y legal por región y país.</p>
        </div>
        <div className="flex items-center gap-3">
          <ProDateRangePicker 
            dateRange={dateRange}
            setDateRange={setDateRange}
          />
        </div>
      </div>

      <PaywallModal"""

content = content.replace("  return (\n    <>\n      <PaywallModal", header_ui)
content = content.replace("    </>\n  )\n}", "    </div>\n  )\n}")

# 5. Replace EntityDetailModal chips
modal_chips = """          sections={[
            {
              label: 'Top Firmas Asesoras',
              count: selectedRow.firmas.length,
              value: renderChipsArray(selectedRow.firmas, false)
            },
            {
              label: 'Sectores Activos',
              count: selectedRow.industrias.length,
              value: renderChipsArray(selectedRow.industrias, false)
            },
            {
              label: 'Empresas',
              count: selectedRow.empresas.length,
              value: renderChipsArray(selectedRow.empresas, false)
            },
            {
              label: 'Abogados Involucrados',
              count: selectedRow.abogados.length,
              value: renderChipsArray(selectedRow.abogados, false)
            }
          ]}"""
          
content = re.sub(r"sections=\{\[.*?\]\}", modal_chips, content, flags=re.DOTALL)

# 6. Map onClick & container ID
content = content.replace(
    """onMouseEnter={(e) => {""",
    """onClick={() => {
                        if (isActive && activeStats) {
                          setSearchQuery(activeStats.pais)
                          document.getElementById('countries-table-container')?.scrollIntoView({ behavior: 'smooth' })
                        }
                      }}
                      onMouseEnter={(e) => {"""
)
content = content.replace(
    """<div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[600px]">""",
    """<div id="countries-table-container" className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[600px]">"""
)

# 7. Replace Side Panel chips
side_panel_firmas_old = """{selectedRow.firmas.slice(0, 15).join(', ')}
                      {selectedRow.firmas.length > 15 && <span className="text-white/50 italic"> y {selectedRow.firmas.length - 15} más...</span>}
                      {selectedRow.firmas.length === 0 && 'No especificadas'}"""
content = content.replace(side_panel_firmas_old, "{renderChipsArray(selectedRow.firmas, true)}")

side_panel_industrias_old = """{selectedRow.industrias.slice(0, 15).join(', ')}
                      {selectedRow.industrias.length > 15 && <span className="text-white/50 italic"> y {selectedRow.industrias.length - 15} más...</span>}
                      {selectedRow.industrias.length === 0 && 'No especificadas'}"""
content = content.replace(side_panel_industrias_old, "{renderChipsArray(selectedRow.industrias, true)}")

side_panel_empresas_old = """{selectedRow.empresas.slice(0, 15).join(', ')}
                      {selectedRow.empresas.length > 15 && <span className="text-white/50 italic"> y {selectedRow.empresas.length - 15} más...</span>}
                      {selectedRow.empresas.length === 0 && 'No especificadas'}"""
content = content.replace(side_panel_empresas_old, "{renderChipsArray(selectedRow.empresas, true)}")

side_panel_abogados_old = """{selectedRow.abogados.slice(0, 15).join(', ')}
                      {selectedRow.abogados.length > 15 && <span className="text-white/50 italic"> y {selectedRow.abogados.length - 15} más...</span>}
                      {selectedRow.abogados.length === 0 && 'No especificados'}"""
content = content.replace(side_panel_abogados_old, "{renderChipsArray(selectedRow.abogados, true)}")

# Add pointer cursor on hover map
content = content.replace(
    """hover: { fill: isActive ? "#c94b40" : "#F53", outline: "none", transition: "all 0.3s" }""",
    """hover: { fill: isActive ? "#c94b40" : "#F53", outline: "none", cursor: isActive ? "pointer" : "default", transition: "all 0.3s" }"""
)

with open(file_path, "w") as f:
    f.write(content)

print("Done")
