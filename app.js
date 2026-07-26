import { DRINK_DATABASE, CUP_SIZES } from './js/db/drinkDatabase.js';
import { Pharmacokinetics } from './js/engine/Pharmacokinetics.js';
import { ToleranceEngine } from './js/engine/ToleranceEngine.js';
import { CanvasChart } from './js/ui/CanvasChart.js';

class CircadiaApp {
    constructor() {
        this.pk = new Pharmacokinetics();
        this.tolerance = new ToleranceEngine();
        this.chart = new CanvasChart('caffeineChart');

        // State / LocalStorage
        this.drinkHistory = JSON.parse(localStorage.getItem('circadia_history')) || [];
        this.cigsPerDay = parseInt(localStorage.getItem('circadia_cigs')) || 0;
        this.toleranceKey = localStorage.getItem('circadia_tolerance') || 'MEDIUM';

        // Sigara Bırakma State'i
        this.isQuit = JSON.parse(localStorage.getItem('circadia_is_quit')) || false;
        this.daysQuit = parseInt(localStorage.getItem('circadia_days_quit')) || 1;
        this.priorCigs = parseInt(localStorage.getItem('circadia_prior_cigs')) || 20;

        // Oral Kontraseptif & RedShift State'i
        this.isOCP = JSON.parse(localStorage.getItem('circadia_is_ocp')) || false;
        this.isRedShift = JSON.parse(localStorage.getItem('circadia_red_shift')) || false;

        this.requestPersistentStorage();
        this.initUI();
        this.applyRedShift();
        this.renderAll();

        setInterval(() => this.renderAll(), 60000);
    }

    /**
     * Browser'dan Otomatik Veri Silinmesini Engelleyen İzin İsteği
     */
    requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(isPersisted => {
                console.log(`Circadia Depolama Durumu: ${isPersisted ? 'Korumalı (Persistent)' : 'Geçici'}`);
            });
        }
    }

    initUI() {
        const drinkSelect = document.getElementById('select-drink');
        if (drinkSelect && drinkSelect.children.length === 0) {
            DRINK_DATABASE.forEach(drink => {
                const opt = document.createElement('option');
                opt.value = drink.id;
                opt.textContent = `[${drink.category}] ${drink.name} (~${drink.baseCaffeineMg}mg)`;
                drinkSelect.appendChild(opt);
            });
        }

        const cupSelect = document.getElementById('select-cup');
        if (cupSelect && cupSelect.children.length === 0) {
            Object.keys(CUP_SIZES).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = CUP_SIZES[key].name;
                cupSelect.appendChild(opt);
            });
        }

        // Input Değerlerini Yükle
        const inputCigs = document.getElementById('input-cigs');
        if (inputCigs) inputCigs.value = this.cigsPerDay;

        const selectTol = document.getElementById('select-tolerance');
        if (selectTol) selectTol.value = this.toleranceKey;

        const chkQuit = document.getElementById('chk-quit');
        if (chkQuit) chkQuit.checked = this.isQuit;

        const inputDaysQuit = document.getElementById('input-days-quit');
        if (inputDaysQuit) inputDaysQuit.value = this.daysQuit;

        const inputPriorCigs = document.getElementById('input-prior-cigs');
        if (inputPriorCigs) inputPriorCigs.value = this.priorCigs;

        const chkOCP = document.getElementById('chk-ocp');
        if (chkOCP) chkOCP.checked = this.isOCP;

        this.updateQuitBoxVisibility();

        // Event Listeners
        const btnAdd = document.getElementById('btn-add-drink');
        if (btnAdd) btnAdd.addEventListener('click', () => this.addDrink());

        const btnRedShift = document.getElementById('btn-red-shift');
        if (btnRedShift) {
            btnRedShift.addEventListener('click', () => {
                this.isRedShift = !this.isRedShift;
                localStorage.setItem('circadia_red_shift', this.isRedShift);
                this.applyRedShift();
            });
        }

        // YEDEKLEME EVENT LISTENERS
        const btnExport = document.getElementById('btn-export');
        if (btnExport) btnExport.addEventListener('click', () => this.exportData());

        const btnImportTrigger = document.getElementById('btn-import-trigger');
        const inputImport = document.getElementById('input-import');
        if (btnImportTrigger && inputImport) {
            btnImportTrigger.addEventListener('click', () => inputImport.click());
            inputImport.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.importData(e.target.files[0]);
                }
            });
        }

        if (inputCigs) {
            inputCigs.addEventListener('input', (e) => {
                this.cigsPerDay = parseInt(e.target.value) || 0;
                localStorage.setItem('circadia_cigs', this.cigsPerDay);
                this.updateQuitBoxVisibility();
                this.renderAll();
            });
        }

        if (chkQuit) {
            chkQuit.addEventListener('change', (e) => {
                this.isQuit = e.target.checked;
                localStorage.setItem('circadia_is_quit', this.isQuit);
                this.updateQuitBoxVisibility();
                this.renderAll();
            });
        }

        if (inputDaysQuit) {
            inputDaysQuit.addEventListener('input', (e) => {
                this.daysQuit = parseInt(e.target.value) || 1;
                localStorage.setItem('circadia_days_quit', this.daysQuit);
                this.renderAll();
            });
        }

        if (inputPriorCigs) {
            inputPriorCigs.addEventListener('input', (e) => {
                this.priorCigs = parseInt(e.target.value) || 20;
                localStorage.setItem('circadia_prior_cigs', this.priorCigs);
                this.renderAll();
            });
        }

        if (chkOCP) {
            chkOCP.addEventListener('change', (e) => {
                this.isOCP = e.target.checked;
                localStorage.setItem('circadia_is_ocp', this.isOCP);
                this.renderAll();
            });
        }

        if (selectTol) {
            selectTol.addEventListener('change', (e) => {
                this.toleranceKey = e.target.value;
                this.tolerance.setTolerance(this.toleranceKey);
                localStorage.setItem('circadia_tolerance', this.toleranceKey);
                this.renderAll();
            });
        }
    }

    /**
     * Tüm verileri ve profili JSON dosyası olarak indirir
     */
    exportData() {
        const payload = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            history: this.drinkHistory,
            cigsPerDay: this.cigsPerDay,
            toleranceKey: this.toleranceKey,
            isQuit: this.isQuit,
            daysQuit: this.daysQuit,
            priorCigs: this.priorCigs,
            isOCP: this.isOCP
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `circadia_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Yüklenen JSON yedek dosyasını doğrular ve LocalStorage'a yazar
     */
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data.history)) {
                    localStorage.setItem('circadia_history', JSON.stringify(data.history));
                    if (data.cigsPerDay !== undefined) localStorage.setItem('circadia_cigs', data.cigsPerDay);
                    if (data.toleranceKey) localStorage.setItem('circadia_tolerance', data.toleranceKey);
                    if (data.isQuit !== undefined) localStorage.setItem('circadia_is_quit', data.isQuit);
                    if (data.daysQuit !== undefined) localStorage.setItem('circadia_days_quit', data.daysQuit);
                    if (data.priorCigs !== undefined) localStorage.setItem('circadia_prior_cigs', data.priorCigs);
                    if (data.isOCP !== undefined) localStorage.setItem('circadia_is_ocp', data.isOCP);

                    alert('✅ Veriler başarıyla geri yüklendi!');
                    location.reload();
                } else {
                    throw new Error('Geçersiz dosya biçimi.');
                }
            } catch (err) {
                alert('⚠️ Geçersiz veya bozuk yedek dosyası!');
            }
        };
        reader.readAsText(file);
    }

    applyRedShift() {
        if (this.isRedShift) {
            document.body.classList.add('red-shift');
        } else {
            document.body.classList.remove('red-shift');
        }
        this.renderAll();
    }

    updateQuitBoxVisibility() {
        const quitContainer = document.getElementById('quit-smoking-container');
        const quitDetails = document.getElementById('quit-details');

        if (this.cigsPerDay === 0) {
            if (quitContainer) quitContainer.style.display = 'block';
            if (quitDetails) quitDetails.style.display = this.isQuit ? 'block' : 'none';
        } else {
            if (quitContainer) quitContainer.style.display = 'none';
            if (quitDetails) quitDetails.style.display = 'none';
        }
    }

    addDrink() {
        const drinkId = document.getElementById('select-drink').value;
        const cupKey = document.getElementById('select-cup').value;

        const drinkObj = DRINK_DATABASE.find(d => d.id === drinkId);
        const cupObj = CUP_SIZES[cupKey];

        let finalCaffeine = drinkObj.baseCaffeineMg;
        if (drinkObj.isVolumeScaled) {
            finalCaffeine = Math.round(finalCaffeine * cupObj.multiplier);
        }

        const newRecord = {
            id: Date.now(),
            name: drinkObj.name,
            caffeineMg: finalCaffeine,
            timestamp: Date.now()
        };

        this.drinkHistory.push(newRecord);
        localStorage.setItem('circadia_history', JSON.stringify(this.drinkHistory));
        this.renderAll();
    }

    deleteDrink(id) {
        this.drinkHistory = this.drinkHistory.filter(item => item.id !== id);
        localStorage.setItem('circadia_history', JSON.stringify(this.drinkHistory));
        this.renderAll();
    }

    renderAll() {
        const now = Date.now();
        const activeCaffeine = Math.round(
            this.pk.getTotalActiveCaffeine(this.drinkHistory, now, this.cigsPerDay, this.isQuit, this.daysQuit, this.priorCigs, this.isOCP)
        );

        // 1. Sağlık Uyarısı
        const healthStatus = this.tolerance.getHealthStatus(activeCaffeine);
        const bannerElem = document.getElementById('health-banner');
        const titleElem = document.getElementById('health-banner-title');
        const msgElem = document.getElementById('health-banner-msg');

        if (bannerElem && healthStatus) {
            if (healthStatus.level !== 'SAFE') {
                bannerElem.style.display = 'block';
                bannerElem.style.backgroundColor = healthStatus.bgColor;
                bannerElem.style.borderColor = healthStatus.borderColor;

                if (titleElem) {
                    titleElem.textContent = healthStatus.title;
                    titleElem.style.color = healthStatus.color;
                }

                if (msgElem) {
                    msgElem.textContent = healthStatus.message;
                    msgElem.style.color = '#f1f5f9';
                }
            } else {
                bannerElem.style.display = 'none';
            }
        }

        // 2. Metrikler
        const activeElem = document.getElementById('active-caffeine');
        if (activeElem) activeElem.textContent = `${activeCaffeine} mg`;

        const stimStatus = this.tolerance.getStimulationStatus(activeCaffeine);
        const stimElem = document.getElementById('stimulation-status');
        if (stimElem) {
            stimElem.textContent = stimStatus.isStimulated
                ? `⚡ Aktif Odak Modu (Eşik: ${stimStatus.thresholdMg}mg)`
                : `🌙 Eşik Altında (Odak için +${stimStatus.deficitMg}mg gerekli)`;
        }

        // 3. Uyku Tahmini
        const sleepTimeMs = this.pk.estimateTimeToThreshold(this.drinkHistory, 20, this.cigsPerDay, this.isQuit, this.daysQuit, this.priorCigs, this.isOCP);
        const sleepDate = new Date(sleepTimeMs);
        const sleepElem = document.getElementById('sleep-time');
        if (sleepElem) {
            sleepElem.textContent = `${sleepDate.getHours().toString().padStart(2, '0')}:${sleepDate.getMinutes().toString().padStart(2, '0')}`;
        }

        // 4. CYP1A2 Durum Yazısı
        const effHalfLife = this.pk.calculateEffectiveHalfLife(this.cigsPerDay, this.isQuit, this.daysQuit, this.priorCigs, this.isOCP).toFixed(1);
        const cypElem = document.getElementById('cyp-status');
        if (cypElem) {
            let ocpTag = this.isOCP ? ' + OCP (2x)' : '';
            if (this.cigsPerDay === 0 && this.isQuit && this.daysQuit < 14) {
                cypElem.textContent = `🚭 Sigara Bırakıldı (Gün ${this.daysQuit}/14): Yarı Ömür ${effHalfLife} Saat${ocpTag}`;
            } else {
                cypElem.textContent = `CYP1A2: Yarı Ömür ${effHalfLife} Saat (${this.cigsPerDay} Sigara/Gün)${ocpTag}`;
            }
        }

        // 5. Grafik Çizimi
        if (this.chart) {
            this.chart.render(this.pk, this.drinkHistory, this.cigsPerDay, this.tolerance.currentTolerance.thresholdMg, 20, this.isQuit, this.daysQuit, this.priorCigs, this.isOCP);
        }

        // 6. Geçmiş Listesi
        const historyList = document.getElementById('history-list');
        if (historyList) {
            if (this.drinkHistory.length === 0) {
                historyList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Henüz içecek eklenmedi.</span>';
                return;
            }

            historyList.innerHTML = [...this.drinkHistory].reverse().map(item => {
                const d = new Date(item.timestamp);
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                return `
                    <div class="history-item">
                        <div class="history-info">
                            <span class="history-time">${timeStr}</span>
                            <span>${item.name}</span>
                        </div>
                        <div class="history-actions">
                            <strong>+${item.caffeineMg} mg</strong>
                            <button class="btn-delete" data-id="${item.id}" title="Kaydı Sil">✕</button>
                        </div>
                    </div>
                `;
            }).join('');

            historyList.querySelectorAll('.btn-delete').forEach(btn => {
                btn.onclick = (e) => {
                    const id = parseInt(e.currentTarget.getAttribute('data-id'));
                    this.deleteDrink(id);
                };
            });
        }
    }
}

window.addEventListener('DOMContentLoaded', () => new CircadiaApp());