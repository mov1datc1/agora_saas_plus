-- Habilitar la extensión pg_net (Permite hacer peticiones HTTP desde Supabase)
create extension if not exists pg_net;

-- Crear el Cron Job para ejecutar la sincronización de Drupal
-- Reemplaza 'https://tu-dominio-vercel.com' con tu dominio de producción
-- Reemplaza 'TU_CRON_SECRET_AQUI' con el valor que pusiste en la variable CRON_SECRET en Vercel
select
  cron.schedule(
    'sync-drupal-etl',
    '0 0 * * *', -- Ejecutar a la medianoche (00:00) todos los días
    $$
    select
      net.http_post(
        url:='https://tu-dominio-vercel.com/api/sync-drupal',
        headers:='{"Authorization": "Bearer TU_CRON_SECRET_AQUI"}'::jsonb
      )
    $$
  );

-- Comandos útiles para gestionar el cron job:
-- Ver los cron jobs activos:
-- select * from cron.job;

-- Ver los logs de ejecución del cron job:
-- select * from cron.job_run_details order by start_time desc limit 10;

-- Eliminar el cron job si necesitas reconfigurarlo:
-- select cron.unschedule('sync-drupal-etl');
