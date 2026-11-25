import {readApprovedPacket} from '../js/remote-approved-core.js';
const p={format:'SAHAPRO_PAID_WORK_REVIEW_V1',id:crypto.randomUUID(),approved:{confirmed:true,at:new Date().toISOString(),summary:'TEST paid-work review'},row:{source_key:'TEST-paid-contract130',date:'2026-01-01',customer:'TEST customer130',create_customer:false,vehicle:'TEST machine130',personnel:'TEST operator130',quantity:4,unit:'Sefer',work_type:'Hafriyat Nakliye',description:'TEST work130',unit_price:12.5,collection_amount:50,cash_status:'PERSONELDE',dump_site:'',raw_message:'TEST 4 trips at 12.5; 50 collected by TEST operator130'}};
try{readApprovedPacket(p);}catch{throw Error('PAID_WORK_REVIEW_NOT_SUPPORTED');}
console.log('paid work review130 contract PASS');
