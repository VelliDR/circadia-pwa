import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../src/utils/security';

describe('Security Utility', () => {
    it('should escape dangerous HTML tags and characters', () => {
        const payload = '<script>alert("xss")</script>';
        const escaped = escapeHtml(payload);
        expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        expect(escaped).not.toContain('<');
        expect(escaped).not.toContain('>');
    });

    it('should escape quotes and ampersands', () => {
        const payload = 'Coffee & Tea "Special" \'Roast\'';
        const escaped = escapeHtml(payload);
        expect(escaped).toBe('Coffee &amp; Tea &quot;Special&quot; &#039;Roast&#039;');
    });

    it('should return safe strings unchanged', () => {
        expect(escapeHtml('Espresso 100mg')).toBe('Espresso 100mg');
    });
});
