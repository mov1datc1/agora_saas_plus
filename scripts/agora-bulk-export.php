<?php
/**
 * ÁGORA PLUS — Bulk Export Endpoint
 * 
 * Este archivo va en el servidor de Cloudways (Drupal).
 * Lee MySQL localmente (sin whitelist) y devuelve data como JSON via HTTP.
 * Vercel lo consume en vez de conectar directamente a MySQL.
 * 
 * Ubicación sugerida: /home/master/applications/[app]/public_html/agora-bulk-export.php
 * URL: https://lexlatin.com/agora-bulk-export.php?key=XXXXX&offset=0&limit=50
 * 
 * IMPORTANTE: Protegido con API Key en query param o header.
 */

// ── Config ──
$API_KEY = 'agora-sync-2026-k8xP9mQ2vR'; // Cambiar en producción
$DB_HOST = '127.0.0.1'; // Localhost en Cloudways
$DB_NAME = 'zwcjasengh';
$DB_USER = 'zwcjasengh';
$DB_PASS = 'KctUE3ap9p';

// ── CORS & Headers ──
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Auth ──
$key = $_GET['key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($key !== $API_KEY) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API Key inválida']);
    exit;
}

// ── Params ──
$offset = max(0, intval($_GET['offset'] ?? 0));
$limit = min(200, max(10, intval($_GET['limit'] ?? 50)));

// ── Connect MySQL (localhost — no whitelist needed) ──
try {
    $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'MySQL connection failed: ' . $e->getMessage()]);
    exit;
}

$startTime = microtime(true);

// ── Total count ──
$totalStmt = $pdo->query("
    SELECT COUNT(DISTINCT n.nid) as total FROM node n
    JOIN node_field_data d ON n.vid=d.vid
    JOIN node__field_category c ON n.vid=c.revision_id
    WHERE c.field_category_target_id = 1
");
$total = intval($totalStmt->fetchColumn());

// ── Read chunk of posts ──
$postsStmt = $pdo->prepare("
    SELECT DISTINCT n.nid as id, d.title as titulo, d.status as visible,
        t.field_tipo_de_noticia_value as tipo,
        np.field_caso_no_publicado_value as noPublicado,
        fc.field_fecha_de_concrecion_del_ac_value as fechaConcrecion,
        ff.field_fecha_de_la_firma_value as fechaFirma,
        fci.field_fecha_de_cierre_de_la_emis_value as fechaCierre,
        body.body_value as bodyRaw,
        body.body_summary as bodySummary
    FROM node n
    JOIN node_field_data d ON n.vid=d.vid
    JOIN node__field_category c ON n.vid=c.revision_id
    LEFT JOIN node__field_tipo_de_noticia t ON n.vid=t.revision_id
    LEFT JOIN node__field_caso_no_publicado np ON n.vid=np.revision_id
    LEFT JOIN node__field_fecha_de_concrecion_del_ac fc ON n.vid=fc.revision_id
    LEFT JOIN node__field_fecha_de_la_firma ff ON n.vid=ff.revision_id
    LEFT JOIN node__field_fecha_de_cierre_de_la_emis fci ON n.vid=fci.revision_id
    LEFT JOIN node__body body ON n.vid=body.revision_id
    WHERE c.field_category_target_id = 1
    ORDER BY n.nid DESC
    LIMIT :limit OFFSET :offset
");
$postsStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$postsStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$postsStmt->execute();
$posts = $postsStmt->fetchAll();

if (empty($posts)) {
    echo json_encode([
        'success' => true,
        'posts' => [],
        'relations' => [],
        'lookups' => [],
        'total' => $total,
        'offset' => $offset,
        'hasMore' => false,
        'durationMs' => round((microtime(true) - $startTime) * 1000),
    ]);
    exit;
}

$nids = array_map(function($p) { return intval($p['id']); }, $posts);
$nidsStr = implode(',', $nids);

// ── Lookup tables (small, cached) ──
$countries = $pdo->query("SELECT n.nid as id, d.title as nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='pais'")->fetchAll();
$paRaw = $pdo->query("SELECT n.nid as id, d.title as nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='areas_de_practica'")->fetchAll();
$indRaw = $pdo->query("SELECT n.nid as id, d.title as nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='industria'")->fetchAll();

// ── Relationships for this chunk ──
$areas = $pdo->query("SELECT entity_id as idPost, field_ae_target_id as idArea FROM node__field_ae WHERE entity_id IN ($nidsStr)")->fetchAll();
$firms = $pdo->query("SELECT entity_id as idPost, field_firmas_involucradas_target_id as idFirma FROM node__field_firmas_involucradas WHERE entity_id IN ($nidsStr)")->fetchAll();
$lawyers = $pdo->query("SELECT entity_id as idPost, field_abogados_involucrados_target_id as idAbogado FROM node__field_abogados_involucrados WHERE entity_id IN ($nidsStr)")->fetchAll();
$industries = $pdo->query("SELECT entity_id as idPost, field_industrias_asociadas_target_id as idIndustria FROM node__field_industrias_asociadas WHERE entity_id IN ($nidsStr)")->fetchAll();
$countriesRel = $pdo->query("SELECT entity_id as idPost, field_paises_involucrados_target_id as idPais FROM node__field_paises_involucrados WHERE entity_id IN ($nidsStr)")->fetchAll();

$companies = $pdo->query("
    SELECT ei.entity_id as idPost, e.field_empresa_target_id as idEmpresa, cd.title as nombre,
        COALESCE(rma.field_rol_fusiones_y_adquisicion_value, rem.field_rol_em_value,
        rfi.field_rol_financiamiento_value, t.field_tipo_de_operacion_value) AS rol
    FROM node__field_empresas_involucradas ei
    INNER JOIN paragraph__field_empresa e ON ei.field_empresas_involucradas_target_revision_id=e.revision_id
    INNER JOIN node_field_data cd ON e.field_empresa_target_id=cd.nid
    LEFT JOIN paragraph__field_tipo_de_operacion t ON ei.field_empresas_involucradas_target_revision_id=t.revision_id
    LEFT JOIN paragraph__field_rol_fusiones_y_adquisicion rma ON ei.field_empresas_involucradas_target_id=rma.entity_id
    LEFT JOIN paragraph__field_rol_em rem ON ei.field_empresas_involucradas_target_id=rem.entity_id
    LEFT JOIN paragraph__field_rol_financiamiento rfi ON ei.field_empresas_involucradas_target_id=rfi.entity_id
    WHERE ei.entity_id IN ($nidsStr)
")->fetchAll();

$money = $pdo->query("
    SELECT o.entity_id as idPost, IF(tipo.field_tipo_value='confidencial',0,usd.field_monto_transaccion_en_dolar_value) as montoUSD
    FROM node__field_operacion o
    INNER JOIN paragraph__field_datos_monetarios dm ON o.field_operacion_target_revision_id=dm.revision_id
    LEFT JOIN paragraph__field_tipo tipo ON dm.field_datos_monetarios_target_revision_id=tipo.revision_id
    LEFT JOIN paragraph__field_monto_transaccion_en_dolar usd ON dm.field_datos_monetarios_target_revision_id=usd.revision_id
    WHERE o.entity_id IN ($nidsStr)
")->fetchAll();

// ── Firm & Lawyer names ──
$firmNids = array_unique(array_filter(array_map(function($f) { return intval($f['idFirma']); }, $firms)));
$firmNames = [];
if (!empty($firmNids)) {
    $firmNames = $pdo->query("SELECT n.nid as id, d.title as nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.nid IN (" . implode(',', $firmNids) . ")")->fetchAll();
}

$lawyerNids = array_unique(array_filter(array_map(function($l) { return intval($l['idAbogado']); }, $lawyers)));
$lawyerNames = [];
if (!empty($lawyerNids)) {
    $lawyerNames = $pdo->query("SELECT n.nid as id, d.title as nombre, f.field_firma_target_id as idFirma FROM node n JOIN node_field_data d ON n.vid=d.vid LEFT JOIN node__field_firma f ON n.vid=f.revision_id WHERE n.nid IN (" . implode(',', $lawyerNids) . ")")->fetchAll();
}

// ── Response ──
echo json_encode([
    'success' => true,
    'posts' => $posts,
    'relations' => [
        'areas' => $areas,
        'firms' => $firms,
        'lawyers' => $lawyers,
        'industries' => $industries,
        'countries' => $countriesRel,
        'companies' => $companies,
        'money' => $money,
    ],
    'lookups' => [
        'countries' => $countries,
        'practiceAreas' => $paRaw,
        'industries' => $indRaw,
        'firmNames' => $firmNames,
        'lawyerNames' => $lawyerNames,
    ],
    'total' => $total,
    'offset' => $offset,
    'limit' => $limit,
    'hasMore' => ($offset + count($posts)) < $total,
    'durationMs' => round((microtime(true) - $startTime) * 1000),
], JSON_UNESCAPED_UNICODE);
