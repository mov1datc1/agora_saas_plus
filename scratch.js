const req = new Request('http://localhost/api/sync-drupal?offset=0', {
  method: 'POST',
  headers: { 'authorization': 'Bearer agora-bypass-token' }
});
console.log(req.url);
console.log(req.headers.get('authorization'));
