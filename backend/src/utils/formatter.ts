export function formatQuantity(qty: number, sell_type: string): string {
    if (sell_type === 'per_unit') return `${qty}x`;
    const fractions: Record<number, string> = {
        0.25: '¼ Kg',
        0.5:  '½ Kg',
        0.75: '¾ Kg',
    };
    return fractions[qty] ?? `${qty} Kg`;
}
