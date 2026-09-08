const {createClient}=supabase;
const db=createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const id=new URLSearchParams(location.search).get("id");
const $=x=>document.getElementById(x);
let me=null,timer=null,confirmAction=null;

async function init(){
 if(!id){$("memorialName").textContent="غير موجود";return}
 if(window.SUPABASE_URL.includes("ضع_")){show("أكمل إعداد قاعدة البيانات أولًا.");return}
 let s=await db.auth.getSession(); if(!s.data.session) await db.auth.signInAnonymously();
 me=(await db.auth.getSession()).data.session.user.id;
 await load();
 db.channel("parts-"+id).on("postgres_changes",{event:"*",schema:"public",table:"quran_parts",filter:`memorial_id=eq.${id}`},load).subscribe();
}
async function load(){
 const {data,error}=await db.from("memorial_summary").select("*").eq("id",id).single();
 if(error){show("الصدقة الجارية غير موجودة.");return}
 $("memorialName").textContent=data.name;
 $("stats").innerHTML=`
 <div class="stat"><b>${data.parts_read}</b><span>أجزاء مقروءة</span></div>
 <div class="stat"><b>${data.total_readings}</b><span>إجمالي القراءات</span></div>
 <div class="stat"><b>${data.khatmas}</b><span>ختمات كاملة</span></div>`;
 const r=await db.from("quran_parts").select("*").eq("memorial_id",id).order("part_number");
 if(r.error){show(r.error.message);return}
 render(r.data);
}
function render(parts){
 $("parts").innerHTML=parts.map(p=>{
  const mine=p.reserved_by===me && p.reserved_until;
  const active=p.reserved_until && new Date(p.reserved_until)>new Date();
  if(p.reserved_until && !active) return partCard(p,"expired");
  if(mine) return `
   <article class="part"><div class="part-top"><span class="part-name">الجزء ${p.part_number} — ${p.part_name}</span><span class="badge busy">أنت تقرأ</span></div>
   <div class="part-count">تمت قراءته ${p.reading_count} مرة</div>
   <div class="countdown" id="cd-${p.part_number}">متبقي على الحجز: --:--:--</div>
   <div class="actions"><button class="primary" onclick="completePart('${p.id}')">تمت القراءة</button><button class="secondary" onclick="cancelPart('${p.id}')">إلغاء الحجز</button></div></article>`;
  if(active) return `
   <article class="part"><div class="part-top"><span class="part-name">الجزء ${p.part_number} — ${p.part_name}</span><span class="badge busy">قيد القراءة 🟡</span></div>
   <div class="part-count">تمت قراءته ${p.reading_count} مرة</div></article>`;
  return `
   <article class="part"><div class="part-top"><span class="part-name">الجزء ${p.part_number} — ${p.part_name}</span><span class="badge">متاح 🟢</span></div>
   <div class="part-count">تمت قراءته ${p.reading_count} مرة</div><button class="primary" onclick="reservePart('${p.id}')">حجز الجزء</button></article>`;
 }).join("");
 startCountdown(parts);
}
function partCard(p){return `<article class="part"><div class="part-top"><span class="part-name">الجزء ${p.part_number} — ${p.part_name}</span><span class="badge">متاح 🟢</span></div><div class="part-count">تمت قراءته ${p.reading_count} مرة</div><button class="primary" onclick="reservePart('${p.id}')">حجز الجزء</button></article>`}
async function reservePart(partId){
 const {data,error}=await db.rpc("reserve_part",{p_part_id:partId});
 if(error){show(error.message);return}
 if(!data){show("الجزء لم يعد متاحًا، اختر جزءًا آخر.");return}
 show("تم حجز الجزء لك ❤️ أمامك 5 ساعات لإتمام القراءة.");
 load();
}
function ask(title,text,yes,fn){$("confirmTitle").textContent=title;$("confirmText").textContent=text;$("confirmYes").textContent=yes;confirmAction=fn;$("confirmModal").classList.remove("hidden")}
$("confirmNo").onclick=()=>$("confirmModal").classList.add("hidden");
$("confirmYes").onclick=async()=>{const fn=confirmAction;$("confirmModal").classList.add("hidden");await fn()};
function cancelPart(partId){ask("⚠️ تنبيه","هل أنت متأكد أنك تريد إلغاء الحجز؟ من فضلك لا تقم بإلغاء حجز شخص آخر، لأن إلغاء الحجز سيجعل الجزء متاحًا لشخص آخر وقد يسبب لخبطة في القراءة.","نعم، إلغاء الحجز",async()=>{const {error}=await db.rpc("cancel_reservation",{p_part_id:partId});if(error)show(error.message);else{show("تم إلغاء الحجز وإتاحة الجزء.");load()}})}
function completePart(partId){ask("📖 هل أتممت قراءة هذا الجزء بالفعل؟","إذا كنت قد أتممت القراءة، اضغط نعم، وإذا كنت لم تنتهِ بعد، اختر لا وسيظل الجزء محجوزًا لك.","نعم، تمت القراءة",async()=>{const {error}=await db.rpc("complete_part",{p_part_id:partId});if(error)show(error.message);else{show("جزاك الله خيرًا ❤️ تم تسجيل القراءة.");load()}})}
function startCountdown(parts){
 clearInterval(timer); timer=setInterval(()=>{
  parts.forEach(p=>{if(p.reserved_by!==me||!p.reserved_until)return;const el=$(`cd-${p.part_number}`);if(!el)return;let ms=new Date(p.reserved_until)-new Date();if(ms<=0){el.textContent="انتهى الحجز، يتم إتاحة الجزء...";load();return}const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4),s=Math.floor(ms%6e4/1e3);el.textContent=`متبقي على الحجز: ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`})
 },1000)
}
$("shareBtn").onclick=async()=>{try{await navigator.clipboard.writeText(location.href);show("تم نسخ رابط الصدقة الجارية ❤️")}catch{show("انسخ رابط الصفحة من شريط المتصفح وشاركه مع من تريد.")}}
function show(t){$("message").textContent=t;$("message").classList.remove("hidden");setTimeout(()=>$("message").classList.add("hidden"),5000)}
init();