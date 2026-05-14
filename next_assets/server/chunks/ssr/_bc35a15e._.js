module.exports=[41710,a=>{"use strict";let b=(0,a.i(70106).default)("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);a.s(["Clock",()=>b],41710)},89e3,a=>{"use strict";let b=(0,a.i(70106).default)("ConciergeBell",[["path",{d:"M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z",key:"1pvr1r"}],["path",{d:"M20 16a8 8 0 1 0-16 0",key:"1pa543"}],["path",{d:"M12 4v4",key:"1bq03y"}],["path",{d:"M10 4h4",key:"1xpv9s"}]]);a.s(["ConciergeBell",()=>b],89e3)},50451,a=>{"use strict";function b(a){let b=document.createElement("iframe");Object.assign(b.style,{position:"fixed",right:"0",bottom:"0",width:"0",height:"0",border:"0"}),document.body.appendChild(b);let c=b.contentWindow?.document;c&&(c.open(),c.write(a),c.close(),setTimeout(()=>{b.contentWindow?.focus(),b.contentWindow?.print(),setTimeout(()=>document.body.removeChild(b),500)},300))}a.s(["getReceiptHTML",0,({orderNumber:a,tableNumber:b,batchNumber:c,distributions:d=[],items:e,subtotal:f,tax:g,total:h,date:i=new Date,paperWidth:j=80,appName:k="PRIME ADDIS",appTagline:l="Coffee & More",vatRate:m="0.08",floorName:n,copyType:o})=>{let p=`${j}mm`;return(100*parseFloat(m)).toFixed(0),`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page {
            margin: 0;
            size: ${p} auto;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: ${p};
            height: auto !important;
            overflow: hidden !important;
            font-family: 'Courier New', Courier, monospace;
            background: white;
            color: black;
          }
          .receipt {
            padding: 4mm;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .uppercase { text-transform: uppercase; }
          .mb-1 { margin-bottom: 0.25rem; }
          .mb-4 { margin-bottom: 1rem; }
          .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
          .border-b { border-bottom: 1px solid black; }
          .border-dashed { border-style: dashed; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 4px 0; font-size: 12px; }
          .total-row { font-size: 16px; margin-top: 8px; border-top: 1px solid black; padding-top: 8px; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          ${o?`
            <div class="text-center mb-2" style="font-size: 14px; border: 2px solid black; padding: 4px;">
              <span class="font-bold">${o} COPY</span>
            </div>
          `:""}
          <div class="text-center mb-4">
            <h1 style="margin:0; font-size: 20px;" class="uppercase">${k}</h1>
            <p style="margin:5px 0 0 0; font-size: 12px;">${l}</p>
            <div class="border-b border-dashed my-2"></div>
          </div>

          <div class="mb-4" style="font-size: 12px;">
            <div class="flex justify-between">
              <span>Order #:</span>
              <span class="font-bold">${a}</span>
            </div>
            <div class="flex justify-between">
              <span>Date:</span>
              <span>${i.toLocaleString()}</span>
            </div>
            <div class="flex justify-between">
              <span>Table:</span>
              <span class="font-bold">${b||"N/A"}</span>
            </div>
            ${c?`
            <div class="flex justify-between">
              <span>Batch:</span>
              <span class="font-bold">${c}</span>
            </div>
            `:""}
            ${n?`
            <div class="flex justify-between">
              <span>Floor:</span>
              <span class="font-bold">${n}</span>
            </div>
            `:""}
            ${d.length>0?`
            <div class="flex justify-between">
              <span>Distribution:</span>
              <span class="font-bold">${d.join(", ")}</span>
            </div>
            `:""}
          </div>

          <div class="border-b border-dashed my-2"></div>

          <table>
            <thead>
              <tr class="border-b">
                <th class="text-left">Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${e.map(a=>`
                <tr>
                  <td style="line-height: 1.2;">
                    ${a.menuId?`#${a.menuId} `:""}${a.name}<br/>
                    <small>@${a.price.toFixed(0)} ETB</small>
                  </td>
                  <td class="text-center">${a.quantity}</td>
                  <td class="text-right font-bold">${(a.quantity*a.price).toFixed(0)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div style="margin-top: 10px; font-size: 12px;">
            <div class="flex justify-between total-row font-bold">
              <span>TOTAL:</span>
              <span>${h.toFixed(0)} ETB</span>
            </div>
          </div>

          <div class="footer">
            <div class="border-b border-dashed mb-4"></div>
            <p class="font-bold uppercase mb-1">Thank You!</p>
            <p>Please visit us again</p>
            <p style="margin-top: 15px; opacity: 0.5;">Powered by Prime Addis POS</p>
          </div>
          <div style="height: 30px;"></div>
        </div>
      </body>
    </html>
  `},"printReceiptFromHTML",()=>b])},92e3,a=>{"use strict";let b=(0,a.i(70106).default)("CircleAlert",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]]);a.s(["AlertCircle",()=>b],92e3)},18451,a=>{"use strict";var b=a.i(87924),c=a.i(72131),d=a.i(4667),e=a.i(47288),f=a.i(19817),g=a.i(62553),h=a.i(82662),i=a.i(50451),j=a.i(32423),k=a.i(89e3),l=a.i(33441),m=a.i(33508),n=a.i(41710),o=a.i(92e3);function p(){let[a,p]=(0,c.useState)([]),[q,r]=(0,c.useState)(!0),{token:s}=(0,f.useAuth)(),{settings:t}=(0,g.useSettings)(),{notify:u,notificationState:v,closeNotification:w}=(0,h.useConfirmation)(),x=(0,c.useRef)(0),y=async()=>{if(s)try{let a=await fetch("/api/room-orders",{headers:{Authorization:`Bearer ${s}`}});if(a.ok){let b=await a.json();if(b.length>x.current){let a=0,b=setInterval(()=>{new Audio("/notification.mp3").play().catch(()=>{}),++a>=5&&clearInterval(b)},1500)}p(b),x.current=b.length}}catch(a){console.error("Failed to fetch room orders:",a)}finally{r(!1)}};(0,c.useEffect)(()=>{y();let a=setInterval(y,1e4);return()=>clearInterval(a)},[s]);let z=async(a,b)=>{if(!s)return;let c=a._id||a.id;try{let d=await fetch(`/api/orders/${c}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s}`},body:JSON.stringify({status:"approve"===b?"pending":"cancelled"})});if(d.ok)u({title:"Success",message:`Order successfully ${"approve"===b?"approved to kitchen":"denied"}.`,type:"success"}),"approve"===b&&setTimeout(()=>(a=>{if("false"===t.enable_cashier_printing)return;let b=parseFloat(t.vat_rate||"0.08"),c=Number(a.totalAmount??0),d=null!=a.subtotal&&""!==a.subtotal?Number(a.subtotal):c/(1+b),e=null!=a.tax&&""!==a.tax?Number(a.tax):c-d,f=a.floorNumber?`Floor #${a.floorNumber}`:"",g=a.tableNumber||a.customerName||"Room",h=b=>{(0,i.printReceiptFromHTML)((0,i.getReceiptHTML)({orderNumber:String(a.orderNumber??""),tableNumber:g,batchNumber:a.batchNumber||void 0,distributions:a.distributions||[],items:(a.items||[]).map(a=>({menuId:a.menuId,name:a.name,quantity:Number(a.quantity??1),price:Number(a.price??0)})),subtotal:d,tax:e,total:c,date:new Date(a.createdAt),paperWidth:80,appName:t.app_name,appTagline:t.app_tagline,vatRate:t.vat_rate,floorName:f,copyType:b}))};h("KITCHEN"),setTimeout(()=>h("CUSTOMER"),1e3)})(a),400),y();else{let a=await d.json();u({title:"Error",message:a.message||"Action failed",type:"error"})}}catch(a){u({title:"Error",message:"Network error",type:"error"})}};return(0,b.jsx)(d.ProtectedRoute,{requiredRoles:["cashier","admin","super-admin"],requiredPermissions:["cashier:access"],children:(0,b.jsxs)("div",{className:"min-h-screen bg-[#0f1110] p-1 md:p-6 overflow-x-hidden text-white selection:bg-[#c5a059] selection:text-[#0f1110]",children:[(0,b.jsxs)("div",{className:"max-w-[1900px] mx-auto md:space-y-6 w-full overflow-hidden",children:[(0,b.jsx)("div",{className:"mb-4 md:mb-0",children:(0,b.jsx)(e.BentoNavbar,{})}),(0,b.jsx)("div",{className:"hidden md:block bg-[#151716] rounded-xl p-6 shadow-2xl border border-white/5",children:(0,b.jsxs)("div",{className:"flex justify-between items-center",children:[(0,b.jsxs)("div",{className:"flex items-center gap-4",children:[(0,b.jsx)("div",{className:"p-3 rounded-lg bg-[#d4af37]/10 text-[#d4af37]",children:(0,b.jsx)(k.ConciergeBell,{className:"h-8 w-8"})}),(0,b.jsxs)("div",{children:[(0,b.jsxs)("h1",{className:"text-3xl font-playfair italic font-bold text-white flex items-center gap-3",children:["Room Service ",(0,b.jsx)("span",{className:"text-[#f3cf7a]",children:"Approvals"})]}),(0,b.jsx)("p",{className:"text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1",children:"Review guest requests before kitchen preparation"})]})]}),(0,b.jsxs)("div",{className:"text-right",children:[(0,b.jsx)("div",{className:"text-xs text-gray-500 font-bold uppercase tracking-wider",children:"Pending Approvals"}),(0,b.jsx)("div",{className:"text-2xl font-black text-[#f3cf7a]",children:a.length})]})]})}),(0,b.jsx)("div",{className:"pt-6 md:pt-0",children:q?(0,b.jsx)("div",{className:"flex justify-center p-10",children:(0,b.jsx)(k.ConciergeBell,{className:"animate-pulse text-[#d4af37] h-10 w-10"})}):0===a.length?(0,b.jsxs)("div",{className:"bg-[#151716] rounded-2xl border border-white/5 p-20 flex flex-col items-center justify-center text-center",children:[(0,b.jsx)(l.Check,{className:"h-16 w-16 text-emerald-500/20 mb-4"}),(0,b.jsx)("h3",{className:"text-xl font-bold text-gray-400",children:"All Caught Up"}),(0,b.jsx)("p",{className:"text-gray-600 mt-2 text-sm",children:"No new room service requests waiting for approval."})]}):(0,b.jsx)("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",children:a.map(a=>(0,b.jsxs)("div",{className:"bg-[#151716] rounded-2xl border border-white/10 overflow-hidden shadow-xl flex flex-col",children:[(0,b.jsxs)("div",{className:"bg-[#1a1c1b] p-4 border-b border-white/5 flex items-start justify-between",children:[(0,b.jsxs)("div",{children:[(0,b.jsxs)("div",{className:"flex flex-wrap items-center gap-2 mb-1",children:[(0,b.jsx)("div",{className:"bg-[#d4af37]/10 p-1.5 rounded-lg border border-[#d4af37]/20",children:(0,b.jsx)(k.ConciergeBell,{size:16,className:"text-[#d4af37]"})}),(0,b.jsxs)("div",{children:[(0,b.jsx)("h3",{className:"text-xl font-black text-white",children:a.tableNumber}),a.floorNumber&&(0,b.jsxs)("p",{className:"text-[9px] font-black text-[#f3cf7a] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/20 uppercase tracking-widest mt-0.5 shadow-sm",children:["Floor #",a.floorNumber]})]})]}),(0,b.jsxs)("p",{className:"text-[10px] uppercase font-bold tracking-widest text-gray-500 flex items-center gap-1 mt-2",children:[(0,b.jsx)(n.Clock,{size:10})," ",new Date(a.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})]})]}),(0,b.jsxs)("div",{className:"bg-[#0f1110] px-3 py-1.5 rounded-lg border border-white/5 text-right",children:[(0,b.jsx)("p",{className:"text-[9px] uppercase font-bold tracking-widest text-gray-500 mb-0.5",children:"Total"}),(0,b.jsxs)("p",{className:"text-sm font-black text-[#f3cf7a]",children:[a.totalAmount," Br"]})]})]}),(0,b.jsxs)("div",{className:"p-5 flex-1 overflow-y-auto max-h-[300px]",children:[(0,b.jsx)("div",{className:"space-y-3",children:a.items.map((a,c)=>(0,b.jsxs)("div",{className:"flex justify-between items-start gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0",children:[(0,b.jsxs)("div",{children:[(0,b.jsxs)("p",{className:"font-bold text-gray-200 text-sm leading-tight",children:[a.quantity,"x ",a.name]}),a.notes&&(0,b.jsxs)("p",{className:"text-[10px] text-orange-400 font-bold mt-1 bg-orange-500/10 px-2 py-0.5 rounded w-fit",children:["Note: ",a.notes]})]}),(0,b.jsxs)("p",{className:"text-xs font-black text-gray-400",children:[a.price*a.quantity," Br"]})]},c))}),a.notes&&"Room Service App Order"!==a.notes&&(0,b.jsxs)("div",{className:"mt-4 bg-[#0f1110] border border-white/5 p-3 rounded-xl flex items-start gap-2 text-gray-400",children:[(0,b.jsx)(o.AlertCircle,{size:14,className:"mt-0.5 shrink-0 text-blue-400"}),(0,b.jsx)("p",{className:"text-xs",children:a.notes})]})]}),(0,b.jsxs)("div",{className:"p-4 bg-[#0f1110] border-t border-white/5 grid grid-cols-2 gap-3 shrink-0",children:[(0,b.jsxs)("button",{onClick:()=>z(a,"deny"),className:"flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-xl py-3 font-bold text-[10px] uppercase tracking-widest transition-colors",children:[(0,b.jsx)(m.X,{size:14})," Deny"]}),(0,b.jsxs)("button",{onClick:()=>z(a,"approve"),className:"flex items-center justify-center gap-2 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/30 rounded-xl py-3 font-bold text-[10px] uppercase tracking-widest transition-colors",children:[(0,b.jsx)(l.Check,{size:14})," Approve"]})]})]},a._id))})})]}),(0,b.jsx)(j.NotificationCard,{isOpen:v.isOpen,onClose:w,title:v.options.title,message:v.options.message,type:v.options.type,autoClose:v.options.autoClose,duration:v.options.duration})]})})}a.s(["default",()=>p])}];

//# sourceMappingURL=_bc35a15e._.js.map