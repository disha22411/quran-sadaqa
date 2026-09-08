document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const memorialId = urlParams.get('id');

    const nameElement = document.getElementById('memorial-name');
    const partsContainer = document.getElementById('parts-container');
    const shareBtn = document.getElementById('share-btn');

    const totalPartsEl = document.getElementById('stat-total');
    const completedPartsEl = document.getElementById('stat-completed');
    const readingPartsEl = document.getElementById('stat-reading');
    const availablePartsEl = document.getElementById('stat-available');

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
        userSessionId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('quran_user_session_id', userSessionId);
    }

    async function loadMemorialData() {
        try {
            const { data: memorial, error: memError } = await db
                .from('memorials')
                .select('*')
                .eq('id', memorialId)
                .single();

            if (memError || !memorial) {
                if (nameElement) nameElement.innerText = "لم يتم العثور على المتوفى";
                return;
            }

            if (nameElement) nameElement.innerText = memorial.name || memorial.title || "متوفى";
            document.title = `صدقة جارية عن روح ${memorial.name || 'متوفى'}`;

            if (shareBtn) {
                shareBtn.onclick = () => {
                    if (navigator.share) {
                        navigator.share({
                            title: `صدقة جارية - ${memorial.name}`,
                            text: `شارك في ختم القرآن الكريم كصدقة جارية على روح ${memorial.name}`,
                            url: window.location.href
                        }).catch(() => {});
                    } else {
                        navigator.clipboard.writeText(window.location.href);
                        alert("تم نسخ رابط الصفحة بنجاح!");
                    }
                };
            }

            await loadParts();
        } catch (err) {
            if (nameElement) nameElement.innerText = "حدث خطأ غير متوقع";
        }
    }

    async function loadParts() {
        if (!partsContainer) return;
        partsContainer.innerHTML = '<p style="text-align:center; width:100%;">جاري تحميل أجزاء القرآن...</p>';

        try {
            let { data: parts } = await db
                .from('parts')
                .select('*')
                .eq('memorial_id', memorialId)
                .order('part_number', { ascending: true });

            if (!parts) parts = [];
            
            renderParts(parts);
            updateStats(parts);
        } catch (err) {
            partsContainer.innerHTML = '<p style="text-align:center; color:red;">حدث خطأ أثناء تحميل الأجزاء.</p>';
        }
    }

    function renderParts(parts) {
        partsContainer.innerHTML = '';
        const partsMap = {};
        parts.forEach(p => partsMap[p.part_number] = p);

        for (let i = 1; i <= 30; i++) {
            const part = partsMap[i] || { part_number: i, status: 'available' };
            const card = document.createElement('div');
            card.className = `part-card status-${part.status || 'available'}`;

            let isExpired = false;
            if (part.status === 'reading' && part.reserved_at) {
                const reservedTime = new Date(part.reserved_at).getTime();
                const now = new Date().getTime();
                if (now - reservedTime > 5 * 60 * 60 * 1000) isExpired = true;
            }

            const currentStatus = isExpired ? 'available' : (part.status || 'available');
            const isMyReservation = part.reserved_by === userSessionId;

            let statusText = 'متاح';
            let statusClass = 'badge-available';
            let actionButtons = '';

            if (currentStatus === 'completed') {
                statusText = 'تمت القراءة بنجاح ✓';
                statusClass = 'badge-completed';
                actionButtons = `<button disabled class="btn-disabled">مكتمل</button>`;
            } else if (currentStatus === 'reading' && !isExpired) {
                if (isMyReservation) {
                    statusText = 'أنت تقرأ هذا الجزء الآن';
                    statusClass = 'badge-my-reading';
                    actionButtons = `
                        <button class="btn-complete" onclick="completePart('${part.id}', ${part.part_number})">إتمام القراءة</button>
                        <button class="btn-cancel" onclick="cancelReservation('${part.id}', ${part.part_number})">إلغاء الحجز</button>
                    `;
                } else {
                    statusText = 'قيد القراءة الآن';
                    statusClass = 'badge-reading';
                    actionButtons = `<button disabled class="btn-disabled">محجوز حالياً</button>`;
                }
            } else {
                actionButtons = `<button class="btn-reserve" onclick="reservePart('${part.id}', ${part.part_number})">احجز الجزء</button>`;
            }

            card.innerHTML = `
                <div class="part-header">
                    <h3>الجزء ${part.part_number}</h3>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="part-actions">${actionButtons}</div>
            `;
            partsContainer.appendChild(card);
        }
    }

    function updateStats(parts) {
        let completed = 0, reading = 0, available = 0;
        parts.forEach(p => {
            if (p.status === 'completed') completed++;
            else if (p.status === 'reading') reading++;
            else available++;
        });
        if (parts.length < 30) available += (30 - parts.length);

        if (totalPartsEl) totalPartsEl.innerText = '30';
        if (completedPartsEl) completedPartsEl.innerText = completed;
        if (readingPartsEl) readingPartsEl.innerText = reading;
        if (availablePartsEl) availablePartsEl.innerText = available;
    }

    window.reservePart = async function(partId, partNumber) {
        if (!partId || partId === 'undefined' || partId === 'null') {
            const { error } = await db.from('parts').insert([{
                memorial_id: memorialId,
                part_number: partNumber,
                status: 'reading',
                reserved_at: new Date().toISOString(),
                reserved_by: userSessionId
            }]);
            if (!error) loadParts();
            return;
        }
        const { error } = await db.from('parts').update({
            status: 'reading',
            reserved_at: new Date().toISOString(),
            reserved_by: userSessionId
        }).eq('id', partId);
        if (!error) loadParts();
    };

    window.cancelReservation = async function(partId, partNumber) {
        if (!confirm("إلغاء الحجز؟")) return;
        const { error } = await db.from('parts').update({ status: 'available', reserved_at: null, reserved_by: null }).eq('id', partId);
        if (!error) loadParts();
    };

    window.completePart = async function(partId, partNumber) {
        if (!confirm("تأكيد إتمام القراءة؟")) return;
        const { error } = await db.from('parts').update({ status: 'completed' }).eq('id', partId);
        if (!error) loadParts();
    };

    loadMemorialData();
});
