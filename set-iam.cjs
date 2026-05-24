const fs = require('fs');
const https = require('https');

const cfg = JSON.parse(fs.readFileSync(process.env.HOME + '/.config/configstore/firebase-tools.json', 'utf8'));
const token = cfg.tokens?.access_token;
const project = 'mygardening-b187e';
const region = 'us-central1';
const services = ['createlinktoken', 'exchangepublictoken', 'synctransactions', 'removebankconnection'];

const policy = JSON.stringify({
  policy: {
    bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }]
  }
});

let done = 0;

services.forEach(svc => {
  const path = `/v1/projects/${project}/locations/${region}/services/${svc}:setIamPolicy`;
  const opts = {
    hostname: 'run.googleapis.com',
    path,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(policy)
    }
  };

  const req = https.request(opts, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log(svc + ': HTTP ' + res.statusCode + ' -> ' + body.slice(0, 200));
      if (++done === services.length) process.exit(0);
    });
  });

  req.on('error', e => {
    console.error(svc + ' error:', e.message);
    if (++done === services.length) process.exit(1);
  });

  req.write(policy);
  req.end();
});
