document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const memorialId = urlParams.get('id');

    const nameElement = document.getElementById('memorialName');
    const partsContainer = document.getElementById('partsContainer');
    const shareBtn = document.getElementById('shareBtn');
    
    const statCompleted = document.getElementById('statCompleted');
    const statAvailable = document.getElementById('statAvailable');
    const statReading = document.getElementById('statReading');
    const statKhatma = document.getElementById('statKhatma');

    const resetKhatmaBtn = document.getElementById('resetKhatmaBtn');

    const cancelModal = document.getElementById('cancelModal');
    const btnConfirmCancel = document.getElementById('btnConfirmCancel');
    const btnKeepReservation = document.getElementById('btnKeepReservation');

    const deleteModal = document.getElementById('deleteModal');
    const deleteBtn = document.getElementById('deleteBtn');
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const btnCancelDelete = document.getElementById('btnCancelDelete');

    let targetPartToCancel = null;

    const partStartWords = [
        "آلم", "سَيَقُولُ", "تِلْكَ الرُّسُلُ", "لَنْ تَنَالُوا", "وَالْمُحْصَنَاتُ", 
        "لَا يُحِبُّ اللَّهُ", "وَإِذَا سَمِعُوا", "وَلَوْ أَنَّنَا", "قَالَ الْمَلَأُ", "وَاعْلَمُوا", 
        "يَعْتَذِرُونَ", "وَمَا مِنْ دَابَّةٍ", "وَمَا أُبَرِّئُ", "رُبَمَا", "سُبْحَانَ الَّذِي", 
        "قَالَ أَلَمْ", "اقْتَرَبَ لِلنَّاسِ", "قَدْ أَفْلَحَ", "وَقَالَ الَّذِينَ", "أَمَّنْ خَلَقَ", 
        "أُتْلُ مَا أُوحِيَ", "وَمَنْ يَقْنُتْ", "وَمَا لِيَ", "فَمَنْ أَظْلَمُ", "إِلَيْهِ يُرَدُّ", 
        "حم", "قَالَ فَمَا خَطْبُكُمْ", "قَدْ سَمِعَ اللَّهُ", "تَبَارَكَ الَّذِي", "عَمَّ يَتَسَاءَلُونَ"
    ];

    if (!memorialId || typeof supabase === 'undefined') return;

    const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    let userSessionId = localStorage.getItem('quran_user_session_id');
    if (!userSessionId) {
        userSessionId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('quran_user_session_id', userSessionId);
    }

    async function fetchMemorial() {
        const { data } = await db.from('memorials').select('*').eq('id', memorialId).maybeSingle();
        if (data) {
            nameElement.innerText = data.name;
            document.title = `صدقة جارية - ${data.name}`;
            statKhatma.innerText = data.khatmas_count || 0;
            fetchParts();
        }
    }

    async function fetchParts() {
        const { data: parts } = await db.from('parts').select('*').eq('memorial_id', memorialId);
        
        const partsMap = {};
        let completedCount = 0;
        let readingCount = 0;

        if (parts) {
            parts.forEach(p => {
                partsMap[p.part_number] = p;
                if (p.status === 'completed') completedCount++;
                if (p.status === 'reading') readingCount++;
            });
        }

        statCompleted.innerText = completedCount;
        statAvailable.innerText = 30 - completedCount;
        statReading.innerText = readingCount;

        if (completedCount === 30) {
            resetKhatmaBtn.disabled = false;
            resetKhatmaBtn.className = "btn-part-action btn-blue";
            resetKhatmaBtn.style.background = "#0d7a57";
            resetKhatmaBtn.style.color = "white";
            resetKhatmaBtn.style.cursor = "pointer";
        } else {
            resetKhatmaBtn.disabled = true;
            resetKhatmaBtn.className = "btn-part-action btn-gray";
            resetKhatmaBtn.style.background = "#f0f0f0";
            resetKhatmaBtn.style.color = "#aaa";
            resetKhatmaBtn.style.cursor = "not-allowed";
        }

        partsContainer.innerHTML = '';

        for (let i = 1; i <= 30; i++) {
            const part = partsMap[i] || { part_number: i, status: 'available' };
            const isMine = part.reserved_by === userSessionId;
            
            const card = document.createElement('div');
            card.className = 'part-card-item';

            let badgeHtml = `<span class="part-badge badge-avail">🟢 متاح</span>`;
            let btnHtml = `<button class="btn-part-action btn-green" onclick="reservePart(${i})">📖 اضغط للحجز والقراءة</button>`;

            if (part.status === 'completed') {
                badgeHtml = `<span class="part-badge badge-done">✓ تمت القراءة</span>`;
                btnHtml = `<button class="btn-part-action btn-gray" disabled>مكتمل</button>`;
            } else if (part.status === 'reading') {
                if (isMine) {
                    badgeHtml = `<span class="part-badge badge-read">🔵 تقرأه الآن</span>`;
                    btnHtml = `
                        <button class="btn-part-action btn-blue" onclick="completePart('${part.id}')">✓ إتمام القراءة</button>
                        <button class="btn-part-action btn-orange" onclick="openCancelModal('${part.id}')">إلغاء الحجز</button>
                    `;
                } else {
                    badgeHtml = `<span class="part-badge badge-read">🟠 محجوز حالياً</span>`;
                    btnHtml = `<button class="btn-part-action btn-gray" disabled>غير متاح حالياً</button>`;
                }
            }

            card.innerHTML = `
                <div class="part-card-header">
                    ${badgeHtml}
                    <div class="part-number-box">
                      <div class="part-num-val">${i}</div>
                      <div class="part-num-total">30 / ${i}</div>
                    </div>
                </div>
                <div class="part-start-word">${partStartWords[i - 1]}</div>
                ${btnHtml}
            `;

            partsContainer.appendChild(card);
        }
    }

    window.reservePart = async (partNum) => {
        await db.from('parts').insert([{
            memorial_id: memorialId,
            part_number: partNum,
            status: 'reading',
            reserved_by: userSessionId,
            reserved_at: new Date().toISOString()
        }]);
        fetchParts();
    };

    window.completePart = async (partId) => {
        await db.from('parts').update({ status: 'completed' }).eq('id', partId);
        fetchParts();
    };

    window.openCancelModal = (partId) => {
        targetPartToCancel = partId;
        cancelModal.style.display = 'flex';
    };

    btnKeepReservation.onclick = () => { cancelModal.style.display = 'none'; };
    btnConfirmCancel.onclick = async () => {
        if (targetPartToCancel) {
            await db.from('parts').delete().eq('id', targetPartToCancel);
            cancelModal.style.display = 'none';
            fetchParts();
        }
    };

    if (resetKhatmaBtn) {
        resetKhatmaBtn.onclick = async () => {
            if (confirm("✨ هل أنت متأكد من بدء ختمة جديدة؟ سيتم زيادة عداد الختمات وإعادة تعيين الأجزاء لتكون متاحة للقراءة.")) {
                const { data: memData } = await db.from('memorials').select('khatmas_count').eq('id', memorialId).maybeSingle();
                const currentCount = (memData && memData.khatmas_count !== null) ? Number(memData.khatmas_count) : 0;
                const newCount = currentCount + 1;

                await db.from('memorials').update({ khatmas_count: newCount }).eq('id', memorialId);
                await db.from('parts').delete().eq('memorial_id', memorialId);

                alert("بارك الله فيكم! تم بدء ختمة جديدة بنجاح وزيادة عداد الختمات.");
                fetchMemorial();
            }
        };
    }

    deleteBtn.onclick = () => { deleteModal.style.display = 'flex'; };
    btnCancelDelete.onclick = () => { deleteModal.style.display = 'none'; };
    btnConfirmDelete.onclick = async () => {
        await db.from('parts').delete().eq('memorial_id', memorialId);
        await db.from('memorials').delete().eq('id', memorialId);
        window.location.href = 'index.html';
    };

    if (shareBtn) {
        shareBtn.onclick = () => {
            if (navigator.share) navigator.share({ title: document.title, url: window.location.href });
            else { navigator.clipboard.writeText(window.location.href); alert("تم نسخ الرابط!"); }
        };
    }

    fetchMemorial();
});
