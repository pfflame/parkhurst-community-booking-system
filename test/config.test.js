const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadConfig, validateConfig } = require('../src/config');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parkhurst-config-'));
const file = path.join(dir, 'config.json');
const fixture = require('../config/config.example.json');
fs.writeFileSync(file, JSON.stringify(fixture));
const user = path.join(dir,'user.json');
const pair = {email:'user@example.com',password:'private $\'";`\\& password'};
fs.writeFileSync(user,JSON.stringify(pair));
function test(name, fn) { fn(); console.log(`✓ ${name}`); }
function cli(args) { return spawnSync(process.execPath,['index.js',...args],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}); }
try {
  test('shared configuration validates without containing login data', () => {
    const c=loadConfig(file);
    assert.equal(c.credentials,undefined);
    validateConfig(c,{requireCredentials:false});
    assert.throws(()=>validateConfig(c),/Choose a user/);
  });
  test('selected file keeps email/password together and preserves special characters', () => {
    const c=loadConfig(file,{credentials:user});
    assert.deepEqual(c.credentials,pair);
    assert.deepEqual(c.defaults,fixture.defaults);
    validateConfig(c);
  });
  test('unused environment and shared credentials cannot supply an implicit login', () => {
    process.env.BOOKING_EMAIL='old@example.com';
    process.env.BOOKING_PASSWORD='old-password';
    const obsolete=path.join(dir,'obsolete.json');
    fs.writeFileSync(obsolete,JSON.stringify({...fixture,credentials:{email:'old@example.com',password:'old-password'}}));
    assert.equal(loadConfig(obsolete).credentials,undefined);
    assert.deepEqual(loadConfig(obsolete,{credentials:user}).credentials,pair);
  });
  test('empty, partial, malformed and missing user files fail without leaking contents', () => {
    const bad=path.join(dir,'bad.json');
    for(const content of ['{}','[]','{"email":"a@b.com"}','{"email":"a@b.com","password":""}','{"password":"private-secret",']) {
      fs.writeFileSync(bad,content);
      assert.throws(()=>loadConfig(file,{credentials:bad}),e=>!e.message.includes('private-secret'));
    }
    assert.throws(()=>loadConfig(file,{credentials:path.join(dir,'missing.json')}),/Cannot read credentials file/);
  });
  test('credential sources cannot be mixed', () => {
    assert.throws(()=>loadConfig(file,{credentials:user,email:'a@b.com',password:'one'}),/Use --credentials by itself/);
  });
  test('explicit credentials remain supported but require a complete pair', () => {
    assert.deepEqual(loadConfig(file,pair).credentials,pair);
    for(const bad of [{email:'a@b.com'},{password:'one'},{email:'',password:'one'}]) {
      assert.throws(()=>loadConfig(file,bad),/both email and password/);
    }
  });
  test('credentials must have a valid email', () => {
    assert.throws(()=>validateConfig(loadConfig(file,{email:'invalid',password:'one'})),/Invalid email/);
  });
  test('configuration-only validate and facility list require no user', () => {
    for(const command of ['validate','list']) {
      const r=cli([command,'--config',file]);
      assert.equal(r.status,0,r.stderr);
      assert.ok(!r.stdout.includes('old@example.com'));
    }
  });
  test('credential validation is local and never prints the password', () => {
    const r=cli(['validate','--config',file,'--credentials',user]);
    assert.equal(r.status,0,r.stderr);
    assert.match(r.stdout,/Configuration is valid/);
    assert.ok(!(r.stdout+r.stderr).includes(pair.password));
  });
  test('removed profile option is rejected before a booking starts', () => {
    const r=cli(['validate','--config',file,'--profile','old@example.com']);
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/unknown option/);
  });
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
