document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const memorialId = urlParams.get('id');

    // مطابقة الـ IDs تماماً مع ملف memorial.html
    const nameElement = document.getElementById('memorialName');
    const partsContainer = document.getElementById('parts');
    const shareBtn = document.getElementById('shareBtn');

    if (!memorialId) {
        if (nameElement) nameElement.innerText = "خطأ: لم يتم تحديد المتوفى";
        return;
    }

    if (typeof supabase === 'undefined' || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        if (nameElement) nameElement.innerText = "خطأ في الاتصال بالخادم";
        return;
    }

    const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    let userSessionId = localStorage.getItem('quran_user_session_id');
    if (!userSessionId) {
        userSessionId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('quran_user_session_id', userSessionId);
    }

    // جلب بيانات المتوفى
    async function fetchMemorial() {
        try {
            const { data, error } = await db
                .from('memorials')
                .select('*')
                .eq('id', memorialId)
                .maybeSingle();

            if (error || !data) {
                if (nameElement) nameElement.innerText = "لم يتم العثور على الاسم";
                return;
            }

            if (nameElement) nameElement.innerText = data.name || "متوفى";
            document.title = `صدقة جارية - ${data.name}`;

            fetchParts();
        } catch (e) {
            if (nameElement) nameElement.innerText = "حدث خطأ في التحميل";
        }
    }

    // جلب وعرض الأجزاء الـ 30
    async function fetchParts() {
        if (!partsContainer) return;
        
        try {
            const { data: parts } = await db
                .from('parts')
                .select('*')
                .eq('memorial_id', memorialId);

            const partsMap = {};
            if (parts) {
                parts.forEach(p => partsMap[p.part_number] = p);
            }

            partsContainer.innerHTML = '';
            
            // إنشاء الـ 30 جزء
            for (let i = 1; i <= 30; i++) {
                const part = partsMap[i] || { part_number: i, status: 'available' };
                const card = document.createElement('div');
                
                card.style.cssText = "border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:8px; text-align:center; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.05);";

                let statusLabel = "متاح للقراءة";
                let btnLabel = "احجز الجزء";
                let btnColor = "#2e7d32";
                let isDisabled = false;

                if (part.status === 'completed') {
                    statusLabel = "تمت القراءة ✓";
                    btnLabel = "مكتمل";
                    btnColor = "#757575";
                    isDisabled = true;
                } else if (part.status === 'reading') {
                    if (part.reserved_by === userSessionId) {
                        statusLabel = "تقوم بقراءته الآن";
                        btnLabel = "إتمام القراءة";
                        btnColor = "#1565c0";
                    } else {
                        statusLabel = "محجوز حالياً";
                        btnLabel = "غير متاح";
                        btnColor = "#e65100";
                        isDisabled = true;
                    }
                }

                card.innerHTML = `
                    <h3 style="margin:0 0 10px 0;">الجزء ${i}</h3>
                    <p style="color:#666; font-size:14px; margin-bottom:12px;">${statusLabel}</p>
                    <button ${isDisabled ? 'disabled' : ''} id="btn-part-${i}" 
                        style="background:${btnColor}; color:#fff; border:none; padding:10px 15px; border-radius:6px; cursor:pointer; width:100%; font-weight:bold;">
                        ${btnLabel}
                    </button>
                `;

                partsContainer.appendChild(card);

                const btn = card.querySelector(`#btn-part-${i}`);
                if (btn && !isDisabled) {
                    btn.onclick = () => handlePartClick(part, i);
                }
            }
        } catch (e) {
            partsContainer.innerHTML = "<p style='color:red;'>خطأ في تحميل الأجزاء</p>";
        }
    }

    async function handlePartClick(part, partNum) {
        if (!part.status || part.status === 'available') {
            await db.from('parts').insert([{
                memorial_id: memorialId,
                part_number: partNum,
                status: 'reading',
                reserved_by: userSessionId,
                reserved_at: new Date().toISOString()
            }]);
        } else if (part.status === 'reading' && part.reserved_by === userSessionId) {
            await db.from('parts').update({ status: 'completed' }).eq('id', part.id);
        }
        fetchParts();
    }

    // تفعيل زر المشاركة
    if (shareBtn) {
        shareBtn.onclick = () => {
            if (navigator.share) {
                navigator.share({
                    title: document.title,
                    url: window.location.href
                }).catch(() => {});
            } else {
                navigator.clipboard.writeText(window.location.href);
                alert("تم نسخ رابط الصفحة بنجاح!");
            }
        };
    }

    fetchMemorial();
});
