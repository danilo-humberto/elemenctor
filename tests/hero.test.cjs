const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const markup=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');

test('hero usa o arco suavizado como caminho único do título e da logo',()=>{
  assert.match(markup,/id="brand-arc" d="M 100 290 Q 600 40 1100 290"/);
  assert.equal((markup.match(/href="#brand-arc"/g)||[]).length,10);
  assert.match(script,/const path = \$\('#brand-arc'\)/);
  assert.match(script,/gsap\.set\('\.travel-logo',arcPosition\(arc\.progress\)\)/);
});
