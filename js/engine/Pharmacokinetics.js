/**
 * @file Pharmacokinetics.js
 * @description Kafein eliminasyonu, emilim evresi ($t_{max}$), CYP1A2 enzim indüksiyonu (sigara),
 * de-indüksiyonu (sigara bırakma) ve CYP1A2 inhibisyonu (oral kontraseptif) matematiğini yönetir.
 */

export class Pharmacokinetics {
    /**
     * @param {number} baseHalfLifeHours - Baz yarılanma ömrü (Varsayılan: 5.0 saat)
     */
    constructor(baseHalfLifeHours = 5.0) {
        this.baseHalfLife = baseHalfLifeHours;
    }

    /**
     * Sigara adedi, sigara bırakma süresi ve oral kontraseptif kullanımına göre 
     * karaciğer CYP1A2 enzim aktivitesini ve dinamik yarılanma ömrünü hesaplar.
     * 
     * @param {number} cigsPerDay - Günlük içilen sigara adedi
     * @param {boolean} isQuitSmoking - Son 14 gün içinde sigaranın bırakılıp bırakılmadığı
     * @param {number} daysQuit - Sigaranın bırakıldığı gün sayısı (1 - 14)
     * @param {number} priorCigs - Bırakmadan önceki günlük sigara adedi
     * @param {boolean} isOCP - Oral kontraseptif (doğum kontrol) kullanımı
     * @returns {number} Etkin yarılanma ömrü (Saat)
     */
    calculateEffectiveHalfLife(cigsPerDay = 0, isQuitSmoking = false, daysQuit = 0, priorCigs = 20, isOCP = false) {
        let halfLife = this.baseHalfLife;

        // 1. Sigara Bırakma Durumu (CYP1A2 Enzim De-indüksiyonu / 14 Günlük Geçiş)
        if (cigsPerDay === 0 && isQuitSmoking && daysQuit < 14) {
            const cappedPrior = Math.min(Math.max(1, priorCigs), 30);
            const priorInduction = 1 + (0.04 * cappedPrior);
            const inducedHalfLife = this.baseHalfLife / priorInduction; // Bırakmadan önceki yarı ömür (~2.8sa)

            const progress = Math.min(Math.max(0, daysQuit), 14) / 14;
            halfLife = inducedHalfLife + ((this.baseHalfLife - inducedHalfLife) * progress);
        } else {
            // 2. Aktif Sigara İçme veya İçmeme Durumu (İndüksiyon)
            const cappedCigs = Math.min(Math.max(0, cigsPerDay), 30);
            const inductionFactor = 1 + (0.04 * cappedCigs);
            halfLife = this.baseHalfLife / inductionFactor;
        }

        // 3. Oral Kontraseptif Etkisi (CYP1A2 İnhibisyonu - Yarı ömrü 2 kat uzatır)
        if (isOCP) {
            halfLife *= 2.0;
        }

        return halfLife;
    }

    /**
     * Eliminasyon hız sabitini (k_e) hesaplar.
     * @param {number} halfLife - Yarılanma ömrü (Saat)
     * @returns {number} Eliminasyon katsayısı (1/Saat)
     */
    getEliminationRate(halfLife) {
        return Math.LN2 / halfLife;
    }

    /**
     * Verilen süre sonunda vücutta kalan aktif kafein miktarını hesaplar.
     * İlk 30 dakika (0.5 saat) mide/bağırsak emilim evresidir (Ramp-Up).
     * 30. dakikadan sonra 1. derece eliminasyon başlar.
     * 
     * @param {number} initialDoseMg - Başlangıç kafein dozu (mg)
     * @param {number} hoursPassed - Tüketimden bu yana geçen süre (Saat)
     * @param {number} halfLife - Etkin yarılanma ömrü (Saat)
     * @returns {number} Kanda kalan aktif kafein (mg)
     */
    calculateCaffeineAtTime(initialDoseMg, hoursPassed, halfLife) {
        if (hoursPassed < 0) return 0;

        const tMaxHours = 0.5; // 30 Dakikalık Emilim Evresi

        // Emilim Fazı (0 - 30 dk): Kafein dozu pike doğru tırmanır
        if (hoursPassed <= tMaxHours) {
            return initialDoseMg * (hoursPassed / tMaxHours);
        }

        // Eliminasyon Fazı (30+ dk): 1. Derece kinetik yıkım
        const ke = this.getEliminationRate(halfLife);
        return initialDoseMg * Math.exp(-ke * (hoursPassed - tMaxHours));
    }

    /**
     * Tüketilen tüm içeceklerin hedef zaman damgasındaki toplamını (Süperpozisyon) hesaplar.
     */
    getTotalActiveCaffeine(drinkHistory, targetTimestamp, cigsPerDay = 0, isQuit = false, daysQuit = 0, priorCigs = 20, isOCP = false) {
        const halfLife = this.calculateEffectiveHalfLife(cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);
        
        return drinkHistory.reduce((total, item) => {
            const hoursPassed = (targetTimestamp - item.timestamp) / (1000 * 60 * 60);
            return total + this.calculateCaffeineAtTime(item.caffeineMg, hoursPassed, halfLife);
        }, 0);
    }

    /**
     * Kandaki kafein seviyesinin hedeflenen güvenli eşiğe (örn. 20 mg) düşeceği zamanı tahmin eder.
     */
    estimateTimeToThreshold(drinkHistory, thresholdMg = 20, cigsPerDay = 0, isQuit = false, daysQuit = 0, priorCigs = 20, isOCP = false) {
        const now = Date.now();
        const currentActive = this.getTotalActiveCaffeine(drinkHistory, now, cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);
        
        if (currentActive <= thresholdMg) return now;

        const halfLife = this.calculateEffectiveHalfLife(cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);
        const ke = this.getEliminationRate(halfLife);
        
        const hoursNeeded = Math.log(currentActive / thresholdMg) / ke;
        return now + (hoursNeeded * 60 * 60 * 1000);
    }
}