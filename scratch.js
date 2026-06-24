const fetch = require('node-fetch');

async function check() {
  const res = await fetch('https://phpstack-763726-5097902.cloudwaysapps.com/jsonapi/node/post?page[limit]=100&include=field_category,field_operacion');
  const json = await res.json();
  
  const categories = new Set();
  const operations = new Set();
  const tiposNoticia = new Set();
  
  for (const post of json.data) {
    if (post.attributes.field_tipo_de_noticia) tiposNoticia.add(post.attributes.field_tipo_de_noticia);
    if (post.relationships.field_category && post.relationships.field_category.data) {
      post.relationships.field_category.data.forEach(c => categories.add(c.id));
    }
    if (post.relationships.field_operacion && post.relationships.field_operacion.data) {
      post.relationships.field_operacion.data.forEach(o => operations.add(o.id));
    }
  }
  
  console.log('Categorias IDs:', Array.from(categories));
  console.log('Operaciones IDs:', Array.from(operations));
  console.log('Tipos de noticia:', Array.from(tiposNoticia));
  
  // also dump the includes to see the names
  if (json.included) {
    json.included.forEach(inc => {
      if (operations.has(inc.id) || categories.has(inc.id)) {
        console.log(`[${inc.type}] ${inc.id} -> ${inc.attributes.name}`);
      }
    });
  }
}
check();
