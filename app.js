document.addEventListener('DOMContentLoaded', async () => {
    if (typeof supabase === 'undefined') return;
    const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    const searchInput = document.getElementById('searchInput');
    const listContainer = document.getElementById('memorialsList');
    const createForm = document.getElementById('createForm');
    const nameInput = document.getElementById('nameInput');
    const totalSiteViewsElem = document.getElementById('totalSiteViews');

    let allMemorials = [];

    // 1. جلب البيانات وتصنيفها حسب الأقل زيارة أولاً (views تصاعدياً)
    async function loadAllMemorials() {
        const { data, error } = await db
            .from('memorials')
            .select('*')
            .order('views', { ascending: true }); // الأقل مشاهدة يظهر في الأعلى

        if (!error && data) {
            allMemorials = data;
            
            // حساب إجمالي زوار الموقع لعرضه في العداد العام
            const totalViews = allMemorials.reduce((sum, item) => sum + (item.views || 0), 0);
            if (totalSiteViewsElem) {
                totalSiteViewsElem.innerText = totalViews.toLocaleString('ar-EG');
            }

            renderList(allMemorials);
        }
    }

    // 2. عرض القائمة بتنسيق الكروت المحدثة مع عداد الزوار لكل كارت
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
            card.className = "memorial-card";

            const viewsCount = item.views || 0;

            card.innerHTML = `
                <div class="memorial-info">
                    <span class="memorial-name">صدقة جارية - ${item.name}</span>
                    <span class="memorial-views">👁️ ${viewsCount} زيارة</span>
                </div>
                <span style="color:#0d7a57; font-size:18px;">‹</span>
            `;

            listContainer.appendChild(card);
        });
    }

    // 3. الفلترة المباشرة عند البحث
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            const filtered = allMemorials.filter(m => m.name.toLowerCase().includes(query));
            renderList(filtered);
        });
    }

    // 4. إضافة اسم جديد
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            if (!name) return;

            const submitBtn = createForm.querySelector('button[type="submit"]');
            submitBtn.innerText = "جاري الإضافة...";
            submitBtn.disabled = true;

            const { data, error } = await db.from('memorials').insert([{ name: name, views: 0 }]).select();

            if (!error && data && data.length > 0) {
                nameInput.value = '';
                window.location.href = `memorial.html?id=${data[0].id}`;
            } else {
                alert("حدث خطأ أثناء الإضافة، يرجى المحاولة مرة أخرى.");
                submitBtn.innerText = "إضافة";
                submitBtn.disabled = false;
            }
        });
    }

    loadAllMemorials();
});
