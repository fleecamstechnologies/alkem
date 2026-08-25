import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { ProductsService } from './products/products.service';
import { UserRole } from './common/enums/user-role.enum';
import { AuthenticatedUser } from './common/types/authenticated-user.type';

const SYSTEM_ACTOR: AuthenticatedUser = {
  userId: 'system-seed',
  email: 'system@alkem.local',
  role: UserRole.SUPER_ADMIN,
};

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const productsService = app.get(ProductsService);

  const adminEmail = 'admin@alkem.local';
  const existingAdmin = await usersService.findByEmail(adminEmail);
  if (!existingAdmin) {
    await usersService.create(
      {
        email: adminEmail,
        password: 'ChangeMe123!',
        name: 'System Administrator',
        role: UserRole.SUPER_ADMIN,
      },
      SYSTEM_ACTOR,
    );
    console.log(`Created super admin: ${adminEmail} / ChangeMe123!`);
  } else {
    console.log(`Super admin already exists: ${adminEmail}`);
  }

  const demoProductCode = 'PARA-500-TAB';
  const existingProducts = await productsService.findAll();
  if (!existingProducts.some((p) => p.productCode === demoProductCode)) {
    await productsService.create(
      {
        productCode: demoProductCode,
        productName: 'Paracetamol',
        genericName: 'Paracetamol',
        brandName: 'Alkem Para',
        composition: 'Paracetamol IP 500mg',
        strength: '500mg',
        dosageForm: 'Tablet',
        packSize: '10 x 10 strip',
        manufacturingSite: 'Mumbai Plant',
        storageCondition: 'Store below 30°C, protect from moisture',
        shelfLifeMonths: 36,
      },
      SYSTEM_ACTOR,
    );
    console.log(`Created demo product: ${demoProductCode}`);
  } else {
    console.log(`Demo product already exists: ${demoProductCode}`);
  }

  await app.close();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
