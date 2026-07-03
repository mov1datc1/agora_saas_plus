import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, ArrowUp } from 'lucide-react'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import UnderConstruction from '@/components/layout/UnderConstruction'

export default async function LandingPage() {
  const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
  
  if (config?.maintenanceModeEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let isAdmin = false;
    
    if (user?.email) {
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
      if (dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPERADMIN') {
        isAdmin = true;
      }
    }
    
    if (!isAdmin) {
      return <UnderConstruction />;
    }
  }

  return (
    <div className="bg-white min-h-screen font-sans selection:bg-[#E05C50] selection:text-white scroll-smooth relative">
      {/* Navbar Simple */}
      <header className="absolute inset-x-0 top-0 z-50 bg-white">
        <nav className="flex items-center justify-between p-6 lg:px-8 max-w-7xl mx-auto" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="sr-only">Ágora</span>
              <Image 
                src="/logo.png" 
                alt="Ágora Logo" 
                width={160} 
                height={50} 
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>
          </div>
          <div className="hidden lg:flex lg:gap-x-8">
            <a href="#beneficios" className="text-sm font-bold leading-6 text-gray-700 hover:text-[#E05C50] transition-colors">Beneficios</a>
            <a href="#caracteristicas" className="text-sm font-bold leading-6 text-gray-700 hover:text-[#E05C50] transition-colors">Características</a>
            <a href="#metodologia" className="text-sm font-bold leading-6 text-gray-700 hover:text-[#E05C50] transition-colors">Metodología</a>
            <a href="#inversion" className="text-sm font-bold leading-6 text-gray-700 hover:text-[#E05C50] transition-colors">Inversión</a>
            <a href="#recursos" className="text-sm font-bold leading-6 text-gray-700 hover:text-[#E05C50] transition-colors">Recursos</a>
          </div>
          <div className="flex flex-1 justify-end items-center gap-x-4 md:gap-x-6">
            <Link
              href="#planes"
              className="rounded-full bg-[#E05C50] px-4 py-2 md:px-6 md:py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all"
            >
              Suscribirse ahora
            </Link>
          </div>
        </nav>
      </header>

      <main className="isolate pt-24" id="top">
        {/* Primera Sección: Hero Section */}
        <div className="relative bg-white overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pt-8 pb-12 sm:pb-16">
              <div className="max-w-2xl">
                <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] leading-[1.15] md:leading-[1.1] font-bold tracking-tight text-gray-900 text-balance">
                  Detecta <span className="text-[#E05C50]">oportunidades de negocio</span> antes de que el mercado las vea.
                </h1>
                <p className="mt-6 text-lg sm:text-xl md:text-[1.35rem] leading-relaxed md:leading-8 text-gray-900 font-medium text-pretty">
                  Más de <strong className="font-extrabold text-black">15.000 operaciones corporativas en América Latina</strong> analizadas para revelar patrones de inversión, expansión y consolidación.
                </p>
                <div className="mt-8 md:mt-10 flex items-center gap-x-6">
                  <Link
                    href="#planes"
                    className="rounded-full bg-[#E05C50] px-8 py-4 text-base font-bold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all flex items-center gap-2"
                  >
                    Explorar Ágora por 15 días <span className="ml-1 font-bold">›</span>
                  </Link>
                </div>
              </div>
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative w-full max-w-lg">
                  <Image
                    src="https://agora.lexlatin.com/wp-content/uploads/2026/03/MUJER-AGORA-818x1024.png"
                    alt="Mujer Ágora Analítica"
                    width={818}
                    height={1024}
                    className="w-full h-auto object-contain drop-shadow-2xl z-10 relative"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Segunda Sección: Problema */}
        <div className="bg-[#1C1F33] py-12 sm:py-16" id="beneficios">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-[#E05C50] leading-tight text-balance">
                  La mayoría de las firmas no pierde mandatos por <span className="font-extrabold">falta de talento.</span>
                </h2>
                <div className="mt-10">
                  <Link
                    href="#planes"
                    className="inline-flex rounded-full bg-[#E05C50] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all items-center gap-2"
                  >
                    Explorar Ágora por 15 días <span className="ml-1 font-bold">›</span>
                  </Link>
                </div>
              </div>
              <div>
                <ul className="space-y-4 text-lg text-gray-100 leading-relaxed list-disc pl-6 marker:text-white">
                  <li className="pl-2">En M&A el problema rara vez es técnico.</li>
                  <li className="pl-2">Las firmas con los mejores abogados también pierden oportunidades.</li>
                  <li className="pl-2">No porque hagan mal su trabajo.</li>
                  <li className="pl-2">Sino porque entran en la conversación cuando <strong className="font-bold text-white">ya es demasiado tarde.</strong></li>
                  <li className="pl-2">Cuando el deal aparece en prensa, la decisión ya se tomó.</li>
                  <li className="pl-2">Detectá el deal antes de que sea noticia.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Tercera Sección: Señales del mercado */}
        <div className="bg-[#F4F4F4] py-12 sm:py-16" id="caracteristicas">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="relative flex justify-center lg:justify-start order-2 lg:order-1">
                <div className="relative w-full max-w-lg">
                  <Image
                    src="https://agora.lexlatin.com/wp-content/uploads/2023/07/02.-Landing-page-Agora-Imagen-hombre-1520-x-1200-pxl.png"
                    alt="Hombre Ágora Analítica"
                    width={1520}
                    height={1200}
                    className="w-full h-auto object-contain drop-shadow-xl z-10 relative"
                  />
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#E05C50] leading-tight text-balance">
                  El mercado se mueve antes de las noticias.
                </h2>
                <p className="mt-6 text-lg italic text-gray-500 font-medium">
                  Las señales reales aparecen en:
                </p>
                <ul className="mt-8 space-y-5 text-lg text-gray-800 font-medium">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 flex-none text-[#E05C50] fill-[#E05C50]/10" aria-hidden="true" />
                    <span>operaciones medianas que no salen en prensa</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 flex-none text-[#E05C50] fill-[#E05C50]/10" aria-hidden="true" />
                    <span>compradores que repiten patrones</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 flex-none text-[#E05C50] fill-[#E05C50]/10" aria-hidden="true" />
                    <span>movimientos cross-border silenciosos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 flex-none text-[#E05C50] fill-[#E05C50]/10" aria-hidden="true" />
                    <span>cambios sectoriales incipientes</span>
                  </li>
                </ul>
                <div className="mt-10 space-y-3">
                  <p className="text-base text-gray-500 font-medium">
                    Detectar estas señales cambia completamente la estrategia.
                  </p>
                  <p className="text-base text-gray-500 font-medium">
                    Comienza hoy a detectar esas señales
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="#planes"
                    className="inline-flex rounded-full bg-[#E05C50] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all items-center gap-2"
                  >
                    Explorar Ágora por 15 días <span className="ml-1 font-bold">›</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cuarta Sección: Ágora permite leer esas señales */}
        <div className="bg-[#1C1F33] py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#E05C50] leading-tight text-balance">
                  Ágora permite leer esas señales.
                </h2>
                <div className="mt-10">
                  <Link
                    href="#planes"
                    className="inline-flex rounded-full bg-[#E05C50] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all items-center gap-2"
                  >
                    Explorar Ágora por 15 días <span className="ml-1 font-bold">›</span>
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-lg text-white font-medium mb-6">
                  Analiza operaciones corporativas en<br/>toda América Latina para identificar:
                </p>
                <ul className="space-y-4 text-lg text-white font-medium list-disc pl-6 marker:text-white">
                  <li className="pl-2">Patrones de inversión</li>
                  <li className="pl-2">Expansión sectorial</li>
                  <li className="pl-2">Actividad de compradores<br/>estratégicos</li>
                  <li className="pl-2">Posicionamiento de firmas asesoras</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Quinta Sección: Señales recientes */}
        <div className="bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#E05C50] leading-tight text-balance">
                  Señales recientes del mercado
                </h2>
                <div className="mt-8 space-y-6 text-lg text-gray-900 font-medium">
                  <p>Ejemplo</p>
                  <p>En los últimos 60 días:</p>
                  <ul className="space-y-4 list-disc pl-6 marker:text-gray-900">
                    <li className="pl-2">compradores estratégicos adquirieron activos<br/>energéticos en tres países</li>
                    <li className="pl-2">financiamiento internacional aumentó en proyectos<br/>logísticos</li>
                    <li className="pl-2">empresas regionales comenzaron expansión fuera de<br/>su mercado doméstico</li>
                  </ul>
                  <p className="pt-2">
                    Cuando estas señales aparecen juntas, el mercado suele<br/>estar cambiando.
                  </p>
                </div>
                <div className="mt-10">
                  <Link
                    href="#planes"
                    className="inline-flex rounded-full bg-[#E05C50] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all items-center gap-2"
                  >
                    Explorar Ágora por 15 días <span className="ml-1 font-bold">›</span>
                  </Link>
                </div>
              </div>
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative w-full max-w-lg">
                  <Image
                    src="https://agora.lexlatin.com/wp-content/uploads/2023/07/01.-Landing-page-Agora-Imagen-mujer-1520-x-1200-pxl-1024x808.png"
                    alt="Mujer App Ágora"
                    width={1024}
                    height={808}
                    className="w-full h-auto object-contain drop-shadow-xl z-10 relative"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sexta Sección: Video */}
        <div className="bg-[#1C1F33] py-12 sm:py-16 text-center" id="demo">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-8 md:mb-12 lg:mb-16 text-balance">
              Ágora es inteligencia de negocios
            </h2>
            <div className="relative mx-auto max-w-4xl rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/10 aspect-video bg-gray-900">
              <iframe 
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/keOV_9MF3zw" 
                title="Ágora es inteligencia de negocios" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>

        {/* Séptima Sección: ¿Cómo Ágora compila la data? */}
        <div className="bg-white py-12 sm:py-16 text-center">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#E05C50] leading-tight mb-8 text-balance">
              ¿Cómo Ágora compila la data?
            </h2>
            <div className="max-w-3xl mx-auto space-y-6 text-[1.1rem] leading-relaxed text-gray-800 font-medium">
              <p>Firmas de toda Latinoamérica reportan sus operaciones a LexLatin.</p>
              <p>Contamos con una completa base de datos que se alimenta de gran variedad de fuentes del sector legal.</p>
              <p>A esto se suma que un equipo de expertos —abogados y periodistas con amplia experiencia en el sector— revisa toda la información que encontrarás en Ágora.</p>
            </div>
            
            <div className="mt-10 mb-20">
              <Link
                href="#planes"
                className="inline-flex rounded-full bg-[#E05C50] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all items-center gap-2"
              >
                Explorar Ágora por 15 días <span className="ml-1 font-bold">›</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center mt-16">
              {/* Analizamos la data */}
              <div className="flex flex-col items-center">
                <Image 
                  src="https://agora.lexlatin.com/wp-content/uploads/2023/08/01.-Icono-Agora-Compila-Analizamos-la-data.png"
                  alt="Analizamos la data"
                  width={300}
                  height={150}
                  className="mb-8 w-48 h-auto object-contain"
                />
                <h3 className="text-xl font-extrabold text-gray-900 mb-4">Analizamos la data</h3>
                <p className="text-gray-500 font-medium text-sm leading-relaxed px-4">
                  Recibimos cientos de reportes mensuales de operaciones de compraventa, escisiones, financiamientos y emisiones corporativas.
                </p>
              </div>

              {/* Validamos */}
              <div className="flex flex-col items-center">
                <Image 
                  src="https://agora.lexlatin.com/wp-content/uploads/2023/08/02.-Icono-Agora-Compila-Validamos.png"
                  alt="Validamos"
                  width={300}
                  height={150}
                  className="mb-8 w-48 h-auto object-contain"
                />
                <h3 className="text-xl font-extrabold text-gray-900 mb-4">Validamos</h3>
                <p className="text-gray-500 font-medium text-sm leading-relaxed px-4">
                  Contrastamos los detalles de cada operación con los asesores legales de las diferentes partes involucradas, así como con documentos públicos disponibles en las páginas de los diferentes reguladores.
                </p>
              </div>

              {/* Catalogamos */}
              <div className="flex flex-col items-center">
                <Image 
                  src="https://agora.lexlatin.com/wp-content/uploads/2023/08/03.-Icono-Agora-Compila-Catalogamos.png"
                  alt="Catalogamos"
                  width={300}
                  height={150}
                  className="mb-8 w-48 h-auto object-contain"
                />
                <h3 className="text-xl font-extrabold text-gray-900 mb-4">Catalogamos</h3>
                <p className="text-gray-500 font-medium text-sm leading-relaxed px-4">
                  Luego de analizar los detalles de las operaciones y, con ayuda de diferentes herramientas tecnológicas, catalogamos la información en nuestra base de datos para que esté disponible para nuestros usuarios.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Octava Sección: Pricing / Trial CTA */}
        <div className="bg-[#1C1F33] py-12 sm:py-16" id="planes">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl sm:text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Acceso temporal</h2>
              <p className="mt-6 text-lg leading-8 text-gray-300">
                Activa tu prueba sin costo y explora inteligencia transaccional para tomar decisiones con más contexto, mejor timing y menos ruido.
              </p>
            </div>
            <div className="mx-auto mt-16 max-w-2xl rounded-3xl ring-1 ring-white/10 sm:mt-20 lg:mx-0 lg:flex lg:max-w-none">
              <div className="p-8 sm:p-10 lg:flex-auto">
                <h3 className="text-2xl font-bold tracking-tight text-white">Prueba Gratuita 15 Días</h3>
                <p className="mt-6 text-base leading-7 text-gray-300">
                  Data contrastada sobre más de 15.000 fusiones, adquisiciones y financiamientos corporativos en Latinoamérica a un clic.
                </p>
                <div className="mt-10 flex items-center gap-x-4">
                  <h4 className="flex-none text-sm font-semibold leading-6 text-[#E05C50]">¿Qué incluye?</h4>
                  <div className="h-px flex-auto bg-gray-800" />
                </div>
                <ul
                  role="list"
                  className="mt-8 grid grid-cols-1 gap-4 text-sm leading-6 text-gray-300 sm:grid-cols-2 sm:gap-6"
                >
                  <li className="flex gap-x-3">
                    <CheckCircle2 className="h-6 w-5 flex-none text-[#E05C50]" aria-hidden="true" />
                    Cancela antes de los 15 días sin cargos
                  </li>
                  <li className="flex gap-x-3">
                    <CheckCircle2 className="h-6 w-5 flex-none text-[#E05C50]" aria-hidden="true" />
                    Más de 15.000 operaciones en Latinoamérica
                  </li>
                  <li className="flex gap-x-3">
                    <CheckCircle2 className="h-6 w-5 flex-none text-[#E05C50]" aria-hidden="true" />
                    Acceso para evaluar valor real antes de suscribirte
                  </li>
                  <li className="flex gap-x-3">
                    <CheckCircle2 className="h-6 w-5 flex-none text-[#E05C50]" aria-hidden="true" />
                    Ranking de Firmas y Abogados
                  </li>
                </ul>
              </div>
              <div className="-mt-2 p-2 lg:mt-0 lg:w-full lg:max-w-md lg:flex-shrink-0">
                <div className="rounded-2xl bg-[#252A42] py-10 text-center ring-1 ring-inset ring-white/10 lg:flex lg:flex-col lg:justify-center lg:py-16">
                  <div className="mx-auto max-w-xs px-8">
                    <p className="text-base font-semibold text-gray-300">Suscríbete ahora</p>
                    <p className="mt-6 flex items-baseline justify-center gap-x-2">
                      <span className="text-5xl font-bold tracking-tight text-white">$0</span>
                      <span className="text-sm font-semibold leading-6 tracking-wide text-gray-400">/ los primeros 15 días</span>
                    </p>
                    <a
                      href="/api/public-checkout"
                      className="mt-10 block w-full rounded-full bg-[#E05C50] px-3 py-3 text-center text-sm font-bold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50]"
                    >
                      Comenzar prueba →
                    </a>
                    <p className="mt-6 text-xs leading-5 text-gray-400">
                      Haz clic y conoce el producto antes de tomar una decisión. (Requiere tarjeta de crédito para evitar spam, pero no habrá cargos hoy).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <Image 
              src="/logo.png" 
              alt="Ágora Logo" 
              width={120} 
              height={38} 
              className="h-8 w-auto object-contain"
            />
          </div>
          <p className="text-center text-sm leading-5 text-gray-500">
            &copy; {new Date().getFullYear()} LexLatin. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      {/* Floating Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-4 z-50">
        <a 
          href="https://api.whatsapp.com/send/?phone=5215551879221&text=Hola%2C+necesito+m%C3%A1s+informaci%C3%B3n+sobre+%C3%81gora&type=phone_number&app_absent=0"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#20bd5a] transition-all hover:scale-105"
          aria-label="Chat on WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
        </a>
        <a 
          href="#top"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg border border-gray-100 hover:bg-gray-50 transition-all hover:-translate-y-1"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-6 w-6" />
        </a>
      </div>
    </div>
  )
}
