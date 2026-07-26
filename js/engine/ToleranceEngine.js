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
     * Kandaki kafein miktarına göre kullanıcının aktif odak/uyarılma modunda olup olmadığını döner.
     */
    getStimulationStatus(activeCaffeineMg) {
        return {
            isStimulated: activeCaffeineMg >= this.currentTolerance.thresholdMg,
            thresholdMg: this.currentTolerance.thresholdMg,
            deficitMg: Math.max(0, this.currentTolerance.thresholdMg - activeCaffeineMg)
        };
    }

    /**
     * Son alımdan bu yana geçen süreye ve kandaki kafeinin sıfırlanmasına göre yoksunluk riski hesaplar.
     */
    checkWithdrawalRisk(activeCaffeineMg, lastDrinkTimestamp) {
        if (!lastDrinkTimestamp) return { risk: 'NONE', message: 'Tüketim kaydı yok.' };

        const hoursSinceLastDrink = (Date.now() - lastDrinkTimestamp) / (1000 * 60 * 60);

        if (activeCaffeineMg < 10 && hoursSinceLastDrink >= 14 && this.currentTolerance.id === 'HIGH') {
            return {
                risk: 'HIGH',
                message: '⚠️ Adenozin Rebound Riski: Yüksek tolerans nedeniyle baş ağrısı ve sersemlik başlayabilir.'
            };
        } else if (activeCaffeineMg < 15 && hoursSinceLastDrink >= 12) {
            return {
                risk: 'MODERATE',
                message: '⚡ Kafein seviyesi düştü. Odak kaybı yaşanabilir.'
            };
        }

        return { risk: 'LOW', message: 'Kandaki kafein dengeli.' };
    }
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