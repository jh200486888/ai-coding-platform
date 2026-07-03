import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const wh = await req.json();
  try {
    const msg = '[\u6d4b\u8bd5] AI\u7f16\u7a0b\u5e73\u53f0\u901a\u77e5\u6d4b\u8bd5 - \u914d\u7f6e\u6b63\u786e\uff01';
    if (wh.type === 'dingtalk') {
      let url = wh.url;
      if (wh.secret) {
        const crypto = await import('crypto');
        const ts = Date.now();
        const sig = crypto.createHmac('sha256', wh.secret).update(ts+'\n'+wh.secret).digest('base64');
        url = url+'&timestamp='+ts+'&sign='+encodeURIComponent(sig);
      }
      const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({msgtype:'text',text:{content:msg}}) });
      return res.ok ? NextResponse.json({success:true}) : NextResponse.json({success:false,error:await res.text()});
    }
    if (wh.type === 'feishu') {
      const res = await fetch(wh.url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({msg_type:'text',content:{text:msg}}) });
      return res.ok ? NextResponse.json({success:true}) : NextResponse.json({success:false,error:await res.text()});
    }
    const res = await fetch(wh.url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title:'Test',content:msg}) });
    return res.ok ? NextResponse.json({success:true}) : NextResponse.json({success:false,error:'HTTP '+res.status});
  } catch(e:any) { return NextResponse.json({success:false,error:e.message}); }
}
