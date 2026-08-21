/**
 * @file Pharmacokinetics.js
 * @description Kafein emilimi (Bateman Kinetiği), eliminasyonu, CYP1A2 enzim indüksiyonu/inhibisyonu 
 * ve tolerans/sağlık analizi motoru.
 */

import { DrinkRecord } from '../store/db';

export class Pharmacokinetics {
    baseHalfLife: number;

    /**
     * @param {number} baseHalfLifeHours - Baz yarılanma ömrü (Varsayılan: 5.0 saat)
     */
    constructor(baseHalfLifeHours: number = 5.0) {
        this.baseHalfLife = baseHalfLifeHours;
    }

    /**
     * CYP1A2 Enzim modülasyonuna göre dinamik yarılanma ömrünü hesaplar.
     */
    calculateEffectiveHalfLife(cigsPerDay: number = 0, isQuitSmoking: boolean = false, daysQuit: number = 0, priorCigs: number = 20, isOCP: boolean = false): number {
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

    getEliminationRate(halfLife: number): number {
        return Math.LN2 / halfLife;
    }

    /**
     * Bateman Fonksiyonu (1st Order Absorption & Elimination Model)
     * Emilim ve eliminasyonu eşzamanlı simüle ederek $t_{max}$ noktasında doğal pürüzsüz tepe çizer.
     * 
     * @param {number} initialDoseMg - Tüketilen miktar (mg)
     * @param {number} hoursPassed - Geçen süre (saat)
     * @param {number} halfLife - Etkin yarı ömür (saat)
     * @param {'empty' | 'full'} stomachState - Mide doluluğu
     */
    calculateCaffeineAtTime(initialDoseMg: number, hoursPassed: number, halfLife: number, stomachState: 'empty' | 'full' = 'empty'): number {
        if (hoursPassed < 0) return 0;

        const ke = this.getEliminationRate(halfLife); // Eliminasyon sabiti
        const ka = stomachState === 'full' ? 2.0 : 5.0; // Emilim hızı sabiti (Tok: yavaş, Aç: hızlı)

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
    getTotalActiveCaffeine(drinkHistory: DrinkRecord[], targetTimestamp: number, cigsPerDay: number = 0, isQuit: boolean = false, daysQuit: number = 0, priorCigs: number = 20, isOCP: boolean = false): number {
        if (!drinkHistory || drinkHistory.length === 0) return 0;

        const halfLife = this.calculateEffectiveHalfLife(cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);

        return drinkHistory.reduce((total, item) => {
            const hoursPassed = (targetTimestamp - item.timestamp) / (1000 * 60 * 60);
            const state = item.stomachState || 'empty';
            return total + this.calculateCaffeineAtTime(item.caffeineMg, hoursPassed, halfLife, state);
        }, 0);
    }

    /**
     * Kandaki kafein seviyesinin hedeflenen güvenli uyku eşiğine (20 mg) ineceği zamanı hesaplar.
     * Emilim aşamasındaki taze içeceklerin pik yapmasını bekleyen 2 aşamalı simülatör.
     */
    estimateTimeToThreshold(drinkHistory: DrinkRecord[], thresholdMg: number = 20, cigsPerDay: number = 0, isQuit: boolean = false, daysQuit: number = 0, priorCigs: number = 20, isOCP: boolean = false): number {
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