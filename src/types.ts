export interface User {
  id: string;
  name: string;
  email: string;
}

export interface CartItem {
  productId: string;
  unitPriceCents: number;
  quantity: number;
}

export interface DemoData {
  users: readonly User[];
  carts: Readonly<Record<string, readonly CartItem[]>>;
}
