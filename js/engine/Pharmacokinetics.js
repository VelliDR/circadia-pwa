/**
 * @file Pharmacokinetics.js
 * @description Kafein emilimi (Bateman Kinetiği), eliminasyonu, CYP1A2 enzim indüksiyonu/inhibisyonu 
 * ve tolerans/sağlık analizi motoru.
 */

/* ==========================================================================
   1. SABİTLER & KONFİGÜRASYONLAR
   ========================================================================== */

export const TOLERANCE_LEVELS = {
    LOW: {
        id: 'LOW',
        name: 'Duyarlı / Seyrek İçici',
        thresholdMg: 25,
        description: 'Düşük kafein miktarları bile güçlü uyarılma sağlar.'
    },
    MEDIUM: {
        id: 'MEDIUM',
        name: 'Standart (Günde 1-2 Fincan)',
        thresholdMg: 45,
        description: 'Ortalama tolerans seviyesi.'
    },
    HIGH: {
        id: 'HIGH',
        name: 'Yüksek / Nöbetçi Modu (Günde 3+ Fincan)',
        thresholdMg: 85,
        description: 'Adenozin reseptörleri artmıştır. Düşük dozlar etki etmez.'
    }
};

export const HEALTH_RISK_LEVELS = {
    SAFE: {
        level: 'SAFE',
        title: '🟢 Güvenli Bölge',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: '#10b981',
        message: 'Kandaki kafein miktarı günlük önerilen fizyolojik sınırlar dahilinde.'
    },
    WARNING: {
        level: 'WARNING',
        title: '⚡ Günlük Azami Limit Aşıldı (400 mg+)',
        color: '#eab308',
        bgColor: 'rgba(234, 179, 8, 0.15)',
        borderColor: '#ca8a04',
        message: 'FDA/EFSA önerilen günlük 400 mg sınırını aştınız. Uykusuzluk, sinirlilik ve hafif çarpıntı yaşanabilir.'
    },
    HIGH_RISK: {
        level: 'HIGH_RISK',
        title: '⚠️ Yüksek Toksisite Riski (600 mg+)',
        color: '#f97316',
        bgColor: 'rgba(249, 115, 22, 0.2)',
        borderColor: '#ea580c',
        message: 'Kandaki kafein düzeyi aşırı yüksek. Taşikardi (hızlı nabız), ellerde titreme (tremor) ve mide rahatsızlığı görülebilir.'
    },
    CRITICAL: {
        level: 'CRITICAL',
        title: '🚨 AKUT TOKSİSİTE / MEDİKAL UYARI (1000 mg+)',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.25)',
        borderColor: '#dc2626',
        message: 'Kandaki kafein miktarı kritik boyutta! Şiddetli aritmi, bulantı, ajitasyon ve nöbet riski mevcuttur. DERHAL kafein alımını durdurun!'
    }
};

/* ==========================================================================
   2. FARMAKOKİNETİK MOTORU (PHARMACOKINETICS)
   ========================================================================== */

export class Pharmacokinetics {
    /**
     * @param {number} baseHalfLifeHours - Baz yarılanma ömrü (Varsayılan: 5.0 saat)
     */
    constructor(baseHalfLifeHours = 5.0) {
        this.baseHalfLife = baseHalfLifeHours;
    }

    /**
     * CYP1A2 Enzim modülasyonuna göre dinamik yarılanma ömrünü hesaplar.
     */
    calculateEffectiveHalfLife(cigsPerDay = 0, isQuitSmoking = false, daysQuit = 0, priorCigs = 20, isOCP = false) {
        let halfLife = this.baseHalfLife;

        // 1. Sigara Bırakma Durumu (Enzim De-indüksiyonu / 14 Günlük Adaptasyon)
        if (cigsPerDay === 0 && isQuitSmoking && daysQuit < 14) {
            const cappedPrior = Math.min(Math.max(1, priorCigs), 30);
            const priorInduction = 1 + (0.04 * cappedPrior);
            const inducedHalfLife = this.baseHalfLife / priorInduction;

            const progress = Math.min(Math.max(0, daysQuit), 14) / 14;
            halfLife = inducedHalfLife + ((this.baseHalfLife - inducedHalfLife) * progress);
        } else {
            // 2. Aktif Sigara İçme / İçmeme Durumu
            const cappedCigs = Math.min(Math.max(0, cigsPerDay), 30);
            const inductionFactor = 1 + (0.04 * cappedCigs);
            halfLife = this.baseHalfLife / inductionFactor;
        }

        // 3. Oral Kontraseptif Etkisi (CYP1A2 İnhibisyonu - Yarı ömrü ~2x uzatır)
        if (isOCP) {
            halfLife *= 2.0;
        }

        return halfLife;
    }

    getEliminationRate(halfLife) {
        return Math.LN2 / halfLife;
    }

    /**
     * Bateman Fonksiyonu (1st Order Absorption & Elimination Model)
     * Emilim ve eliminasyonu eşzamanlı simüle ederek $t_{max}$ noktasında doğal pürüzsüz tepe çizer.
     * 
     * @param {number} initialDoseMg - Tüketilen miktar (mg)
     * @param {number} hoursPassed - Geçen süre (saat)
     * @param {number} halfLife - Etkin yarı ömür (saat)
     */
    calculateCaffeineAtTime(initialDoseMg, hoursPassed, halfLife) {
        if (hoursPassed < 0) return 0;

        const ke = this.getEliminationRate(halfLife); // Eliminasyon sabiti
        const ka = 4.5; // Emilim hızı sabiti (~30-45 dk pik emilim için $k_a$)

        // Emilim sabiti ile eliminasyon sabiti çakışması durumu (Singularity Guard)
        if (Math.abs(ka - ke) < 0.0001) {
            return initialDoseMg * ka * hoursPassed * Math.exp(-ke * hoursPassed);
        }

        // Bateman Denklemi: C(t) = D * (ka / (ka - ke)) * (e^(-ke*t) - e^(-ka*t))
        const activeConcentration = initialDoseMg * (ka / (ka - ke)) * (Math.exp(-ke * hoursPassed) - Math.exp(-ka * hoursPassed));
        return Math.max(0, activeConcentration);
    }

    /**
     * Hedef zaman damgasındaki toplam aktif kafein yükünü (Süperpozisyon) hesaplar.
     */
    getTotalActiveCaffeine(drinkHistory, targetTimestamp, cigsPerDay = 0, isQuit = false, daysQuit = 0, priorCigs = 20, isOCP = false) {
        if (!drinkHistory || drinkHistory.length === 0) return 0;

        const halfLife = this.calculateEffectiveHalfLife(cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);

        return drinkHistory.reduce((total, item) => {
            const hoursPassed = (targetTimestamp - item.timestamp) / (1000 * 60 * 60);
            return total + this.calculateCaffeineAtTime(item.caffeineMg, hoursPassed, halfLife);
        }, 0);
    }

    /**
 * Kandaki kafein seviyesinin hedeflenen güvenli uyku eşiğine (20 mg) ineceği zamanı hesaplar.
 * Emilim aşamasındaki taze içeceklerin pik yapmasını bekleyen 2 aşamalı simülatör.
 */
estimateTimeToThreshold(drinkHistory, thresholdMg = 20, cigsPerDay = 0, isQuit = false, daysQuit = 0, priorCigs = 20, isOCP = false) {
    const now = Date.now();
    const maxStepTime = now + (36 * 60 * 60 * 1000); // Max 36 saat ileriye bak
    const stepIntervalMs = 5 * 60 * 1000;            // 5 dakikalık simülasyon adımı

    let maxFutureActive = 0;
    let peakTime = now;

    // 1. Aşama: Önümüzdeki 4 saat içindeki maksimum kafein zirvesini (Peak) bul
    for (let t = now; t <= now + (4 * 60 * 60 * 1000); t += stepIntervalMs) {
        const val = this.getTotalActiveCaffeine(drinkHistory, t, cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);
        if (val > maxFutureActive) {
            maxFutureActive = val;
            peakTime = t;
        }
    }

    // Gelecekteki maksimum kafein bile eşik altındaysa ŞU AN uyumak güvenlidir
    if (maxFutureActive <= thresholdMg) {
        return now;
    }

    // 2. Aşama: Zirve noktasından (peakTime) itibaren kafeinin eşik altına indiği anı ara
    for (let t = peakTime; t <= maxStepTime; t += stepIntervalMs) {
        const val = this.getTotalActiveCaffeine(drinkHistory, t, cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);
        if (val <= thresholdMg) {
            return t;
        }
    }

    return maxStepTime;
}
}

/* ==========================================================================
   3. TOLERANS VE SAĞLIK MOTORU (TOLERANCE ENGINE)
   ========================================================================== */

export class ToleranceEngine {
    constructor(userToleranceKey = 'MEDIUM') {
        this.currentTolerance = TOLERANCE_LEVELS[userToleranceKey] || TOLERANCE_LEVELS.MEDIUM;
    }

    setTolerance(toleranceKey) {
        if (TOLERANCE_LEVELS[toleranceKey]) {
            this.currentTolerance = TOLERANCE_LEVELS[toleranceKey];
        }
    }

    /**
     * Aktif kafein seviyesinin kullanıcının uyarılma eşiğini karşılayıp karşılamadığını döner.
     */
    getStimulationStatus(activeCaffeineMg) {
        const threshold = this.currentTolerance.thresholdMg;
        return {
            isStimulated: activeCaffeineMg >= threshold,
            thresholdMg: threshold,
            deficitMg: Math.max(0, Math.round(threshold - activeCaffeineMg))
        };
    }

    /**
     * Son alımdan bu yana geçen süre ve aktif kafeine göre adenozin rebound/yoksunluk riskini değerlendirir.
     */
    checkWithdrawalRisk(activeCaffeineMg, lastDrinkTimestamp) {
        if (!lastDrinkTimestamp) return { risk: 'NONE', message: 'Tüketim kaydı bulunmuyor.' };

        const hoursSinceLastDrink = (Date.now() - lastDrinkTimestamp) / (1000 * 60 * 60);

        if (activeCaffeineMg < 10 && hoursSinceLastDrink >= 14 && this.currentTolerance.id === 'HIGH') {
            return {
                risk: 'HIGH',
                message: '⚠️ Adenozin Rebound Riski: Yüksek tolerans nedeniyle baş ağrısı ve sersemlik başlayabilir.'
            };
        } else if (activeCaffeineMg < 15 && hoursSinceLastDrink >= 12) {
            return {
                risk: 'MODERATE',
                message: '⚡ Kafein seviyesi düştü. Odak kaybı ve hafif yorgunluk hissi oluşabilir.'
            };
        }

        return { risk: 'LOW', message: 'Kandaki kafein seviyesi dengeli.' };
    }

    /**
     * Toksisite sınırlarına göre sağlık uyarısı nesnesini döndürür.
     */
    getHealthStatus(activeCaffeineMg) {
        if (activeCaffeineMg >= 1000) {
            return HEALTH_RISK_LEVELS.CRITICAL;
        } else if (activeCaffeineMg >= 600) {
            return HEALTH_RISK_LEVELS.HIGH_RISK;
        } else if (activeCaffeineMg >= 400) {
            return HEALTH_RISK_LEVELS.WARNING;
        }
        return HEALTH_RISK_LEVELS.SAFE;
    }
}