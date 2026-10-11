import type { DemoData } from './types.js';

export const demoData: DemoData = {
  users: [{ id: 'u-1', name: 'Avery Demo', email: 'avery@example.test' }],
  carts: {
    'cart-1': [
      { productId: 'p-1', unitPriceCents: 1250, quantity: 2 },
      { productId: 'p-2', unitPriceCents: 500, quantity: 3 },
    ],
    empty: [],
    single: [{ productId: 'p-1', unitPriceCents: 1250, quantity: 1 }],
  },
};
