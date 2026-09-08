const {createClient}=supabase;
const db=createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);

async function init(){
  if(window.SUPABASE_URL.includes("ضع_")){show("أكمل إعداد قاعدة البيانات أولًا.");return}
  const {data,error}=await db.auth.getSession();
  if(!data.session) await db.auth.signInAnonymously();
  loadMemorials();
}
function show(t){$("message").textContent=t;$("message").classList.remove("hidden")}
async function loadMemorials(){
  const {data,error}=await db.from("memorial_summary").select("*").order("created_at",{ascending:false});
  if(error){show(error.message);return}
  $("memorialCount").textContent=`عدد الصدقات الجارية: ${data.length}`;
  $("memorials").innerHTML=data.map(x=>`
    <article class="card">
      <h3>🕊️ ${esc(x.name)}</h3>
      <div class="card-stats">
        <div class="stat"><b>${x.parts_read}</b><span>أجزاء مقروءة</span></div>
        <div class="stat"><b>${x.total_readings}</b><span>إجمالي القراءات</span></div>
        <div class="stat"><b>${x.khatmas}</b><span>ختمات كاملة</span></div>
      </div>
      <a class="primary open" href="memorial.html?id=${encodeURIComponent(x.id)}">قراءة القرآن على روحه</a>
    </article>`).join("") || `<div class="card">لا توجد صدقات جارية حتى الآن.</div>`;
}
$("addBtn").onclick=()=>$("addModal").classList.remove("hidden");
$("closeAdd").onclick=()=>$("addModal").classList.add("hidden");
$("addForm").onsubmit=async e=>{
 e.preventDefault(); const name=$("nameInput").value.trim(); if(!name)return;
 const {data,error}=await db.rpc("create_memorial",{p_name:name});
 if(error){show(error.message);return}
 $("addModal").classList.add("hidden"); $("nameInput").value="";
 location.href=`memorial.html?id=${encodeURIComponent(data)}`;
};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
init();