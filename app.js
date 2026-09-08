document.addEventListener('DOMContentLoaded', async () => {
    if (typeof supabase === 'undefined') return;
    const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    const searchInput = document.getElementById('searchInput');
    const listContainer = document.getElementById('memorialsList');
    const createForm = document.getElementById('createForm');
    const nameInput = document.getElementById('nameInput');

    let allMemorials = [];

    // 1. جلب وجلب البيانات الحالية من داتابيز Supabase
    async function loadAllMemorials() {
        const { data, error } = await db.from('memorials').select('*').order('created_at', { ascending: false });
        if (!error && data) {
            allMemorials = data;
            renderList(allMemorials);
        }
    }

    // 2. عرض القائمة بتنسيق كروت أنيقة
    function renderList(items) {
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (items.length === 0) {
            listContainer.innerHTML = `<p style="text-align:center; color:#888; font-size:14px; margin-top:15px;">لا توجد صفحات حالياً</p>`;
            return;
        }

        items.forEach(item => {
            const card = document.createElement('a');
            card.href = `memorial.html?id=${item.id}`;
            card.style.cssText = "display:block; background:white; padding:16px; margin-bottom:12px; border-radius:16px; text-decoration:none; color:#1f2937; box-shadow:0 3px 8px rgba(0,0,0,0.03); border:1.5px solid #d4ebd2; font-weight:700; font-size:15px;";
            card.innerText = `صدقة جارية - ${item.name}`;
            listContainer.appendChild(card);
        });
    }

    // 3. فلترة الأسماء فورياً عند الكتابة في شريط البحث
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            const filtered = allMemorials.filter(m => m.name.toLowerCase().includes(query));
            renderList(filtered);
        });
    }

    // 4. تنفيذ إضافة اسم جديد
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            if (!name) return;

            const submitBtn = createForm.querySelector('button[type="submit"]');
            submitBtn.innerText = "جاري الإضافة...";
            submitBtn.disabled = true;

            const { data, error } = await db.from('memorials').insert([{ name: name }]).select();

            if (!error && data && data.length > 0) {
                nameInput.value = '';
                // التوجه المباشر للصفحة الجديدة التي تم إنشاؤها
                window.location.href = `memorial.html?id=${data[0].id}`;
            } else {
                alert("حدث خطأ أثناء الإضافة، يرجى المحاولة مرة أخرى.");
                submitBtn.innerText = "+ إنشاء صفحة جديدة";
                submitBtn.disabled = false;
            }
        });
    }

    loadAllMemorials();
});
