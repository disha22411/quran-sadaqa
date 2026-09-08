document.addEventListener('DOMContentLoaded', async () => {
    if (typeof supabase === 'undefined') return;
    const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    const urlParams = new URLSearchParams(window.location.search);
    const memorialId = urlParams.get('id');

    if (!memorialId) {
        window.location.href = 'index.html';
        return;
    }

    const memorialNameElem = document.getElementById('memorialName');
    const statCompletedElem = document.getElementById('statCompleted');
    const statAvailableElem = document.getElementById('statAvailable');
    const statReadingElem = document.getElementById('statReading');
    const statKhatmaElem = document.getElementById('statKhatma');
    const partsContainer = document.getElementById('partsContainer');
    const shareBtn = document.getElementById('shareBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    const cancelModal = document.getElementById('cancelModal');
    const btnConfirmCancel = document.getElementById('btnConfirmCancel');
    const btnKeepReservation = document.getElementById('btnKeepReservation');

    const deleteModal = document.getElementById('deleteModal');
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const btnCancelDelete = document.getElementById('btnCancelDelete');

    let currentMemorial = null;
    let partsData = [];
    let selectedPartToCancel = null;

    const juzStartWords = [
        "آلم", "سَيَقُولُ", "تِلْكَ الرُّسُلُ", "لَنْ تَنَالُوا", "وَالْمُحْصَنَاتُ",
        "لَا يُحِبُّ اللَّهُ", "وَإِذَا سَمِعُوا", "وَلَوْ أَنَّنَا", "قَالَ الْمَلَأُ", "وَاعْلَمُوا",
        "يَعْتَذِرُونَ", "وَمَا مِنْ دَابَّةٍ", "وَمَا أُبَرِّئُ", "رُبَمَا", "سُبْحَانَ الَّذِي",
        "قَالَ أَلَمْ", "اقْتَرَبَ لِلنَّاسِ", "قَدْ أَفْلَحَ", "وَقَالَ الَّذِينَ", "أَمَّنْ خَلَقَ",
        "أُتْلُ مَا أُوحِيَ", "وَمَنْ يَقْنُتْ", "وَمَالِيَ", "فَمَنْ أَظْلَمُ", "إِلَيْهِ يُرَدُّ",
        "حم", "قَالَ فَمَا خَطْبُكُمْ", "قَدْ سَمِعَ اللَّهُ", "تَبَارَكَ الَّذِي", "عَمَّ يَتَسَاءَلُونَ"
    ];

    async function initPage() {
        await db.rpc('increment_views', { row_id: memorialId }).catch(() => {
            db.from('memorials').select('views').eq('id', memorialId).single().then(({ data }) => {
                if (data) {
                    db.from('memorials').update({ views: (data.views || 0) + 1 }).eq('id', memorialId);
                }
            });
        });
        loadMemorialData();
    }

    async function loadMemorialData() {
        const { data, error } = await db.from('memorials').select('*').eq('id', memorialId).single();
        if (error || !data) {
            alert('لم يتم العثور على الصفحة');
            window.location.href = 'index.html';
            return;
        }
        currentMemorial = data;
        memorialNameElem.innerText = currentMemorial.name;
        loadParts();
    }

    async function loadParts() {
        const { data, error } = await db
            .from('parts')
            .select('*')
            .eq('memorial_id', memorialId)
            .order('part_number', { ascending: true });

        if (error) return;

        if (!data || data.length === 0) {
            await createInitialParts();
            return;
        }

        partsData = data;
        updateStats();
        renderParts();
    }

    async function createInitialParts() {
        const initialArray = [];
        for (let i = 1; i <= 30; i++) {
            initialArray.push({
                memorial_id: memorialId,
                part_number: i,
                status: 'available',
                reader_name: null
            });
        }
        await db.from('parts').insert(initialArray);
        loadParts();
    }

    async function updateStats() {
        const completed = partsData.filter(p => p.status === 'done').length;
        const available = partsData.filter(p => p.status === 'available').length;
        const totalReads = currentMemorial.total_reads || 0;
        const khatmas = currentMemorial.khatmas_count || 0;

        statCompletedElem.innerText = completed;
        statAvailableElem.innerText = available;
        statReadingElem.innerText = totalReads;
        statKhatmaElem.innerText = khatmas;

        if (completed === 30) {
            setTimeout(async () => {
                alert(`✨ بفضل الله تم إتمام الختمة رقم (${khatmas + 1}) لـ (${currentMemorial.name})! جزاكم الله خيراً. تم فتح الأجزاء لبدء الختمة التالية.`);
                await resetKhatmaForNewRound(khatmas + 1);
            }, 500);
        }
    }

    async function resetKhatmaForNewRound(newKhatmaCount) {
        await db.from('memorials').update({
            khatmas_count: newKhatmaCount
        }).eq('id', memorialId);

        await db.from('parts').update({
            status: 'available',
            reader_name: null
        }).eq('memorial_id', memorialId);

        loadMemorialData();
    }

    function renderParts() {
        partsContainer.innerHTML = '';

        partsData.forEach(part => {
            const card = document.createElement('div');
            card.className = 'part-card-item';

            let badgeHTML = '';
            let actionBtnHTML = '';

            if (part.status === 'available') {
                badgeHTML = `<span class="part-badge badge-avail">☉ متاح</span>`;
                actionBtnHTML = `<button class="btn-part-action btn-green" onclick="handleReserve(${part.id})">📖 حجز الجزء للقراءة</button>`;
            } else if (part.status === 'reading') {
                badgeHTML = `<span class="part-badge badge-read">⏳ جاري القراءة</span>`;
                actionBtnHTML = `
                    <button class="btn-part-action btn-blue" onclick="handleComplete(${part.id})">✓ تمت القراءة</button>
                    <button class="btn-part-action btn-orange" onclick="openCancelModal(${part.id})">إلغاء الحجز</button>
                `;
            } else if (part.status === 'done') {
                badgeHTML = `<span class="part-badge badge-done">✓ تمت القراءة</span>`;
                actionBtnHTML = `<button class="btn-part-action btn-gray" disabled>تمت قراءته في هذه الختمة</button>`;
            }

            card.innerHTML = `
                <div class="part-card-header">
                    ${badgeHTML}
                    <div class="part-number-box">
                        <span class="part-num-val">الجزء ${part.part_number}</span>
                        <span class="part-num-total">/ 30</span>
                    </div>
                </div>
                <div class="part-start-word">﴿ ${juzStartWords[part.part_number - 1]} ﴾</div>
                ${actionBtnHTML}
            `;

            partsContainer.appendChild(card);
        });
    }

    window.handleReserve = async (partId) => {
        await db.from('parts').update({ status: 'reading' }).eq('id', partId);
        loadParts();
    };

    window.handleComplete = async (partId) => {
        await db.from('parts').update({ status: 'done' }).eq('id', partId);

        const newTotalReads = (currentMemorial.total_reads || 0) + 1;
        await db.from('memorials').update({ total_reads: newTotalReads }).eq('id', memorialId);
        currentMemorial.total_reads = newTotalReads;

        loadParts();
    };

    window.openCancelModal = (partId) => {
        selectedPartToCancel = partId;
        cancelModal.style.display = 'flex';
    };

    btnConfirmCancel.addEventListener('click', async () => {
        if (selectedPartToCancel) {
            await db.from('parts').update({ status: 'available' }).eq('id', selectedPartToCancel);
            cancelModal.style.display = 'none';
            selectedPartToCancel = null;
            loadParts();
        }
    });

    btnKeepReservation.addEventListener('click', () => {
        cancelModal.style.display = 'none';
        selectedPartToCancel = null;
    });

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: `صدقة جارية - ${currentMemorial?.name}`,
                    text: `شارك معنا في قراءة القرآن الكريم واهدِ الثواب لـ ${currentMemorial?.name}:`,
                    url: window.location.href
                });
            } else {
                navigator.clipboard.writeText(window.location.href);
                alert('تم نسخ رابط الصفحة بنجاح، يمكنك مشاركته الآن!');
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteModal.style.display = 'flex');
    }
    if (btnCancelDelete) {
        btnCancelDelete.addEventListener('click', () => deleteModal.style.display = 'none');
    }
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', async () => {
            await db.from('parts').delete().eq('memorial_id', memorialId);
            await db.from('memorials').delete().eq('id', memorialId);
            window.location.href = 'index.html';
        });
    }

    initPage();
});
