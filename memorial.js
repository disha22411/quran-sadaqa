document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const memorialId = urlParams.get('id');

    const nameElement = document.getElementById('memorial-name');
    const partsContainer = document.getElementById('parts-container');
    const shareBtn = document.getElementById('share-btn');

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

    async function loadMemorialData() {
        try {
            const { data: memorial, error } = await db
                .from('memorials')
                .select('*')
                .eq('id', memorialId)
                .single();

            if (error || !memorial) {
                if (nameElement) nameElement.innerText = "لم يتم العثور على اسم المتوفى";
                return;
            }

            const personName = memorial.name || memorial.title || "متوفى";
            if (nameElement) nameElement.innerText = personName;

            await loadParts();
        } catch (err) {
            if (nameElement) nameElement.innerText = "حدث خطأ في تحميل البيانات";
        }
    }

    async function loadParts() {
        if (!partsContainer) return;
        partsContainer.innerHTML = '<p style="text-align:center; width:100%; grid-column: 1/-1;">جاري تحميل الأجزاء...</p>';

        try {
            let { data: parts } = await db
                .from('parts')
                .select('*')
                .eq('memorial_id', memorialId);

            if (!parts) parts = [];
            renderParts(parts);
        } catch (err) {
            partsContainer.innerHTML = '<p style="text-align:center; color:red; grid-column: 1/-1;">حدث خطأ أثناء جلب الأجزاء.</p>';
        }
    }

    function renderParts(parts) {
        partsContainer.innerHTML = '';
        const partsMap = {};
        parts.forEach(p => partsMap[p.part_number] = p);

        for (let i = 1; i <= 30; i++) {
            const part = partsMap[i] || { part_number: i, status: 'available' };
            const card = document.createElement('div');
            
            card.style.cssText = "border: 1px solid #e0e0e0; padding: 15px; margin: 8px; border-radius: 8px; text-align: center; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";

            let statusText = "متاح للقراءة";
            let btnText = "احجز الجزء";
            let btnColor = "#2e7d32";
            let disabled = "";

            if (part.status === 'completed') {
                statusText = "تمت القراءة ✓";
                btnText = "مكتمل";
                btnColor = "#757575";
                disabled = "disabled";
            } else if (part.status === 'reading') {
                if (part.reserved_by === userSessionId) {
                    statusText = "تقوم بقراءته الآن";
                    btnText = "إتمام القراءة";
                    btnColor = "#1565c0";
                } else {
                    statusText = "قيد القراءة حالياً";
                    btnText = "محجوز";
                    btnColor = "#e65100";
                    disabled = "disabled";
                }
            }

            card.innerHTML = `
                <h3 style="margin:0 0 10px 0;">الجزء ${i}</h3>
                <p style="font-size: 14px; color: #666; margin-bottom: 12px;">${statusText}</p>
                <button ${disabled} onclick="handleAction('${part.id || ''}', ${i}, '${part.status || 'available'}', '${part.reserved_by || ''}')" 
                    style="background-color: ${btnColor}; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; width: 100%;">
                    ${btnText}
                </button>
            `;
            partsContainer.appendChild(card);
        }
    }

    window.handleAction = async function(partId, partNumber, currentStatus, reservedBy) {
        if (currentStatus === 'available' || !partId) {
            await db.from('parts').insert([{
                memorial_id: memorialId,
                part_number: partNumber,
                status: 'reading',
                reserved_by: userSessionId,
                reserved_at: new Date().toISOString()
            }]);
        } else if (currentStatus === 'reading' && reservedBy === userSessionId) {
            await db.from('parts').update({ status: 'completed' }).eq('id', partId);
        }
        loadParts();
    };

    loadMemorialData();
});
