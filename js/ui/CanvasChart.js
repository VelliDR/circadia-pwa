/**
 * @file CanvasChart.js
 * @description 24 saatlik kafein eliminasyon eğrisini mobil kaydırma hatalarından 
 * arındırılmış bir şekilde Canvas üzerinde 2D olarak çizer.
 */

export class CanvasChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.displayWidth = 0;
        this.displayHeight = 260;

        this.resizeCanvas();
    }

    /**
     * Yalnızca GENİŞLİK değiştiğinde Canvas buffer'ını sıfırlar.
     * Mobil scroll sırasındaki adres çubuğu boy değişimlerinde tuvali temizlemez.
     */
    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return false;
        
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        // Genişlik farkı 2 pikselden azsa (mobil dikey scroll) resize yapma
        if (Math.abs(this.displayWidth - rect.width) < 2) {
            return false;
        }

        const dpr = window.devicePixelRatio || 1;
        this.displayWidth = rect.width;
        this.displayHeight = 260;

        this.canvas.width = this.displayWidth * dpr;
        this.canvas.height = this.displayHeight * dpr;

        this.canvas.style.width = `${this.displayWidth}px`;
        this.canvas.style.height = `${this.displayHeight}px`;

        this.ctx.scale(dpr, dpr);
        return true;
    }

    render(
        pkEngine, 
        drinkHistory, 
        cigsPerDay, 
        thresholdMg, 
        sleepThresholdMg = 20, 
        isQuit = false, 
        daysQuit = 0, 
        priorCigs = 20, 
        isOCP = false
    ) {
        if (!this.canvas || !this.ctx) return;

        const width = this.displayWidth;
        const height = this.displayHeight;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        const isRedShift = document.body.classList.contains('red-shift');
        const colors = {
            line: isRedShift ? '#ff1a1a' : '#10b981',
            fillStart: isRedShift ? 'rgba(255, 26, 26, 0.35)' : 'rgba(16, 185, 129, 0.35)',
            fillEnd: isRedShift ? 'rgba(255, 26, 26, 0.0)' : 'rgba(16, 185, 129, 0.0)',
            nowBadgeBg: isRedShift ? '#ff0000' : '#38bdf8',
            nowBadgeText: '#000000',
            gridLine: isRedShift ? 'rgba(255, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)',
            axisText: isRedShift ? '#ff8080' : '#64748b'
        };

        const now = Date.now();
        const hoursWindow = 24;
        const startTime = now - (12 * 60 * 60 * 1000);
        const endTime = now + (12 * 60 * 60 * 1000);

        // Max Y Hesabı
        let maxCaffeine = 150;
        const points = [];
        const stepMinutes = 10;
        const totalSteps = (hoursWindow * 60) / stepMinutes;

        for (let i = 0; i <= totalSteps; i++) {
            const t = startTime + (i * stepMinutes * 60 * 1000);
            const val = pkEngine.getTotalActiveCaffeine(drinkHistory, t, cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);
            points.push({ time: t, value: val });
            if (val > maxCaffeine) maxCaffeine = val;
        }

        maxCaffeine = Math.ceil((maxCaffeine + 20) / 50) * 50;
        let stepY = maxCaffeine >= 2000 ? 500 : (maxCaffeine >= 800 ? 200 : (maxCaffeine >= 400 ? 100 : 50));

        ctx.font = '11px system-ui, -apple-system, sans-serif';
        const maxTextWidth = ctx.measureText(`${maxCaffeine}mg`).width;
        const padding = { top: 30, right: 20, bottom: 35, left: Math.max(55, maxTextWidth + 15) };
        
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Grid Çizgileri
        ctx.strokeStyle = colors.gridLine;
        ctx.fillStyle = colors.axisText;
        ctx.textAlign = 'right';

        for (let yVal = 0; yVal <= maxCaffeine; yVal += stepY) {
            const y = height - padding.bottom - (yVal / maxCaffeine) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            ctx.fillText(`${yVal}mg`, padding.left - 8, y + 4);
        }

        // X-Ekseni (Saatler)
        ctx.textAlign = 'center';
        for (let i = -12; i <= 12; i += 4) {
            const t = now + (i * 60 * 60 * 1000);
            const date = new Date(t);
            const hoursStr = date.getHours().toString().padStart(2, '0') + ':00';
            const x = padding.left + ((t - startTime) / (endTime - startTime)) * chartWidth;

            ctx.strokeStyle = colors.gridLine;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, height - padding.bottom);
            ctx.stroke();

            ctx.fillStyle = colors.axisText;
            ctx.fillText(hoursStr, x, height - 12);
        }

        // Eşik Çizgileri
        // CanvasChart.js içinde drawThresholdLine fonksiyonunu güncelleyin:

const drawThresholdLine = (val, color, label) => {
    if (val > maxCaffeine) return;
    const y = height - padding.bottom - (val / maxCaffeine) * chartHeight;
    ctx.strokeStyle = color;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // YAZIYI SOLA ALARAK SAĞ TAŞMAYI ENGELLEME:
    ctx.fillStyle = color;
    ctx.textAlign = 'left'; 
    ctx.fillText(label, padding.left + 8, y - 5);
};

        drawThresholdLine(thresholdMg, '#ef4444', 'Uyarılma Eşiği');
        drawThresholdLine(sleepThresholdMg, '#eab308', 'Uyku Eşiği (20mg)');

        // Area Gradient
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, colors.fillStart);
        gradient.addColorStop(1, colors.fillEnd);

        ctx.beginPath();
        points.forEach((pt, idx) => {
            const x = padding.left + ((pt.time - startTime) / (endTime - startTime)) * chartWidth;
            const y = height - padding.bottom - (pt.value / maxCaffeine) * chartHeight;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.lineTo(padding.left + chartWidth, height - padding.bottom);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Ana Eğri
        ctx.beginPath();
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        points.forEach((pt, idx) => {
            const x = padding.left + ((pt.time - startTime) / (endTime - startTime)) * chartWidth;
            const y = height - padding.bottom - (pt.value / maxCaffeine) * chartHeight;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // "ŞİMDİ" Çizgisi ve Rozeti
        const nowX = padding.left + ((now - startTime) / (endTime - startTime)) * chartWidth;
        ctx.strokeStyle = colors.nowBadgeBg;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(nowX, padding.top);
        ctx.lineTo(nowX, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = colors.nowBadgeBg;
        ctx.fillRect(nowX - 20, padding.top - 16, 40, 14);
        ctx.fillStyle = colors.nowBadgeText;
        ctx.textAlign = 'center';
        ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
        ctx.fillText('ŞİMDİ', nowX, padding.top - 5);
    }
}