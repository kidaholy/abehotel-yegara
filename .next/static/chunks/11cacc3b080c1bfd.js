(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,69638,e=>{"use strict";let t=(0,e.i(75254).default)("CircleCheckBig",[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);e.s(["CheckCircle",()=>t],69638)},31588,e=>{"use strict";var t=e.i(71645);function s(){let[e,s]=(0,t.useState)({isOpen:!1,options:{title:"",message:""},onConfirm:()=>{}}),[r,a]=(0,t.useState)({isOpen:!1,options:{title:"",message:""}}),i=(0,t.useCallback)(e=>new Promise(t=>{s({isOpen:!0,options:e,onConfirm:()=>{t(!0),s(e=>({...e,isOpen:!1}))}})}),[]),l=(0,t.useCallback)(e=>{a({isOpen:!0,options:e})},[]);return{confirmationState:e,confirm:i,closeConfirmation:(0,t.useCallback)(()=>{s(e=>({...e,isOpen:!1}))},[]),notificationState:r,notify:l,closeNotification:(0,t.useCallback)(()=>{a(e=>({...e,isOpen:!1}))},[])}}e.s(["useConfirmation",()=>s])},10929,27612,e=>{"use strict";var t=e.i(43476),s=e.i(71645),r=e.i(37727),a=e.i(78894),i=e.i(69638),l=e.i(52571);let o=(0,e.i(75254).default)("Trash2",[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]]);function n({isOpen:e,onClose:n,onConfirm:d,title:c,message:x,type:p="warning",confirmText:m="Confirm",cancelText:b="Cancel",icon:f}){let[u,h]=(0,s.useState)(!1);(0,s.useEffect)(()=>{if(e)h(!0);else{let e=setTimeout(()=>h(!1),300);return()=>clearTimeout(e)}},[e]);let g=(()=>{switch(p){case"danger":return{cardBg:"bg-[#1a1c1b]",iconBg:"bg-red-500/10",iconColor:"text-red-500",confirmBg:"bg-red-600 hover:bg-red-700",confirmText:"text-white",defaultIcon:(0,t.jsx)(o,{className:"w-6 h-6"})};case"warning":return{cardBg:"bg-[#1a1c1b]",iconBg:"bg-[#d4af37]/10",iconColor:"text-[#f3cf7a]",confirmBg:"bg-gradient-to-r from-[#d4af37] to-[#f3cf7a]",confirmText:"text-[#0f1110]",defaultIcon:(0,t.jsx)(a.AlertTriangle,{className:"w-6 h-6"})};case"success":return{cardBg:"bg-[#1a1c1b]",iconBg:"bg-emerald-500/10",iconColor:"text-emerald-500",confirmBg:"bg-emerald-600 hover:bg-emerald-700",confirmText:"text-white",defaultIcon:(0,t.jsx)(i.CheckCircle,{className:"w-6 h-6"})};default:return{cardBg:"bg-[#1a1c1b]",iconBg:"bg-blue-500/10",iconColor:"text-blue-400",confirmBg:"bg-blue-600 hover:bg-blue-700",confirmText:"text-white",defaultIcon:(0,t.jsx)(l.Info,{className:"w-6 h-6"})}}})();return u?(0,t.jsx)("div",{className:`fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-opacity duration-300 ${e?"opacity-100":"opacity-0"}`,children:(0,t.jsxs)("div",{className:`bg-[#1a1c1b] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl max-w-md w-full transform transition-all duration-300 ${e?"scale-100 translate-y-0":"scale-95 translate-y-4"}`,children:[(0,t.jsxs)("div",{className:"flex items-start justify-between mb-8",children:[(0,t.jsx)("div",{className:`w-16 h-16 rounded-full ${g.iconBg} flex items-center justify-center ${g.iconColor} border border-current opacity-80`,children:f||g.defaultIcon}),(0,t.jsx)("button",{onClick:()=>{"function"==typeof n&&n()},className:"w-10 h-10 bg-[#0f1110] border border-white/5 rounded-xl flex items-center justify-center font-bold text-gray-500 hover:text-white transition-colors",children:(0,t.jsx)(r.X,{className:"w-5 h-5"})})]}),(0,t.jsxs)("div",{className:"mb-10",children:[(0,t.jsx)("h2",{className:"text-2xl font-playfair italic font-bold text-[#f3cf7a] mb-4",children:c}),(0,t.jsx)("p",{className:"text-gray-400 font-bold leading-relaxed whitespace-pre-line text-sm",children:x})]}),(0,t.jsxs)("div",{className:"flex gap-4",children:[(0,t.jsx)("button",{onClick:()=>{"function"==typeof n&&n()},className:"flex-1 bg-[#0f1110] border border-white/5 text-gray-500 font-black py-4 rounded-xl hover:text-white transition-all text-[10px] uppercase tracking-widest",children:b}),(0,t.jsx)("button",{onClick:()=>{d?.(),"function"==typeof n&&n()},className:`flex-1 ${g.confirmBg} ${g.confirmText} font-black py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl text-[10px] uppercase tracking-widest`,children:m})]})]})}):null}function d({isOpen:e,onClose:a,title:o,message:n,type:d="success",autoClose:c=!0,duration:x=4e3}){let[p,m]=(0,s.useState)(!1);(0,s.useEffect)(()=>{if(e){if(m(!0),c){let e=setTimeout(()=>{"function"==typeof a&&a()},x);return()=>clearTimeout(e)}}else{let e=setTimeout(()=>m(!1),300);return()=>clearTimeout(e)}},[e,c,x,a]);let b=(()=>{switch(d){case"error":return{bg:"bg-red-500/10 border-red-500/20",iconBg:"bg-red-500/20",iconColor:"text-red-400",textColor:"text-red-100",icon:(0,t.jsx)(r.X,{className:"w-5 h-5"})};case"info":return{bg:"bg-blue-500/10 border-blue-500/20",iconBg:"bg-blue-500/20",iconColor:"text-blue-400",textColor:"text-blue-100",icon:(0,t.jsx)(l.Info,{className:"w-5 h-5"})};default:return{bg:"bg-emerald-500/10 border-emerald-500/20",iconBg:"bg-emerald-500/20",iconColor:"text-emerald-400",textColor:"text-emerald-100",icon:(0,t.jsx)(i.CheckCircle,{className:"w-5 h-5"})}}})();return p?(0,t.jsx)("div",{className:`fixed top-8 right-8 z-[200] transform transition-all duration-500 ${e?"translate-x-0 opacity-100":"translate-x-full opacity-0"}`,children:(0,t.jsxs)("div",{className:"bg-[#1a1c1b] border border-white/5 rounded-2xl p-6 shadow-2xl max-w-sm relative overflow-hidden backdrop-blur-md",children:[(0,t.jsx)("div",{className:`absolute inset-0 opacity-5 ${b.bg}`}),(0,t.jsxs)("div",{className:"flex items-start gap-4 relative z-10",children:[(0,t.jsx)("div",{className:`w-12 h-12 rounded-xl ${b.iconBg} flex items-center justify-center ${b.iconColor} flex-shrink-0 border border-current opacity-80`,children:b.icon}),(0,t.jsxs)("div",{className:"flex-1 min-w-0",children:[(0,t.jsx)("h3",{className:`font-black uppercase tracking-widest text-[10px] ${b.textColor} mb-1 opacity-60`,children:o}),(0,t.jsx)("p",{className:"text-sm font-bold text-white whitespace-pre-line",children:n})]}),(0,t.jsx)("button",{onClick:a,className:"w-8 h-8 bg-[#0f1110] border border-white/5 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-all flex-shrink-0",children:(0,t.jsx)(r.X,{className:"w-4 h-4"})})]})]})}):null}e.s(["Trash2",()=>o],27612),e.s(["ConfirmationCard",()=>n,"NotificationCard",()=>d],10929)},3116,e=>{"use strict";let t=(0,e.i(75254).default)("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);e.s(["Clock",()=>t],3116)},21293,e=>{"use strict";let t=(0,e.i(75254).default)("ConciergeBell",[["path",{d:"M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z",key:"1pvr1r"}],["path",{d:"M20 16a8 8 0 1 0-16 0",key:"1pa543"}],["path",{d:"M12 4v4",key:"1bq03y"}],["path",{d:"M10 4h4",key:"1xpv9s"}]]);e.s(["ConciergeBell",()=>t],21293)},66369,e=>{"use strict";function t(e){let t=document.createElement("iframe");Object.assign(t.style,{position:"fixed",right:"0",bottom:"0",width:"0",height:"0",border:"0"}),document.body.appendChild(t);let s=t.contentWindow?.document;s&&(s.open(),s.write(e),s.close(),setTimeout(()=>{t.contentWindow?.focus(),t.contentWindow?.print(),setTimeout(()=>document.body.removeChild(t),500)},300))}e.s(["getReceiptHTML",0,({orderNumber:e,tableNumber:t,batchNumber:s,distributions:r=[],items:a,subtotal:i,tax:l,total:o,date:n=new Date,paperWidth:d=80,appName:c="PRIME ADDIS",appTagline:x="Coffee & More",vatRate:p="0.08",floorName:m,copyType:b})=>{let f=`${d}mm`;return(100*parseFloat(p)).toFixed(0),`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page {
            margin: 0;
            size: ${f} auto;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: ${f};
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
          ${b?`
            <div class="text-center mb-2" style="font-size: 14px; border: 2px solid black; padding: 4px;">
              <span class="font-bold">${b} COPY</span>
            </div>
          `:""}
          <div class="text-center mb-4">
            <h1 style="margin:0; font-size: 20px;" class="uppercase">${c}</h1>
            <p style="margin:5px 0 0 0; font-size: 12px;">${x}</p>
            <div class="border-b border-dashed my-2"></div>
          </div>

          <div class="mb-4" style="font-size: 12px;">
            <div class="flex justify-between">
              <span>Order #:</span>
              <span class="font-bold">${e}</span>
            </div>
            <div class="flex justify-between">
              <span>Date:</span>
              <span>${n.toLocaleString()}</span>
            </div>
            <div class="flex justify-between">
              <span>Table:</span>
              <span class="font-bold">${t||"N/A"}</span>
            </div>
            ${s?`
            <div class="flex justify-between">
              <span>Batch:</span>
              <span class="font-bold">${s}</span>
            </div>
            `:""}
            ${m?`
            <div class="flex justify-between">
              <span>Floor:</span>
              <span class="font-bold">${m}</span>
            </div>
            `:""}
            ${r.length>0?`
            <div class="flex justify-between">
              <span>Distribution:</span>
              <span class="font-bold">${r.join(", ")}</span>
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
              ${a.map(e=>`
                <tr>
                  <td style="line-height: 1.2;">
                    ${e.menuId?`#${e.menuId} `:""}${e.name}<br/>
                    <small>@${e.price.toFixed(0)} ETB</small>
                  </td>
                  <td class="text-center">${e.quantity}</td>
                  <td class="text-right font-bold">${(e.quantity*e.price).toFixed(0)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div style="margin-top: 10px; font-size: 12px;">
            <div class="flex justify-between total-row font-bold">
              <span>TOTAL:</span>
              <span>${o.toFixed(0)} ETB</span>
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
  `},"printReceiptFromHTML",()=>t])},63209,e=>{"use strict";let t=(0,e.i(75254).default)("CircleAlert",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]]);e.s(["AlertCircle",()=>t],63209)},51029,e=>{"use strict";var t=e.i(43476),s=e.i(71645),r=e.i(34652),a=e.i(54483),i=e.i(38938),l=e.i(22790),o=e.i(31588),n=e.i(66369),d=e.i(10929),c=e.i(21293),x=e.i(43531),p=e.i(37727),m=e.i(3116),b=e.i(63209);function f(){let[e,f]=(0,s.useState)([]),[u,h]=(0,s.useState)(!0),{token:g}=(0,i.useAuth)(),{settings:y}=(0,l.useSettings)(),{notify:v,notificationState:w,closeNotification:j}=(0,o.useConfirmation)(),N=(0,s.useRef)(0),k=async()=>{if(g)try{let e=await fetch("/api/room-orders",{headers:{Authorization:`Bearer ${g}`}});if(e.ok){let t=await e.json();if(t.length>N.current){let e=0,t=setInterval(()=>{new Audio("/notification.mp3").play().catch(()=>{}),++e>=5&&clearInterval(t)},1500)}f(t),N.current=t.length}}catch(e){console.error("Failed to fetch room orders:",e)}finally{h(!1)}};(0,s.useEffect)(()=>{k();let e=setInterval(k,1e4);return()=>clearInterval(e)},[g]);let C=async(e,t)=>{if(!g)return;let s=e._id||e.id;try{let r=await fetch(`/api/orders/${s}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${g}`},body:JSON.stringify({status:"approve"===t?"pending":"cancelled"})});if(r.ok)v({title:"Success",message:`Order successfully ${"approve"===t?"approved to kitchen":"denied"}.`,type:"success"}),"approve"===t&&setTimeout(()=>(e=>{if("false"===y.enable_cashier_printing)return;let t=parseFloat(y.vat_rate||"0.08"),s=Number(e.totalAmount??0),r=null!=e.subtotal&&""!==e.subtotal?Number(e.subtotal):s/(1+t),a=null!=e.tax&&""!==e.tax?Number(e.tax):s-r,i=e.floorNumber?`Floor #${e.floorNumber}`:"",l=e.tableNumber||e.customerName||"Room",o=t=>{(0,n.printReceiptFromHTML)((0,n.getReceiptHTML)({orderNumber:String(e.orderNumber??""),tableNumber:l,batchNumber:e.batchNumber||void 0,distributions:e.distributions||[],items:(e.items||[]).map(e=>({menuId:e.menuId,name:e.name,quantity:Number(e.quantity??1),price:Number(e.price??0)})),subtotal:r,tax:a,total:s,date:new Date(e.createdAt),paperWidth:80,appName:y.app_name,appTagline:y.app_tagline,vatRate:y.vat_rate,floorName:i,copyType:t}))};o("KITCHEN"),setTimeout(()=>o("CUSTOMER"),1e3)})(e),400),k();else{let e=await r.json();v({title:"Error",message:e.message||"Action failed",type:"error"})}}catch(e){v({title:"Error",message:"Network error",type:"error"})}};return(0,t.jsx)(r.ProtectedRoute,{requiredRoles:["cashier","admin","super-admin"],requiredPermissions:["cashier:access"],children:(0,t.jsxs)("div",{className:"min-h-screen bg-[#0f1110] p-1 md:p-6 overflow-x-hidden text-white selection:bg-[#c5a059] selection:text-[#0f1110]",children:[(0,t.jsxs)("div",{className:"max-w-[1900px] mx-auto md:space-y-6 w-full overflow-hidden",children:[(0,t.jsx)("div",{className:"mb-4 md:mb-0",children:(0,t.jsx)(a.BentoNavbar,{})}),(0,t.jsx)("div",{className:"hidden md:block bg-[#151716] rounded-xl p-6 shadow-2xl border border-white/5",children:(0,t.jsxs)("div",{className:"flex justify-between items-center",children:[(0,t.jsxs)("div",{className:"flex items-center gap-4",children:[(0,t.jsx)("div",{className:"p-3 rounded-lg bg-[#d4af37]/10 text-[#d4af37]",children:(0,t.jsx)(c.ConciergeBell,{className:"h-8 w-8"})}),(0,t.jsxs)("div",{children:[(0,t.jsxs)("h1",{className:"text-3xl font-playfair italic font-bold text-white flex items-center gap-3",children:["Room Service ",(0,t.jsx)("span",{className:"text-[#f3cf7a]",children:"Approvals"})]}),(0,t.jsx)("p",{className:"text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1",children:"Review guest requests before kitchen preparation"})]})]}),(0,t.jsxs)("div",{className:"text-right",children:[(0,t.jsx)("div",{className:"text-xs text-gray-500 font-bold uppercase tracking-wider",children:"Pending Approvals"}),(0,t.jsx)("div",{className:"text-2xl font-black text-[#f3cf7a]",children:e.length})]})]})}),(0,t.jsx)("div",{className:"pt-6 md:pt-0",children:u?(0,t.jsx)("div",{className:"flex justify-center p-10",children:(0,t.jsx)(c.ConciergeBell,{className:"animate-pulse text-[#d4af37] h-10 w-10"})}):0===e.length?(0,t.jsxs)("div",{className:"bg-[#151716] rounded-2xl border border-white/5 p-20 flex flex-col items-center justify-center text-center",children:[(0,t.jsx)(x.Check,{className:"h-16 w-16 text-emerald-500/20 mb-4"}),(0,t.jsx)("h3",{className:"text-xl font-bold text-gray-400",children:"All Caught Up"}),(0,t.jsx)("p",{className:"text-gray-600 mt-2 text-sm",children:"No new room service requests waiting for approval."})]}):(0,t.jsx)("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",children:e.map(e=>(0,t.jsxs)("div",{className:"bg-[#151716] rounded-2xl border border-white/10 overflow-hidden shadow-xl flex flex-col",children:[(0,t.jsxs)("div",{className:"bg-[#1a1c1b] p-4 border-b border-white/5 flex items-start justify-between",children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("div",{className:"flex flex-wrap items-center gap-2 mb-1",children:[(0,t.jsx)("div",{className:"bg-[#d4af37]/10 p-1.5 rounded-lg border border-[#d4af37]/20",children:(0,t.jsx)(c.ConciergeBell,{size:16,className:"text-[#d4af37]"})}),(0,t.jsxs)("div",{children:[(0,t.jsx)("h3",{className:"text-xl font-black text-white",children:e.tableNumber}),e.floorNumber&&(0,t.jsxs)("p",{className:"text-[9px] font-black text-[#f3cf7a] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/20 uppercase tracking-widest mt-0.5 shadow-sm",children:["Floor #",e.floorNumber]})]})]}),(0,t.jsxs)("p",{className:"text-[10px] uppercase font-bold tracking-widest text-gray-500 flex items-center gap-1 mt-2",children:[(0,t.jsx)(m.Clock,{size:10})," ",new Date(e.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})]})]}),(0,t.jsxs)("div",{className:"bg-[#0f1110] px-3 py-1.5 rounded-lg border border-white/5 text-right",children:[(0,t.jsx)("p",{className:"text-[9px] uppercase font-bold tracking-widest text-gray-500 mb-0.5",children:"Total"}),(0,t.jsxs)("p",{className:"text-sm font-black text-[#f3cf7a]",children:[e.totalAmount," Br"]})]})]}),(0,t.jsxs)("div",{className:"p-5 flex-1 overflow-y-auto max-h-[300px]",children:[(0,t.jsx)("div",{className:"space-y-3",children:e.items.map((e,s)=>(0,t.jsxs)("div",{className:"flex justify-between items-start gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0",children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("p",{className:"font-bold text-gray-200 text-sm leading-tight",children:[e.quantity,"x ",e.name]}),e.notes&&(0,t.jsxs)("p",{className:"text-[10px] text-orange-400 font-bold mt-1 bg-orange-500/10 px-2 py-0.5 rounded w-fit",children:["Note: ",e.notes]})]}),(0,t.jsxs)("p",{className:"text-xs font-black text-gray-400",children:[e.price*e.quantity," Br"]})]},s))}),e.notes&&"Room Service App Order"!==e.notes&&(0,t.jsxs)("div",{className:"mt-4 bg-[#0f1110] border border-white/5 p-3 rounded-xl flex items-start gap-2 text-gray-400",children:[(0,t.jsx)(b.AlertCircle,{size:14,className:"mt-0.5 shrink-0 text-blue-400"}),(0,t.jsx)("p",{className:"text-xs",children:e.notes})]})]}),(0,t.jsxs)("div",{className:"p-4 bg-[#0f1110] border-t border-white/5 grid grid-cols-2 gap-3 shrink-0",children:[(0,t.jsxs)("button",{onClick:()=>C(e,"deny"),className:"flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-xl py-3 font-bold text-[10px] uppercase tracking-widest transition-colors",children:[(0,t.jsx)(p.X,{size:14})," Deny"]}),(0,t.jsxs)("button",{onClick:()=>C(e,"approve"),className:"flex items-center justify-center gap-2 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/30 rounded-xl py-3 font-bold text-[10px] uppercase tracking-widest transition-colors",children:[(0,t.jsx)(x.Check,{size:14})," Approve"]})]})]},e._id))})})]}),(0,t.jsx)(d.NotificationCard,{isOpen:w.isOpen,onClose:j,title:w.options.title,message:w.options.message,type:w.options.type,autoClose:w.options.autoClose,duration:w.options.duration})]})})}e.s(["default",()=>f])}]);