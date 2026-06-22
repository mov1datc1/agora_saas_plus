const https = require('https');
const url = 'https://phpstack-763726-5097902.cloudwaysapps.com/jsonapi/node/post?include=field_abogados_involucrados,field_firmas_involucradas,field_empresas_involucradas,field_industrias_asociadas,field_paises_involucrados,field_operacion,field_operacion.field_datos_monetarios&page[limit]=2&sort=-created';
const auth = 'Basic ' + Buffer.from('agora_api_user:Agor4Lex!').toString('base64');

https.get(url, { headers: { 'Authorization': auth, 'Accept': 'application/vnd.api+json' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Got response!');
      
      const ops = json.included?.filter(i => i.type.includes('operacion') || i.type.includes('monetari')) || [];
      console.log('Monetary data:', JSON.stringify(ops, null, 2).substring(0, 1500));
      
      const lawyers = json.included?.filter(i => i.type.includes('abogado')) || [];
      console.log('Lawyers data:', JSON.stringify(lawyers, null, 2).substring(0, 500));
    } catch(e) {
      console.log('Error parsing JSON');
    }
  });
}).on('error', (e) => {
  console.log('Error:', e);
});
