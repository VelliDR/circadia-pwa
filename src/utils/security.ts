/**
 * @file security.ts
 * @description Güvenlik ve veri temizleme yardımcı fonksiyonları.
 */

export function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
