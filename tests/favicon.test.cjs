const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const markup=fs.readFileSync(path.join(root,'index.html'),'utf8');

function pngSize(filename){
  const data=fs.readFileSync(path.join(root,'assets',filename));
  assert.deepEqual([...data.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  return {width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
}

test('head referencia os formatos do favicon',()=>{
  assert.match(markup,/rel="icon" href="assets\/favicon\.ico" sizes="any"/);
  assert.match(markup,/rel="icon" type="image\/png" href="assets\/favicon\.png" sizes="512x512"/);
  assert.match(markup,/rel="apple-touch-icon" href="assets\/apple-touch-icon\.png" sizes="180x180"/);
});

test('favicons PNG possuem as dimensões declaradas',()=>{
  assert.deepEqual(pngSize('favicon.png'),{width:512,height:512});
  assert.deepEqual(pngSize('apple-touch-icon.png'),{width:180,height:180});
});

test('favicon ICO contém variantes de 16, 32 e 48 pixels',()=>{
  const data=fs.readFileSync(path.join(root,'assets','favicon.ico'));
  assert.equal(data.readUInt16LE(0),0);
  assert.equal(data.readUInt16LE(2),1);
  assert.equal(data.readUInt16LE(4),3);
  const sizes=[0,1,2].map(index=>data.readUInt8(6+(index*16)));
  assert.deepEqual(sizes,[16,32,48]);
});
