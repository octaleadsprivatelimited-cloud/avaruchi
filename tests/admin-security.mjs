import assert from 'node:assert/strict';
import { administratorSession, setTestPayment } from './fixtures.mjs';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
let checks = 0;
async function req(path, data, session='', extra={}) {
  const response = await fetch(origin+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json',Origin:origin}),...(session?{Cookie:session}:{}),...extra},body:data===undefined?undefined:JSON.stringify(data)});
  const value=response.headers.get('content-type')?.includes('json')?await response.json():new Uint8Array(await response.arrayBuffer());
  return {status:response.status,value,response};
}
async function status(path, data, session, expected, headers={}) {
  const r=await req(path,data,session,headers); assert.equal(r.status,expected,path+' '+JSON.stringify(r.value)); checks++;return r;
}
const login=await status('auth/demo',{},'',200);
assert.match(login.response.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);checks++;
const customer=login.response.headers.get('set-cookie').split(';')[0];
const second=(await req('auth/demo',{})).response.headers.get('set-cookie').split(';')[0];
const administrator=await administratorSession();
assert.equal((await req('session',undefined,customer)).value.admin,false);checks++;
assert.equal((await req('session',undefined,administrator)).value.admin,true);checks++;
const endpoints=[['admin',undefined],['admin/order',{id:'missing',status:'packed'}],['admin/stock',{id:'mango-250',stock:1,price:100}],['admin/product',{id:'mango',name:'intrusion'}],['admin/coupon',{code:'INTRUSION',percent:10,minimum:0,active:true}],['admin/email',{id:'missing'}],['admin/invoice/missing',undefined]];
for(const [path,data] of endpoints) {
  await status(path,data,'',401);
  await status(path,data,customer,403);
  await status(path,data,'avr_session=forged-session',401);
  await status(path,data,customer,403,{'oai-authenticated-user-id':'claimed-owner','X-Admin':'true','X-Role':'admin'});
}
await status('admin/stock',{id:'mango-250',stock:1,price:100},administrator,403,{Origin:'https://attacker.invalid','X-Forwarded-Host':new URL(origin).host});
await status('admin/coupon',{code:'ORIGIN',percent:10,minimum:0,active:true},administrator,403,{Origin:''});
await status('admin/stock',null,administrator,400);
await status('admin/coupon',{code:'INACTIVE',percent:10,minimum:0,active:'false'},administrator,400);
await status('admin/coupon',{code:'BOUNDS',percent:10,minimum:10000001,active:true},administrator,400);
const setup=(await status('admin',undefined,administrator,200)).value.settings;
assert.equal(setup.demo,true);assert.equal(setup.email,false);checks+=2;
const catalog=(await req('catalog')).value.products;
const variant=catalog.flatMap(p=>p.variants).find(v=>v.id==='mango-250');
const snapshot={id:variant.id,expectedStock:variant.stock,expectedPrice:variant.price};
await status('admin/stock',{...snapshot,stock:variant.stock+1,price:variant.price},administrator,200);
await status('admin/stock',{...snapshot,stock:variant.stock+10,price:variant.price},administrator,409);
await status('admin/stock',{...snapshot,id:"missing' OR 1=1 --",stock:1,price:100},administrator,404);
await status('admin/stock',{...snapshot,expectedStock:variant.stock+1,stock:variant.stock,price:variant.price},administrator,200);
const address={name:'Security test customer',phone:'9000000000',line1:'12 Sample Street',line2:'',city:'Hyderabad',state:'Telangana',pincode:'500001'};
const placed=await status('orders',{items:[{variantId:'mango-250',quantity:1}],address,method:'demo',idempotency:crypto.randomUUID()},customer,201);
const order=placed.value.order;
await setTestPayment(order.id, 'unpaid');
await status('orders/'+order.id,{},customer,400);
await status('admin/order',{id:order.id,status:'cancelled',expectedStatus:order.status,expectedTracking:''},administrator,400);
await setTestPayment(order.id, 'paid');
await status('orders/'+order.id,{},customer,400);
await status('admin/order',{id:order.id,status:'cancelled',expectedStatus:order.status,expectedTracking:''},administrator,400);
await setTestPayment(order.id, 'demo');
await status('invoice/'+order.id,undefined,second,404);
await status('orders/'+order.id,{},second,404);
const inv=await status('admin/invoice/'+order.id,undefined,administrator,200);
assert.equal(new TextDecoder().decode(inv.value.slice(0,8)),'%PDF-1.4');checks++;
await status('admin/email',{id:order.id},administrator,503);
await status('admin/order',{id:order.id,status:order.status,tracking:'REF1',expectedStatus:order.status,expectedTracking:''},administrator,200);
await status('admin/order',{id:order.id,status:'packed',tracking:'REF2',expectedStatus:order.status,expectedTracking:''},administrator,409);
await status('admin/order',{id:order.id,status:'delivered',tracking:'REF1',expectedStatus:order.status,expectedTracking:'REF1'},administrator,400);
await status('admin/order',{id:order.id,status:'packed',tracking:'REF1',expectedStatus:order.status,expectedTracking:'REF1'},administrator,200);
const product=catalog.find(p=>p.id==='mango');
await status('admin/product',{...product,name:product.name+' <script>alert(1)</script>'},administrator,200);
assert.equal((await req('catalog')).value.products.find(p=>p.id==='mango').name,product.name+' <script>alert(1)</script>');checks++;
await status('admin/product',product,administrator,200);
const large=await fetch(origin+'/api/admin/coupon',{method:'POST',headers:{Cookie:administrator,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:'BIG',payload:'x'.repeat(31000)})});assert.equal(large.status,413);checks++;
const chunked=await fetch(origin+'/api/admin/coupon',{method:'POST',headers:{Cookie:administrator,Origin:origin,'Content-Type':'application/json'},body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"payload":"'+'x'.repeat(31000)+'"}'));c.close();}}),duplex:'half'});assert.equal(chunked.status,413);checks++;
await status('auth/logout',{},customer,200);await status('orders',undefined,customer,401);
await status('auth/logout',{},administrator,200);await status('admin',undefined,administrator,401);
console.log(`PASS: ${checks} security assertions covering every admin endpoint, customer/forged-session denial, spoofed headers, origin checks, bounded inputs, stale inventory/orders, customer invoice isolation, privileged invoices, tracking-only saves, email errors, literal product text and session revocation.`);
