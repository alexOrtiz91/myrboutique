export const mockCategories = [
  {
    id: "pantalones_dama",
    name: "Pantalones Dama",
    price: 390,
    wholesalePrice: 340,
    sizeProfileId: "pantalon_dama",
    tallas: ["28", "30", "32", "34", "36", "38", "40"],
  },
  {
    id: "pantalones_caballero",
    name: "Pantalones Caballero",
    price: 420,
    wholesalePrice: 370,
    sizeProfileId: "pantalon_caballero",
    tallas: ["28", "30", "32", "34", "36", "38", "40"],
  },
  {
    id: "pantalones_nino",
    name: "Pantalones Niño",
    price: 290,
    wholesalePrice: 250,
    sizeProfileId: "pantalon_nino",
    tallas: ["4", "6", "8", "10", "12", "14", "16"],
  },
  {
    id: "ropa_bebe",
    name: "Ropa Bebé",
    price: 220,
    wholesalePrice: 190,
    sizeProfileId: "ropa_bebe",
    tallas: ["0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M"],
  },
];

export const mockGeneros = ["Dama", "Caballero", "Niño", "Bebé"];

export const mockProducts = [
  {
    code: "1001",
    categoryId: "pantalones_dama",
    talla: "28",
  },
  {
    code: "1002",
    categoryId: "pantalones_caballero",
    talla: "32",
  },
  {
    code: "2001",
    categoryId: "pantalones_nino",
    talla: "10",
  },
  {
    code: "3001",
    categoryId: "ropa_bebe",
    talla: "6-9M",
  },
];

export const mockInventoryByCategory = {
  pantalones_dama: 12,
  pantalones_caballero: 8,
  pantalones_nino: 10,
  ropa_bebe: 16,
};

export function getCategoryById(categories, categoryId) {
  return categories.find((c) => c.id === categoryId) || null;
}

export function getProductByCode(products, code) {
  return products.find((p) => String(p.code) === String(code)) || null;
}

export function getProductName(product) {
  if (!product) return "";
  if (!product.talla) return "";
  return `Talla ${product.talla}`;
}
