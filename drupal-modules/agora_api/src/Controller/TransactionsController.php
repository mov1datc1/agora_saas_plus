<?php

namespace Drupal\agora_api\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Custom REST controller for Agora SaaS.
 *
 * Serves ALL transaction posts (published + unpublished) with full
 * relationships: lawyers, firms, companies (with roles), countries,
 * practice areas, industries, and monetary data.
 *
 * This endpoint replaces JSON:API for Agora's ETL pipeline, which
 * cannot read unpublished content due to Drupal core issue #3080441.
 *
 * Endpoint: GET /api/agora/transactions
 * Auth: Token via X-Agora-Token header
 * Params:
 *   - page (int, default 0): pagination offset
 *   - limit (int, default 50, max 100): batch size
 *   - status (string): 'all' (default), 'published', 'unpublished'
 *   - changed_after (int): UNIX timestamp, only return posts changed after this time
 */
class TransactionsController {

  /**
   * Shared secret token for API authentication.
   * Must match DRUPAL_AGORA_TOKEN env var in Vercel.
   */
  const API_TOKEN = 'agora-etl-2026-secure-token';

  /**
   * Main endpoint: list transaction posts with all relationships.
   */
  public function getList(Request $request) {
    // ── Auth ──
    $token = $request->headers->get('X-Agora-Token');
    if ($token !== self::API_TOKEN) {
      return new JsonResponse([
        'error' => 'Unauthorized',
        'message' => 'Invalid or missing X-Agora-Token header',
      ], 403);
    }

    // ── Params ──
    $page = max(0, (int) $request->query->get('page', 0));
    $limit = min(100, max(1, (int) $request->query->get('limit', 50)));
    $statusFilter = $request->query->get('status', 'all'); // all | published | unpublished
    $changedAfter = (int) $request->query->get('changed_after', 0);
    $offset = $page * $limit;

    $db = \Drupal::database();

    // ── Build main query ──
    // field_category_target_id = 1 means "Transacción" (Noticias category)
    $query = $db->select('node_field_data', 'n');
    $query->join('node__field_category', 'c', 'n.nid = c.entity_id');
    $query->condition('c.field_category_target_id', 1);
    $query->condition('n.type', 'post');

    // Status filter
    if ($statusFilter === 'published') {
      $query->condition('n.status', 1);
    }
    elseif ($statusFilter === 'unpublished') {
      $query->condition('n.status', 0);
    }
    // 'all' = no status filter

    // Changed after filter (for incremental sync)
    if ($changedAfter > 0) {
      $query->condition('n.changed', $changedAfter, '>=');
    }

    // Count total before pagination
    $total = (int) $query->countQuery()->execute()->fetchField();

    // Fetch paginated NIDs
    $query->fields('n', ['nid', 'title', 'status', 'created', 'changed']);
    $query->orderBy('n.changed', 'DESC');
    $query->range($offset, $limit);
    $nodes = $query->execute()->fetchAll();

    if (empty($nodes)) {
      return new JsonResponse([
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'count' => 0,
        'data' => [],
      ]);
    }

    $nids = array_column($nodes, 'nid');

    // ── Batch load all relationships for these NIDs ──
    $bodies = $this->loadField($db, 'node__body', 'body_value', $nids, 'body_summary');
    $estados = $this->loadFieldSingle($db, 'node__field_estado_caso', 'field_estado_caso_value', $nids);
    $casoNoPub = $this->loadFieldSingle($db, 'node__field_caso_no_publicado', 'field_caso_no_publicado_value', $nids);
    $fechasFirma = $this->loadFieldSingle($db, 'node__field_fecha_de_la_firma', 'field_fecha_de_la_firma_value', $nids);
    $fechasCierre = $this->loadFieldSingle($db, 'node__field_fecha_de_cierre_de_la_emis', 'field_fecha_de_cierre_de_la_emis_value', $nids);
    $fechasConcrecion = $this->loadFieldSingle($db, 'node__field_fecha_de_concrecion_del_ac', 'field_fecha_de_concrecion_del_ac_value', $nids);

    // Relationships (multi-value)
    $practiceAreas = $this->loadRelatedNames($db, 'node__field_ae', 'field_ae_target_id', $nids);
    $countries = $this->loadRelatedNames($db, 'node__field_paises_involucrados', 'field_paises_involucrados_target_id', $nids);
    $firms = $this->loadRelatedNames($db, 'node__field_firmas_involucradas', 'field_firmas_involucradas_target_id', $nids);
    $lawyers = $this->loadRelatedNames($db, 'node__field_abogados_involucrados', 'field_abogados_involucrados_target_id', $nids);
    $industries = $this->loadRelatedNames($db, 'node__field_industrias_asociadas', 'field_industrias_asociadas_target_id', $nids);

    // Companies with roles (via paragraph entities)
    $companies = $this->loadCompaniesWithRoles($db, $nids);

    // Monetary data (via operation → datos_monetarios paragraphs)
    $monetary = $this->loadMonetaryData($db, $nids);

    // ── Build response ──
    $data = [];
    foreach ($nodes as $node) {
      $nid = (int) $node->nid;

      $bodyVal = $bodies[$nid]['value'] ?? NULL;
      $bodySummary = $bodies[$nid]['summary'] ?? NULL;

      $data[] = [
        'nid' => $nid,
        'title' => $node->title,
        'status' => (bool) $node->status,
        'created' => date('c', $node->created),
        'changed' => date('c', $node->changed),
        'body' => $bodyVal,
        'excerpt' => $bodySummary ?: ($bodyVal ? mb_substr(strip_tags($bodyVal), 0, 2000) : NULL),
        'link' => '/noticias/' . $this->slugify($node->title) . '-' . $nid,
        'field_estado_caso' => $estados[$nid] ?? NULL,
        'field_caso_no_publicado' => isset($casoNoPub[$nid]) ? (bool) $casoNoPub[$nid] : FALSE,
        'field_fecha_firma' => $fechasFirma[$nid] ?? NULL,
        'field_fecha_cierre' => $fechasCierre[$nid] ?? $fechasConcrecion[$nid] ?? NULL,
        'practice_areas' => $practiceAreas[$nid] ?? [],
        'countries' => $countries[$nid] ?? [],
        'industries' => $industries[$nid] ?? [],
        'firms' => $firms[$nid] ?? [],
        'lawyers' => $lawyers[$nid] ?? [],
        'companies' => $companies[$nid] ?? [],
        'monetary' => $monetary[$nid] ?? NULL,
      ];
    }

    return new JsonResponse([
      'total' => $total,
      'page' => $page,
      'limit' => $limit,
      'count' => count($data),
      'data' => $data,
    ]);
  }

  // ══════════════════════════════════════════════════════════════
  // Helper methods
  // ══════════════════════════════════════════════════════════════

  /**
   * Load a single-value field for multiple entity IDs.
   */
  private function loadFieldSingle($db, $table, $column, array $nids) {
    try {
      $result = $db->select($table, 'f')
        ->fields('f', ['entity_id', $column])
        ->condition('entity_id', $nids, 'IN')
        ->execute()
        ->fetchAllKeyed();
      return $result;
    }
    catch (\Exception $e) {
      return [];
    }
  }

  /**
   * Load body field (value + summary) for multiple entities.
   */
  private function loadField($db, $table, $column, array $nids, $extraColumn = NULL) {
    try {
      $query = $db->select($table, 'f')
        ->fields('f', ['entity_id', $column])
        ->condition('entity_id', $nids, 'IN');
      if ($extraColumn) {
        $query->addField('f', $extraColumn);
      }
      $rows = $query->execute()->fetchAll();
      $map = [];
      foreach ($rows as $row) {
        $map[(int) $row->entity_id] = [
          'value' => $row->{$column},
          'summary' => $extraColumn ? ($row->{$extraColumn} ?? NULL) : NULL,
        ];
      }
      return $map;
    }
    catch (\Exception $e) {
      return [];
    }
  }

  /**
   * Load names of related entities (via entity reference fields).
   * Returns [entity_id => [name1, name2, ...]].
   */
  private function loadRelatedNames($db, $table, $column, array $nids) {
    try {
      $query = $db->select($table, 'r');
      $query->join('node_field_data', 'fd', "r.{$column} = fd.nid");
      $query->fields('r', ['entity_id']);
      $query->fields('fd', ['title']);
      $query->condition('r.entity_id', $nids, 'IN');
      $rows = $query->execute()->fetchAll();

      $map = [];
      foreach ($rows as $row) {
        $eid = (int) $row->entity_id;
        $map[$eid][] = $row->title;
      }
      return $map;
    }
    catch (\Exception $e) {
      return [];
    }
  }

  /**
   * Load companies with their roles from paragraph entities.
   *
   * Chain: node → field_empresas_involucradas → paragraph → field_empresa → empresa node
   * Roles: paragraph → field_rol_em / field_rol_fusiones_y_adquisicion / field_rol_financiamiento / etc.
   */
  private function loadCompaniesWithRoles($db, array $nids) {
    try {
      $query = $db->select('node__field_empresas_involucradas', 'ei');
      $query->join('paragraph__field_empresa', 'pe', 'ei.field_empresas_involucradas_target_id = pe.entity_id');
      $query->join('node_field_data', 'cd', 'pe.field_empresa_target_id = cd.nid');

      // Left join ALL role tables
      $roleTables = [
        'r_ma' => ['table' => 'paragraph__field_rol_fusiones_y_adquisicion', 'col' => 'field_rol_fusiones_y_adquisicion_value'],
        'r_em' => ['table' => 'paragraph__field_rol_em', 'col' => 'field_rol_em_value'],
        'r_fi' => ['table' => 'paragraph__field_rol_financiamiento', 'col' => 'field_rol_financiamiento_value'],
        'r_li' => ['table' => 'paragraph__field_rol_litigios', 'col' => 'field_rol_litigios_value'],
        'r_re' => ['table' => 'paragraph__field_rol_reestructuraciones', 'col' => 'field_rol_reestructuraciones_value'],
        'r_ar' => ['table' => 'paragraph__field_rol_arrendamientos', 'col' => 'field_rol_arrendamientos_value'],
      ];

      foreach ($roleTables as $alias => $info) {
        $query->leftJoin($info['table'], $alias, "ei.field_empresas_involucradas_target_id = {$alias}.entity_id");
        $query->addField($alias, $info['col']);
      }

      $query->addField('ei', 'entity_id', 'node_id');
      $query->addField('cd', 'title', 'company_name');
      $query->addField('cd', 'nid', 'company_nid');
      $query->condition('ei.entity_id', $nids, 'IN');

      $rows = $query->execute()->fetchAll();

      $map = [];
      foreach ($rows as $row) {
        $nid = (int) $row->node_id;
        $role = $row->field_rol_fusiones_y_adquisicion_value
          ?? $row->field_rol_em_value
          ?? $row->field_rol_financiamiento_value
          ?? $row->field_rol_litigios_value
          ?? $row->field_rol_reestructuraciones_value
          ?? $row->field_rol_arrendamientos_value
          ?? 'participante';

        $map[$nid][] = [
          'name' => $row->company_name,
          'nid' => (int) $row->company_nid,
          'role' => $role,
        ];
      }
      return $map;
    }
    catch (\Exception $e) {
      return [];
    }
  }

  /**
   * Load monetary data from operation paragraphs.
   *
   * Chain: node → field_operacion → paragraph → field_datos_monetarios → paragraph → field_monto_transaccion_en_dolar
   * Returns first non-null amount (sum if multiple operations).
   */
  private function loadMonetaryData($db, array $nids) {
    try {
      $query = $db->select('node__field_operacion', 'op');
      $query->join('paragraph__field_datos_monetarios', 'dm', 'op.field_operacion_target_id = dm.entity_id');
      $query->join('paragraph__field_monto_transaccion_en_dolar', 'mt', 'dm.field_datos_monetarios_target_id = mt.entity_id');
      $query->addField('op', 'entity_id', 'node_id');
      $query->addField('mt', 'field_monto_transaccion_en_dolar_value', 'amount_usd');
      $query->condition('op.entity_id', $nids, 'IN');

      $rows = $query->execute()->fetchAll();

      // Sum all operation amounts per node
      $map = [];
      foreach ($rows as $row) {
        $nid = (int) $row->node_id;
        $amount = (float) $row->amount_usd;
        if (!isset($map[$nid])) {
          $map[$nid] = ['total_usd' => 0, 'operations' => 0];
        }
        $map[$nid]['total_usd'] += $amount;
        $map[$nid]['operations']++;
      }
      return $map;
    }
    catch (\Exception $e) {
      return [];
    }
  }

  /**
   * Generate URL-safe slug from title (approximate).
   */
  private function slugify($text) {
    $text = mb_strtolower(trim($text));
    $text = preg_replace('/[áàäâã]/', 'a', $text);
    $text = preg_replace('/[éèëê]/', 'e', $text);
    $text = preg_replace('/[íìïî]/', 'i', $text);
    $text = preg_replace('/[óòöôõ]/', 'o', $text);
    $text = preg_replace('/[úùüû]/', 'u', $text);
    $text = preg_replace('/ñ/', 'n', $text);
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', $text);
    return trim($text, '-');
  }
}
