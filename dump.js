const fetch = require('node-fetch'); // wait, node 18+ has native fetch

async function run() {
  const url = 'https://phpstack-763726-5097902.cloudwaysapps.com/jsonapi/node/post?include=field_operacion&page[limit]=3';
  const authString = Buffer.from('agora_api_user:Agor4Lex!').toString('base64');
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/vnd.api+json'
    }
  });
  
  if (!response.ok) {
    console.log('Error', response.status);
    return;
  }
  const json = await response.json();
  
  // Find an operation node
  const ops = json.included?.filter(inc => inc.type.includes('operacion')) || [];
  console.log('Included Operations:', JSON.stringify(ops, null, 2));
  
  // Let's also look at the first post's relationships
  console.log('First Post Relationships:', JSON.stringify(json.data[0].relationships, null, 2));
  console.log('First Post Attributes:', JSON.stringify(json.data[0].attributes, null, 2));
}

run();
