import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { enforceTenant } from '../../middleware/tenant.middleware.js';
import { InventoryController } from './inventory.controller.js';

export const inventoryRouter = Router();

// Protect all inventory routes with JWT and multi-tenant isolation
inventoryRouter.use(authenticateToken);
inventoryRouter.use(enforceTenant);

// Low stock alerts
inventoryRouter.get('/low-stock', InventoryController.getLowStockAlerts);

// Product catalog CRUD & filtering
inventoryRouter.get('/products', InventoryController.getProducts);
inventoryRouter.get('/products/:id', InventoryController.getProductById);
inventoryRouter.post('/products', InventoryController.createProduct);
inventoryRouter.put('/products/:id', InventoryController.updateProduct);
inventoryRouter.delete('/products/:id', InventoryController.deleteProduct);

// Stock Adjustments
inventoryRouter.post('/products/:id/adjust-stock', InventoryController.adjustStock);
