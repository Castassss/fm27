import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

test('serves the application and assets, including from Windows paths with spaces', async()=>{
  const windowsRoot=path.win32.dirname(fileURLToPath('file:///C:/Users/ruben/My%20Projects/fm27/server.js',{windows:true}));
  assert.equal(windowsRoot,'C:\\Users\\ruben\\My Projects\\fm27');
  const target=path.win32.resolve(windowsRoot,'./index.html');
  assert.ok(target.startsWith(windowsRoot+path.win32.sep));
  const child=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:'31987'},stdio:['ignore','pipe','pipe']});
  try{
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(([code])=>{throw new Error('Server exited: '+code)})]);
    for(const url of ['/','/src/app.js','/src/style.css']){
      const response=await fetch('http://127.0.0.1:31987'+url);
      assert.equal(response.status,200,url);
      assert.ok((await response.text()).length>0);
    }
    assert.equal((await fetch('http://127.0.0.1:31987/.git/config')).status,404);
  }finally{child.kill();await once(child,'exit')}
});
