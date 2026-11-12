import { describe, it, expect } from 'vitest';
import { htmlToPlainText } from './html-text';

describe('htmlToPlainText', () => {
  it('removes <style> block content', () => {
    const html = '<html><head><style>.a{color:red}</style></head><body><p>Total £16.50</p></body></html>';

    const result = htmlToPlainText(html);

    expect(result).not.toContain('color:red');
    expect(result).not.toContain('<style');
    expect(result).toContain('Total £16.50');
  });

  it('removes <script> block content', () => {
    const html = '<html><body><script>alert("x")</script><p>Order Total</p></body></html>';

    const result = htmlToPlainText(html);

    expect(result).not.toContain('alert');
    expect(result).not.toContain('<script');
    expect(result).toContain('Order Total');
  });

  it('removes HTML comments', () => {
    const html = '<html><body><!--[if mso]><table>conditional</table><![endif]--><p>Visible</p></body></html>';

    const result = htmlToPlainText(html);

    expect(result).not.toContain('conditional');
    expect(result).not.toContain('<!--');
    expect(result).not.toContain('[if mso]');
    expect(result).toContain('Visible');
  });

  it("keeps the user's typed note as the first thing in the output", () => {
    const html =
      '<html><body><div>groceries for the house</div>' +
      '<blockquote type="cite">---------- Forwarded message ----------<p>Order</p></blockquote>' +
      '</body></html>';

    const result = htmlToPlainText(html);

    expect(result.startsWith('groceries for the house')).toBe(true);
  });

  it('keeps the forwarded-message separator as text', () => {
    const html =
      '<html><body><blockquote type="cite">' +
      '<p>---------- Forwarded message ----------</p>' +
      '<p>Order #202-9090378-7968332</p>' +
      '</blockquote></body></html>';

    const result = htmlToPlainText(html);

    expect(result).toContain('---------- Forwarded message ----------');
  });

  it('keeps prices, totals, order dates, currency symbols and the retailer name', () => {
    const html =
      '<html><body><div><p>Amazon.co.uk</p>' +
      '<p>Order Date: 15 March 2024</p>' +
      '<p>Total £16.50</p>' +
      '<p>Southern Comfort Original</p>' +
      '</div></body></html>';

    const result = htmlToPlainText(html);

    expect(result).toContain('Order Date: 15 March 2024');
    expect(result).toContain('Total £16.50');
    expect(result).toContain('Amazon.co.uk');
    expect(result).toContain('Southern Comfort Original');
  });

  it('decodes named and numeric entities', () => {
    const html = '<p>a&nbsp;b &pound; c &#163; d &#xA0; e &amp; f</p>';

    const result = htmlToPlainText(html);

    expect(result).toContain('a b');
    expect(result).toContain('£');
    expect(result).toContain('&');
    expect(result).not.toContain('&nbsp;');
    expect(result).not.toContain('&pound;');
    expect(result).not.toContain('&#163;');
    expect(result).not.toContain('&#xA0;');
    expect(result).not.toContain('&amp;');
  });

  it('removes invisible characters', () => {
    const html = '<p>visible&#8199;invisible&#847;invisible&zwnj;invisible&shy;invisible</p>';

    const result = htmlToPlainText(html);

    // U+2007 figure space → plain space, the rest are removed outright.
    expect(result).not.toContain('&#8199;');
    expect(result).not.toContain('&#847;');
    expect(result).not.toContain('&zwnj;');
    expect(result).not.toContain('&shy;');
    expect(result).not.toContain('\u034f');
    expect(result).not.toContain('\u200c');
    expect(result).not.toContain('\u00ad');
    expect(result).toContain('visible');
  });

  it('preserves unknown named entities verbatim', () => {
    const html = '<p>caf&eacute; &#233; &#xe9;</p>';

    const result = htmlToPlainText(html);

    expect(result).toContain('&eacute;');
  });

  it('reduces a 20 KB CSS block to under 2 KB of text', () => {
    const css = 'x'.repeat(20000);
    const html = `<html><head><style>${css}</style></head><body><p>Total £16.50</p></body></html>`;

    const result = htmlToPlainText(html);

    expect(result.length).toBeLessThan(2000);
    expect(result).toContain('Total £16.50');
  });

  it('returns an empty string for empty input', () => {
    expect(htmlToPlainText('')).toBe('');
  });
});
