-- ========================================================================================
-- ÁGORA PLUS SaaS - Esquema Base de Base de Datos (PostgreSQL para Supabase)
-- ========================================================================================

-- 1. Tablas de Catálogo y Ubicación
CREATE TABLE public.countries (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.cities (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country_id BIGINT REFERENCES public.countries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.practice_areas (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.industries (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Entidades Principales
CREATE TABLE public.firms (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    perfilplus BOOLEAN DEFAULT false,
    is_regional BOOLEAN DEFAULT false,
    hq BIGINT REFERENCES public.firms(id) ON DELETE SET NULL,
    main_firm BIGINT REFERENCES public.firms(id) ON DELETE SET NULL,
    number_of_lawyers SMALLINT,
    number_of_practices SMALLINT,
    number_of_partners SMALLINT,
    number_of_professionals SMALLINT,
    number_of_equity_partners SMALLINT,
    number_of_non_equity_partners SMALLINT,
    number_of_associates SMALLINT,
    total_personnel SMALLINT,
    description TEXT,
    address TEXT,
    google_map_address VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    website VARCHAR(255),
    linkedin VARCHAR(255),
    twitter VARCHAR(255),
    facebook VARCHAR(255),
    instagram VARCHAR(255),
    youtube VARCHAR(255),
    international_partnerships TEXT,
    awards TEXT,
    background_image VARCHAR(255),
    logo VARCHAR(255),
    video VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    published BOOLEAN DEFAULT false,
    country_id BIGINT REFERENCES public.countries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.companies (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255),
    main_company BIGINT REFERENCES public.companies(id) ON DELETE SET NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    published BOOLEAN DEFAULT false,
    country_id BIGINT REFERENCES public.countries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.lawyers (
    id BIGINT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    gender CHAR(1),
    published_at TIMESTAMP WITH TIME ZONE,
    published BOOLEAN DEFAULT false,
    firm_id BIGINT REFERENCES public.firms(id) ON DELETE SET NULL,
    city_id BIGINT REFERENCES public.cities(id) ON DELETE SET NULL,
    country_id BIGINT REFERENCES public.countries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.posts (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    excerpt TEXT,
    type VARCHAR(255),
    main_post BIGINT REFERENCES public.posts(id) ON DELETE SET NULL,
    not_listed BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tablas Pivote (Relaciones Muchos a Muchos)
CREATE TABLE public.city_firm (
    city_id BIGINT REFERENCES public.cities(id) ON DELETE CASCADE,
    firm_id BIGINT REFERENCES public.firms(id) ON DELETE CASCADE,
    PRIMARY KEY (city_id, firm_id)
);

CREATE TABLE public.firm_practice_area (
    firm_id BIGINT REFERENCES public.firms(id) ON DELETE CASCADE,
    practice_area_id BIGINT REFERENCES public.practice_areas(id) ON DELETE CASCADE,
    PRIMARY KEY (firm_id, practice_area_id)
);

CREATE TABLE public.firm_post (
    firm_id BIGINT REFERENCES public.firms(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
    PRIMARY KEY (firm_id, post_id)
);

CREATE TABLE public.company_post (
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
    PRIMARY KEY (company_id, post_id)
);

-- 4. Seguridad (Row Level Security) - SaaS Multi-tenant
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Nota: Las políticas (Policies) exactas dependerán de la estructura de usuarios finales que definamos para el SaaS.
-- Por defecto, permitimos lectura pública si 'published' es true:
CREATE POLICY "Permitir lectura pública de firmas publicadas" ON public.firms FOR SELECT USING (published = true);
CREATE POLICY "Permitir lectura pública de abogados publicados" ON public.lawyers FOR SELECT USING (published = true);
CREATE POLICY "Permitir lectura pública de transacciones" ON public.posts FOR SELECT USING (published = true);
