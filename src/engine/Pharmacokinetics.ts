/**
 * @file Pharmacokinetics.ts
 * @description Kafein emilimi (Bateman Kinetiği), sistemik vücut yükü (mg), plazma konsantrasyonu (mg/L),
 * üstel CYP1A2 enzim indüksiyonu/de-indüksiyonu ve uyku eşiği simülasyon motoru.
 */

import { DrinkRecord } from '../store/db';

export const CAFFEINE_VD_L_PER_KG = 0.65; // Dağılım hacmi Vd ≈ 0.6–0.7 L/kg (Blanchard & Sawers 1983)

export class Pharmacokinetics {
    baseHalfLife: number;

    /**
     * @param baseHalfLifeHours - Baz yarılanma ömrü (Varsayılan: 5.0 saat)
     */
    constructor(baseHalfLifeHours: number = 5.0) {
        this.baseHalfLife = baseHalfLifeHours;
    }

    /**
     * CYP1A2 enzim modülasyonuna göre dinamik yarılanma ömrünü hesaplar.
     * Sigara bırakma sürecinde üstel (exponential) CYP1A2 turnover modeli kullanılır
     * (Faber & Fuhr 2004: t1/2_deindüksiyon ≈ 38.6 saat, τ ≈ 2.3 gün).
     */
    calculateEffectiveHalfLife(
        cigsPerDay: number = 0,
        isQuitSmoking: boolean = false,
        daysQuit: number = 0,
        priorCigs: number = 20,
        isOCP: boolean = false,
        isPregnant: boolean = false
    ): number {
        let halfLife = this.baseHalfLife;

        // 1. Sigara Bırakma Durumu (Üstel Enzim De-indüksiyonu / 14 Günlük Pencere)
        if (cigsPerDay === 0 && isQuitSmoking && daysQuit < 14) {
            const cappedPrior = Math.min(Math.max(1, priorCigs), 30);
            const initialInduction = 1 + (0.04 * cappedPrior);
            const clampedDays = Math.min(Math.max(0, daysQuit), 14);

            const tauDays = 2.3; // τ = 38.6 sa / (24 * ln2) ≈ 2.32 gün
            const expMax = Math.exp(-14 / tauDays);
            const decayFraction = (Math.exp(-clampedDays / tauDays) - expMax) / (1 - expMax);
            const currentInduction = 1 + ((initialInduction - 1) * decayFraction);

            halfLife = this.baseHalfLife / currentInduction;
        } else {
            // 2. Aktif Sigara İçme / İçmeme Durumu
            const cappedCigs = Math.min(Math.max(0, cigsPerDay), 30);
            const inductionFactor = 1 + (0.04 * cappedCigs);
            halfLife = this.baseHalfLife / inductionFactor;
        }

        // 3. Oral Kontraseptif veya Gebelik Etkisi (CYP1A2 İnhibisyonu)
        if (isOCP) {
            halfLife *= 2.0;
        }
        if (isPregnant) {
            halfLife *= isOCP ? 1.25 : 2.0;
        }

        return Math.min(halfLife, 18.0);
    }

    getEliminationRate(halfLife: number): number {
        return Math.LN2 / Math.max(0.1, halfLife);
    }

    /**
     * Analitik doruk konsantrasyon süresi t_max (dakika).
     * t_max = ln(ka / ke) / (ka - ke)
     * Aç karnına (ka=5 sa^-1, t1/2=5 sa) ≈ 44 dk; Tok karnına (ka=2 sa^-1) ≈ 86 dk.
     */
    getTmaxMinutes(halfLife: number = this.baseHalfLife, stomachState: 'empty' | 'full' = 'empty'): number {
        const ke = this.getEliminationRate(halfLife);
        const ka = stomachState === 'full' ? 2.0 : 5.0;
        if (Math.abs(ka - ke) < 0.0001) {
            return (1 / ke) * 60;
        }
        return (Math.log(ka / ke) / (ka - ke)) * 60;
    }

    /**
     * Bateman Fonksiyonu (1. Derece Emilim ve Eliminasyon Modeli).
     * Çıktı: Vücuttaki toplam aktif kafein miktarı A(t) (mg).
     */
    calculateCaffeineAtTime(
        initialDoseMg: number,
        hoursPassed: number,
        halfLife: number,
        stomachState: 'empty' | 'full' = 'empty'
    ): number {
        if (hoursPassed < 0 || initialDoseMg <= 0) return 0;

        const ke = this.getEliminationRate(halfLife);
        const ka = stomachState === 'full' ? 2.0 : 5.0;

        if (Math.abs(ka - ke) < 0.0001) {
            return initialDoseMg * ka * hoursPassed * Math.exp(-ke * hoursPassed);
        }

        const activeBodyLoadMg = initialDoseMg * (ka / (ka - ke)) * (Math.exp(-ke * hoursPassed) - Math.exp(-ka * hoursPassed));
        return Math.max(0, activeBodyLoadMg);
    }

    /**
     * Vücuttaki aktif kafein yükünden (mg) tahmini plazma konsantrasyonunu (mg/L) hesaplar.
     * C_p = A / (Vd * W)
     */
    calculatePlasmaConcentrationMgL(
        activeBodyLoadMg: number,
        weightKg: number = 70,
        vdLPerKg: number = CAFFEINE_VD_L_PER_KG
    ): number {
        if (activeBodyLoadMg <= 0) return 0;
        const safeWeight = Math.max(30, Math.min(250, weightKg));
        return activeBodyLoadMg / (vdLPerKg * safeWeight);
    }

    /**
     * Hedef zaman damgasındaki toplam aktif vücut kafein yükünü (Süperpozisyon, mg) hesaplar.
     * Kayıt üzerinde `effectiveHalfLife` varsa geçmiş eğriyi sabit tutmak için onu kullanır.
     */
    getTotalActiveCaffeine(
        drinkHistory: DrinkRecord[],
        targetTimestamp: number,
        cigsPerDay: number = 0,
        isQuit: boolean = false,
        daysQuit: number = 0,
        priorCigs: number = 20,
        isOCP: boolean = false,
        isPregnant: boolean = false
    ): number {
        if (!drinkHistory || drinkHistory.length === 0) return 0;

        const fallbackHalfLife = this.calculateEffectiveHalfLife(cigsPerDay, isQuit, daysQuit, priorCigs, isOCP, isPregnant);
        const cutoff = targetTimestamp - (72 * 60 * 60 * 1000); // Uzamış yarı ömürler için 72 saatlik pencere

        return drinkHistory.reduce((total, item) => {
            if (item.caffeineMg <= 0 || item.timestamp < cutoff) return total;
            const hoursPassed = (targetTimestamp - item.timestamp) / (1000 * 60 * 60);
            if (hoursPassed < 0) return total;
            const state = item.stomachState || 'empty';
            const recordHalfLife = (item.effectiveHalfLife && item.effectiveHalfLife > 0)
                ? item.effectiveHalfLife
                : fallbackHalfLife;
            return total + this.calculateCaffeineAtTime(item.caffeineMg, hoursPassed, recordHalfLife, state);
        }, 0);
    }

    /**
     * Aktif vücut yükünün hedeflenen güvenli uyku eşiğine (varsayılan: 25 mg) ineceği zamanı hesaplar.
     */
    estimateTimeToThreshold(
        drinkHistory: DrinkRecord[],
        thresholdMg: number = 25,
        cigsPerDay: number = 0,
        isQuit: boolean = false,
        daysQuit: number = 0,
        priorCigs: number = 20,
        isOCP: boolean = false,
        isPregnant: boolean = false,
        referenceNow: number = Date.now()
    ): number {
        const now = referenceNow;
        const maxStepTime = now + (36 * 60 * 60 * 1000);
        const stepIntervalMs = 5 * 60 * 1000;

        let maxFutureActive = 0;
        let peakTime = now;

        for (let t = now; t <= now + (4 * 60 * 60 * 1000); t += stepIntervalMs) {
            const val = this.getTotalActiveCaffeine(drinkHistory, t, cigsPerDay, isQuit, daysQuit, priorCigs, isOCP, isPregnant);
            if (val > maxFutureActive) {
                maxFutureActive = val;
                peakTime = t;
            }
        }

        if (maxFutureActive <= thresholdMg) {
            return now;
        }

        for (let t = peakTime; t <= maxStepTime; t += stepIntervalMs) {
            const val = this.getTotalActiveCaffeine(drinkHistory, t, cigsPerDay, isQuit, daysQuit, priorCigs, isOCP, isPregnant);
            if (val <= thresholdMg) {
                return t;
            }
        }

        return maxStepTime;
    }
}