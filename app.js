/**
 * @file app.js / CircadiaApp.js
 * @description Circadia PWA Ana Uygulama Sınıfı. State yönetimi, event listener'lar,
 * ikili uyku simülasyonu, GlassSelect entegrasyonu ve render döngüsünü yönetir.
 */

import { DRINK_DATABASE, CUP_SIZES } from './js/db/drinkDatabase.js';
import { Pharmacokinetics } from './js/engine/Pharmacokinetics.js';
import { ToleranceEngine } from './js/engine/ToleranceEngine.js';
import { CanvasChart } from './js/ui/CanvasChart.js';
import { GlassSelect } from './js/ui/GlassSelect.js';

class CircadiaApp {
    constructor() {
        this.pk = new Pharmacokinetics();
        this.tolerance = new ToleranceEngine();
        this.chart = new CanvasChart('caffeineChart');

        // LocalStorage State Yükleme
        this.drinkHistory = JSON.parse(localStorage.getItem('circadia_history')) || [];
        this.cigsPerDay = parseInt(localStorage.getItem('circadia_cigs'), 10) || 0;
        this.toleranceKey = localStorage.getItem('circadia_tolerance') || 'MEDIUM';

        // Sigara Bırakma State'i
        this.isQuit = JSON.parse(localStorage.getItem('circadia_is_quit')) || false;
        this.daysQuit = parseInt(localStorage.getItem('circadia_days_quit'), 10) || 1;
        this.priorCigs = parseInt(localStorage.getItem('circadia_prior_cigs'), 10) || 20;

        // Oral Kontraseptif & RedShift (Gece Modu) State'i
        this.isOCP = JSON.parse(localStorage.getItem('circadia_is_ocp')) || false;
        this.isRedShift = JSON.parse(localStorage.getItem('circadia_red_shift')) || false;

        // Tolerans seviyesini ilklendir
        this.tolerance.setTolerance(this.toleranceKey);

        this.requestPersistentStorage();
        this.initUI();
        this.applyRedShift();
        this.renderAll();

        // Her dakika verileri canlı güncelle
        setInterval(() => this.renderAll(), 60000);

        // Ekran genişliği değiştiğinde grafiği otomatik re-render et
        window.addEventListener('resize', () => {
            if (this.chart) {
                const didResize = this.chart.resizeCanvas();
                if (didResize) {
                    this.renderAll();
                }
            }
        });
    }

    /**
     * Depolama verilerinin taranıp silinmesini engeller.
     */
    requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(isPersisted => {
                console.log(`Circadia Depolama Koruması: ${isPersisted ? 'Aktif (Persistent)' : 'Geçici'}`);
            });
        }
    }

    initUI() {
        const drinkSelect = document.getElementById('select-drink');
        const cupSelect = document.getElementById('select-cup');

        // 1. İçecek Listesini Kategorili Doldur
        if (drinkSelect && drinkSelect.children.length === 0) {
            const categories = [...new Set(DRINK_DATABASE.map(d => d.category))];
            categories.forEach(cat => {
                const group = document.createElement('optgroup');
                group.label = `--- ${cat.toUpperCase()} ---`;
                DRINK_DATABASE.filter(d => d.category === cat).forEach(drink => {
                    const opt = document.createElement('option');
                    opt.value = drink.id;
                    opt.textContent = `${drink.name} (~${drink.baseCaffeineMg} mg)`;
                    group.appendChild(opt);
                });
                drinkSelect.appendChild(group);
            });
        }

        // 2. Bardak Boyutlarını Doldur
        if (cupSelect && cupSelect.children.length === 0) {
            Object.keys(CUP_SIZES).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = CUP_SIZES[key].name;
                cupSelect.appendChild(opt);
            });
        }

        // 3. Form Inputlarına Kayıtlı Değerleri Yükle
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

        // 4. Native Select Elemanlarını Material 3 Glassmorphism Dropdown Bileşenlerine Dönüştür
        this.glassDrinkSelect = new GlassSelect('select-drink', () => this.renderAll());
        this.glassCupSelect = new GlassSelect('select-cup', () => this.renderAll());
        this.glassTolSelect = new GlassSelect('select-tolerance', (val) => {
            this.toleranceKey = val;
            this.tolerance.setTolerance(this.toleranceKey);
            localStorage.setItem('circadia_tolerance', this.toleranceKey);
            this.renderAll();
        });

        // 5. Event Listeners
        const btnAdd = document.getElementById('btn-add-drink');
        if (btnAdd) btnAdd.addEventListener('click', () => this.addDrink());

        const btnRedShift = document.getElementById('btn-red-shift');
        if (btnRedShift) {
            btnRedShift.addEventListener('click', () => {
                this.isRedShift = !this.isRedShift;
                localStorage.setItem('circadia_red_shift', JSON.stringify(this.isRedShift));
                this.applyRedShift();
            });
        }

        // Yedekleme ve Geri Yükleme
        const btnExport = document.getElementById('btn-export');
        if (btnExport) btnExport.addEventListener('click', () => this.exportData());

        const btnImportTrigger = document.getElementById('btn-import-trigger');
        const inputImport = document.getElementById('input-import');
        if (btnImportTrigger && inputImport) {
            btnImportTrigger.addEventListener('click', () => inputImport.click());
            inputImport.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.importData(e.target.files[0]);
                }
            });
        }

        // Form Girdi Dinleyicileri
        if (inputCigs) {
            inputCigs.addEventListener('input', (e) => {
                this.cigsPerDay = parseInt(e.target.value, 10) || 0;
                localStorage.setItem('circadia_cigs', this.cigsPerDay);
                this.updateQuitBoxVisibility();
                this.renderAll();
            });
        }

        if (chkQuit) {
            chkQuit.addEventListener('change', (e) => {
                this.isQuit = e.target.checked;
                localStorage.setItem('circadia_is_quit', JSON.stringify(this.isQuit));
                this.updateQuitBoxVisibility();
                this.renderAll();
            });
        }

        if (inputDaysQuit) {
            inputDaysQuit.addEventListener('input', (e) => {
                this.daysQuit = parseInt(e.target.value, 10) || 1;
                localStorage.setItem('circadia_days_quit', this.daysQuit);
                this.renderAll();
            });
        }

        if (inputPriorCigs) {
            inputPriorCigs.addEventListener('input', (e) => {
                this.priorCigs = parseInt(e.target.value, 10) || 20;
                localStorage.setItem('circadia_prior_cigs', this.priorCigs);
                this.renderAll();
            });
        }

        if (chkOCP) {
            chkOCP.addEventListener('change', (e) => {
                this.isOCP = e.target.checked;
                localStorage.setItem('circadia_is_ocp', JSON.stringify(this.isOCP));
                this.renderAll();
            });
        }
    }

    exportData() {
        const payload = {
            version: '1.4',
            exportDate: new Date().toISOString(),
            history: this.drinkHistory,
            cigsPerDay: this.cigsPerDay,
            toleranceKey: this.toleranceKey,
            isQuit: this.isQuit,
            daysQuit: this.daysQuit,
            priorCigs: this.priorCigs,
            isOCP: this.isOCP,
            isRedShift: this.isRedShift
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `circadia_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data.history)) {
                    localStorage.setItem('circadia_history', JSON.stringify(data.history));
                    if (data.cigsPerDay !== undefined) localStorage.setItem('circadia_cigs', data.cigsPerDay);
                    if (data.toleranceKey) localStorage.setItem('circadia_tolerance', data.toleranceKey);
                    if (data.isQuit !== undefined) localStorage.setItem('circadia_is_quit', JSON.stringify(data.isQuit));
                    if (data.daysQuit !== undefined) localStorage.setItem('circadia_days_quit', data.daysQuit);
                    if (data.priorCigs !== undefined) localStorage.setItem('circadia_prior_cigs', data.priorCigs);
                    if (data.isOCP !== undefined) localStorage.setItem('circadia_is_ocp', JSON.stringify(data.isOCP));
                    if (data.isRedShift !== undefined) localStorage.setItem('circadia_red_shift', JSON.stringify(data.isRedShift));

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
        const metaTheme = document.getElementById('meta-theme-color');
        if (this.isRedShift) {
            document.body.classList.add('red-shift');
            if (metaTheme) metaTheme.setAttribute('content', '#000000');
        } else {
            document.body.classList.remove('red-shift');
            if (metaTheme) metaTheme.setAttribute('content', '#0b0f17');
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
        const drinkSelect = document.getElementById('select-drink');
        const cupSelect = document.getElementById('select-cup');

        if (!drinkSelect || !cupSelect) return;

        const drinkObj = DRINK_DATABASE.find(d => d.id === drinkSelect.value);
        const cupObj = CUP_SIZES[cupSelect.value];

        if (!drinkObj || !cupObj) return;

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

        // Aktif Kafein Yükü
        const activeCaffeine = Math.round(
            this.pk.getTotalActiveCaffeine(
                this.drinkHistory,
                now,
                this.cigsPerDay,
                this.isQuit,
                this.daysQuit,
                this.priorCigs,
                this.isOCP
            )
        );

        // 1. Sağlık Uyarısı Pankartı
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
                    msgElem.style.color = 'var(--text-main)';
                }
            } else {
                bannerElem.style.display = 'none';
            }
        }

        // 2. Metrikler & Uyarılma Durumu
        const activeElem = document.getElementById('active-caffeine');
        if (activeElem) activeElem.textContent = `${activeCaffeine} mg`;

        const stimStatus = this.tolerance.getStimulationStatus(activeCaffeine);
        const stimElem = document.getElementById('stimulation-status');
        if (stimElem) {
            stimElem.textContent = stimStatus.isStimulated
                ? `⚡ Aktif Odak Modu (Eşik: ${stimStatus.thresholdMg} mg)`
                : `🌙 Eşik Altında (Odak için +${stimStatus.deficitMg} mg gerekli)`;
        }

        // 3. İkili Uyku Tahmini (A: Mevcut vs B: Seçili İçecek İçilirse)
        const sleepTimeMs = this.pk.estimateTimeToThreshold(
            this.drinkHistory,
            20,
            this.cigsPerDay,
            this.isQuit,
            this.daysQuit,
            this.priorCigs,
            this.isOCP
        );

        const sleepElem = document.getElementById('sleep-time');
        if (sleepElem) {
            if (sleepTimeMs <= now) {
                sleepElem.textContent = 'Şu An';
            } else {
                const sleepDate = new Date(sleepTimeMs);
                const h = sleepDate.getHours().toString().padStart(2, '0');
                const m = sleepDate.getMinutes().toString().padStart(2, '0');
                sleepElem.textContent = `${h}:${m}`;
            }
        }

        const drinkSelect = document.getElementById('select-drink');
        const cupSelect = document.getElementById('select-cup');
        const simSleepElem = document.getElementById('sleep-time-simulated');

        if (drinkSelect && cupSelect && simSleepElem) {
            const drinkObj = DRINK_DATABASE.find(d => d.id === drinkSelect.value);
            const cupObj = CUP_SIZES[cupSelect.value];

            if (drinkObj && cupObj) {
                let simCaffeine = drinkObj.baseCaffeineMg;
                if (drinkObj.isVolumeScaled) {
                    simCaffeine = Math.round(simCaffeine * cupObj.multiplier);
                }

                const simulatedHistory = [
                    ...this.drinkHistory,
                    { id: 99999, caffeineMg: simCaffeine, timestamp: now }
                ];

                const simSleepTimeMs = this.pk.estimateTimeToThreshold(
                    simulatedHistory,
                    20,
                    this.cigsPerDay,
                    this.isQuit,
                    this.daysQuit,
                    this.priorCigs,
                    this.isOCP
                );

                if (simSleepTimeMs <= now) {
                    simSleepElem.textContent = 'Şu An';
                } else {
                    const simSleepDate = new Date(simSleepTimeMs);
                    const simHours = simSleepDate.getHours().toString().padStart(2, '0');
                    const simMinutes = simSleepDate.getMinutes().toString().padStart(2, '0');
                    simSleepElem.textContent = `${simHours}:${simMinutes}`;
                }
            }
        }

        // 4. CYP1A2 Enzim Durum Yazısı
        const effHalfLife = this.pk.calculateEffectiveHalfLife(
            this.cigsPerDay,
            this.isQuit,
            this.daysQuit,
            this.priorCigs,
            this.isOCP
        ).toFixed(1);

        const cypElem = document.getElementById('cyp-status');
        if (cypElem) {
            let ocpTag = this.isOCP ? ' + OCP (2x)' : '';
            if (this.cigsPerDay === 0 && this.isQuit && this.daysQuit < 14) {
                cypElem.textContent = `🚭 Sigara Bırakıldı (Gün ${this.daysQuit}/14): Yarı Ömür ${effHalfLife} Saat${ocpTag}`;
            } else {
                cypElem.textContent = `CYP1A2: Yarı Ömür ${effHalfLife} Saat (${this.cigsPerDay} Sigara/Gün)${ocpTag}`;
            }
        }

        // 5. Canvas Grafiği Çizimi
        if (this.chart) {
            this.chart.render(
                this.pk,
                this.drinkHistory,
                this.cigsPerDay,
                this.tolerance.currentTolerance.thresholdMg,
                20,
                this.isQuit,
                this.daysQuit,
                this.priorCigs,
                this.isOCP
            );
        }

        // 6. Tüketim Geçmişi Listesi
        const historyList = document.getElementById('history-list');
        if (historyList) {
            if (this.drinkHistory.length === 0) {
                historyList.innerHTML = '<li style="color: var(--text-muted); font-size: 0.85rem;">Henüz içecek eklenmedi.</li>';
                return;
            }

            historyList.innerHTML = [...this.drinkHistory].reverse().map(item => {
                const d = new Date(item.timestamp);
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                return `
                    <li class="history-item">
                        <div class="history-info">
                            <span class="history-time">${timeStr}</span>
                            <span>${item.name}</span>
                        </div>
                        <div class="history-actions">
                            <strong>+${item.caffeineMg} mg</strong>
                            <button class="btn-delete" data-id="${item.id}" title="Kaydı Sil" aria-label="${item.name} kaydını sil">✕</button>
                        </div>
                    </li>
                `;
            }).join('');

            historyList.querySelectorAll('.btn-delete').forEach(btn => {
                btn.onclick = (e) => {
                    const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                    this.deleteDrink(id);
                };
            });
        }
    }
}

// Uygulamayı Başlat
window.addEventListener('DOMContentLoaded', () => new CircadiaApp());