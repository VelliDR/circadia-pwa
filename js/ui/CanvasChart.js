export class CanvasChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = 260;
    }

    render(pkEngine, drinkHistory, cigsPerDay, thresholdMg, sleepThresholdMg = 20) {
        if (!this.canvas || !this.ctx) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        const now = Date.now();
        const hoursWindow = 24;
        const startTime = now - (12 * 60 * 60 * 1000);
        const endTime = now + (12 * 60 * 60 * 1000);

        // Max Y Değerini Hesapla
        let maxCaffeine = 150;
        const points = [];
        const stepMinutes = 10; // Daha pürüzsüz çizim için 10 dk
        const totalSteps = (hoursWindow * 60) / stepMinutes;

        for (let i = 0; i <= totalSteps; i++) {
            const t = startTime + (i * stepMinutes * 60 * 1000);
            const val = pkEngine.getTotalActiveCaffeine(drinkHistory, t, cigsPerDay);
            points.push({ time: t, value: val });
            if (val > maxCaffeine) maxCaffeine = val;
        }

        // Yuvarlama ve Dinamik Y Adımı
        maxCaffeine = Math.ceil((maxCaffeine + 20) / 50) * 50;
        
        let stepY = 50;
        if (maxCaffeine >= 2000) stepY = 500;
        else if (maxCaffeine >= 800) stepY = 200;
        else if (maxCaffeine >= 400) stepY = 100;

        // Dinamik Sol Girinti (Geniş rakamların taşmaması için)
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        const maxTextWidth = ctx.measureText(`${maxCaffeine}mg`).width;
        const padding = { top: 30, right: 20, bottom: 35, left: Math.max(55, maxTextWidth + 15) };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Y-Ekseni Grid Çizgileri ve Etiketleri
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillStyle = '#64748b';
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

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, height - padding.bottom);
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.fillText(hoursStr, x, height - 12);
        }

        // Eşik Çizgileri
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

            ctx.fillStyle = color;
            ctx.textAlign = 'right';
            ctx.fillText(label, width - padding.right - 5, y - 5);
        };

        drawThresholdLine(thresholdMg, '#ef4444', 'Uyarılma Eşiği');
        drawThresholdLine(sleepThresholdMg, '#eab308', 'Uyku Eşiği (20mg)');

        // Kafein Eğrisi - Alan Dolgusu (Gradient)
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

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

        // Kafein Eğrisi - Ana Çizgi
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
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

        // Şu Anki Zaman Çizgisi + "ŞİMDİ" Rozeti
        const nowX = padding.left + ((now - startTime) / (endTime - startTime)) * chartWidth;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(nowX, padding.top);
        ctx.lineTo(nowX, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // "ŞİMDİ" Rozeti
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(nowX - 20, padding.top - 16, 40, 14);
        ctx.fillStyle = '#0b0f17';
        ctx.textAlign = 'center';
        ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
        ctx.fillText('ŞİMDİ', nowX, padding.top - 5);
    }
}